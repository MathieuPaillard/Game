// Le serveur du jeu : les comptes des joueurs et leurs parties. Il applique lui-même les règles
// du jeu (le même code que le navigateur) : c'est lui qui décide, personne ne peut tricher.
//
// Les adresses, qui échangent du JSON :
//   POST   /api/accounts           créer un compte        { name, password } → { token, player }
//   POST   /api/sessions           se connecter           { name, password } → { token, player }
//   DELETE /api/sessions/current   se déconnecter
//   GET    /api/game               la partie              → { player, game, now }
//   POST   /api/game               commencer une partie   { race } → { game, now }
//   POST   /api/game/actions       donner un ordre        un ordre (voir actions.ts) → { ok, reason?, game, now }
//   DELETE /api/game               effacer la partie, pour recommencer
// Toutes, sauf les deux premières, demandent le jeton de session dans l'en-tête
// « Authorization: Bearer <jeton> ». `now` est l'heure du serveur : c'est elle qui fait foi.

import { serveStatic } from '@hono/node-server/serve-static'
import { Hono, type Context } from 'hono'
import { bodyLimit } from 'hono/body-limit'
import { createMiddleware } from 'hono/factory'
import { secureHeaders } from 'hono/secure-headers'
import { parseAction, performAction } from '../src/game/actions.ts'
import { RACES } from '../src/game/config.ts'
import { advance, newGame, type GameState } from '../src/game/rules.ts'
import { restoreState } from '../src/game/save.ts'
import {
  PASSWORD_HASHING,
  checkName,
  checkPassword,
  cleanName,
  hashPassword,
  hashToken,
  nameKey,
  newToken,
  verifyPassword,
  type ScryptParams,
} from './auth.ts'
import type { Account, Store } from './db.ts'

const MINUTE = 60 * 1000
const DAY = 24 * 60 * MINUTE
/** Une session qui n'a pas servi pendant 30 jours expire : il faut se reconnecter. */
export const SESSION_IDLE_MS = 30 * DAY
/** Après 10 mots de passe faux pour un même nom, il faut attendre un quart d'heure. */
export const LOGIN_MAX_FAILURES = 10
export const LOGIN_LOCK_MS = 15 * MINUTE

export interface AppOptions {
  store: Store
  /** L'horloge du serveur. Les tests en fournissent une qu'ils avancent eux-mêmes. */
  clock?: () => number
  /** Le dossier du jeu construit par `npm run build`, envoyé aux navigateurs. */
  staticDir?: string
  /** Les réglages de l'empreinte des mots de passe (les tests les allègent, pour aller vite). */
  hashing?: ScryptParams
}

type Env = { Variables: { account: Account; tokenHash: string } }

export function createApp({ store, clock = Date.now, staticDir, hashing = PASSWORD_HASHING }: AppOptions) {
  const app = new Hono<Env>()

  app.use(secureHeaders())
  app.use('/api/*', bodyLimit({ maxSize: 16 * 1024, onError: (c) => c.json({ error: 'Requête trop grosse.' }, 413) }))

  app.get('/api/health', (c) => c.json({ ok: true }))

  // --- Les comptes ---

  /** Ouvre une session : le jeton part une seule fois vers le joueur, le serveur n'en garde que l'empreinte. */
  function openSession(account: Account) {
    const now = clock()
    const token = newToken()
    store.deleteOldSessions(now - SESSION_IDLE_MS)
    store.createSession(hashToken(token), account.id, now)
    return { token, player: { name: account.name } }
  }

  app.post('/api/accounts', async (c) => {
    const body = await readJson(c)
    const name = cleanName(textField(body, 'name'))
    const password = textField(body, 'password')
    const problem = checkName(name) ?? checkPassword(password)
    if (problem) return c.json({ error: problem }, 400)

    const passwordHash = await hashPassword(password, hashing)
    const account = store.createAccount(name, nameKey(name), passwordHash, clock())
    if (!account) return c.json({ error: 'Ce nom est déjà pris.' }, 409)
    return c.json(openSession(account), 201)
  })

  // Les mots de passe faux, par nom de joueur : de quoi freiner qui voudrait en deviner un.
  const failures = new Map<string, { count: number; since: number }>()

  function isLocked(key: string, now: number): boolean {
    const failed = failures.get(key)
    return failed !== undefined && failed.count >= LOGIN_MAX_FAILURES && now - failed.since < LOGIN_LOCK_MS
  }

  function recordFailure(key: string, now: number) {
    const failed = failures.get(key)
    if (failed && now - failed.since < LOGIN_LOCK_MS) failed.count++
    else failures.set(key, { count: 1, since: now })
    // On oublie les essais trop anciens, pour ne pas remplir la mémoire.
    if (failures.size > 10_000) {
      for (const [other, entry] of failures) if (now - entry.since >= LOGIN_LOCK_MS) failures.delete(other)
    }
  }

  app.post('/api/sessions', async (c) => {
    const body = await readJson(c)
    const key = nameKey(textField(body, 'name'))
    if (isLocked(key, clock())) return c.json({ error: 'Trop d’essais : réessaie dans un quart d’heure.' }, 429)

    const account = store.findAccount(key)
    if (!account || !(await verifyPassword(textField(body, 'password'), account.passwordHash))) {
      recordFailure(key, clock())
      return c.json({ error: 'Nom ou mot de passe incorrect.' }, 401)
    }
    failures.delete(key)
    return c.json(openSession(account))
  })

  /** Pour les adresses réservées aux joueurs connectés : retrouve le compte grâce au jeton. */
  const signedIn = createMiddleware<Env>(async (c, next) => {
    const token = /^Bearer (\S+)$/.exec(c.req.header('Authorization') ?? '')?.[1]
    const tokenHash = token ? hashToken(token) : ''
    const now = clock()
    const account = token ? store.findSession(tokenHash, now - SESSION_IDLE_MS) : null
    if (!account) return c.json({ error: 'Connecte-toi pour jouer.' }, 401)
    store.touchSession(tokenHash, now)
    c.set('account', account)
    c.set('tokenHash', tokenHash)
    await next()
  })

  app.delete('/api/sessions/current', signedIn, (c) => {
    store.deleteSession(c.get('tokenHash'))
    return c.body(null, 204)
  })

  // --- La partie ---

  /** La partie du joueur, ou null s'il n'a pas encore choisi sa race. */
  function loadGame(account: Account): GameState | null {
    return restoreState(store.loadGame(account.id))
  }

  app.get('/api/game', signedIn, (c) => {
    const account = c.get('account')
    const now = clock()
    const game = loadGame(account)
    // La partie part telle qu'elle était à la dernière visite : le navigateur la fait avancer lui-même
    // jusqu'à maintenant, avec les mêmes règles, et résume au joueur ce qui s'est passé entre les deux.
    // Le serveur, lui, enregistre la partie à jour : c'est la nouvelle « dernière visite ».
    if (game) store.saveGame(account.id, advance(game, now), now)
    return c.json({ player: { name: account.name }, game, now })
  })

  app.post('/api/game', signedIn, async (c) => {
    const chosen = textField(await readJson(c), 'race')
    const race = RACES.find((r) => r.id === chosen)
    if (!race) return c.json({ error: 'Cette race n’existe pas.' }, 400)
    const account = c.get('account')
    if (loadGame(account)) return c.json({ error: 'Tu as déjà une partie en cours.' }, 409)

    const now = clock()
    const game = newGame(race.id, now)
    store.saveGame(account.id, game, now)
    return c.json({ game, now }, 201)
  })

  app.post('/api/game/actions', signedIn, async (c) => {
    const action = parseAction(await readJson(c))
    if (!action) return c.json({ error: 'Cet ordre n’existe pas.' }, 400)
    const account = c.get('account')

    // Lire la partie, appliquer l'ordre et l'enregistrer se fait d'un seul bloc, sans « await » :
    // deux ordres arrivés en même temps passent donc l'un après l'autre, sans se mélanger.
    const game = loadGame(account)
    if (!game) return c.json({ error: 'Choisis d’abord ta race.' }, 409)
    const now = clock()
    const result = performAction(game, action, now)
    store.saveGame(account.id, result.state, now)
    if (!result.ok) return c.json({ ok: false, reason: result.reason, game: result.state, now })
    return c.json({ ok: true, game: result.state, now })
  })

  app.delete('/api/game', signedIn, (c) => {
    store.deleteGame(c.get('account').id)
    return c.body(null, 204)
  })

  app.all('/api/*', (c) => c.json({ error: 'Cette adresse n’existe pas.' }, 404))

  // --- Le jeu lui-même (les fichiers construits par `npm run build`) ---

  if (staticDir) {
    // Les fichiers de assets/ changent de nom à chaque version du jeu : le navigateur peut les garder.
    // La page, elle, doit être redemandée à chaque fois, pour charger la dernière version.
    app.use('*', async (c, next) => {
      await next()
      if (c.res.status !== 200) return
      c.header('Cache-Control', c.req.path.startsWith('/assets/') ? 'public, max-age=31536000, immutable' : 'no-cache')
    })
    app.use('*', serveStatic({ root: staticDir }))
  }

  app.onError((error, c) => {
    console.error(error)
    return c.json({ error: 'Le serveur a rencontré un problème.' }, 500)
  })

  return app
}

/** Le corps JSON de la requête, ou undefined s'il est absent ou mal formé. */
async function readJson(c: Context): Promise<unknown> {
  try {
    return await c.req.json()
  } catch {
    return undefined
  }
}

/** Un champ texte de ce corps, ou '' s'il manque ou n'est pas du texte. */
function textField(body: unknown, key: string): string {
  const value = typeof body === 'object' && body !== null ? (body as Record<string, unknown>)[key] : undefined
  return typeof value === 'string' ? value : ''
}
