import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { RAID_GATES, RAID_SPEED, RESOURCE_IDS, WORLD, type BuildingId } from '../src/game/config.ts'
import {
  distance,
  emptyArmy,
  emptyResources,
  getBuilding,
  newGame,
  upgradeDuration,
  type Band,
  type GameState,
} from '../src/game/rules.ts'
import { createApp, LOGIN_LOCK_MS, LOGIN_MAX_FAILURES, SESSION_IDLE_MS } from './app.ts'
import { nameKey } from './auth.ts'
import { openStore } from './db.ts'

const T0 = Date.UTC(2026, 0, 1)

/** Un serveur complet, avec une base de données en mémoire et une horloge qu'on avance à la main. */
function testServer(staticDir?: string) {
  const store = openStore(':memory:')
  let time = T0
  // Une empreinte de mot de passe allégée : les tests vont plus vite.
  const app = createApp({ store, clock: () => time, staticDir, hashing: { N: 1024, r: 8, p: 1 } })

  async function call(method: string, path: string, options: { token?: string; body?: unknown } = {}) {
    const { token, body } = options
    const response = await app.request(path, {
      method,
      headers: { 'Content-Type': 'application/json', ...(token && { Authorization: `Bearer ${token}` }) },
      body: body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body),
    })
    const text = await response.text()
    const json = response.headers.get('Content-Type')?.includes('json')
    return { status: response.status, data: json && text ? JSON.parse(text) : text, headers: response.headers }
  }

  return {
    store,
    app,
    call,
    wait(ms: number) {
      time += ms
    },
    async register(name = 'Arthur', password = 'excalibur') {
      const { status, data } = await call('POST', '/api/accounts', { body: { name, password } })
      expect(status).toBe(201)
      return data.token as string
    },
    /** Remplace la partie d'un joueur, pour tester sans dépendre de l'équilibrage du jeu. */
    giveGame(name: string, state: GameState) {
      const account = store.findAccount(nameKey(name))
      if (!account) throw new Error(`Pas de compte ${name}`)
      store.saveGame(account.id, state, time)
    },
  }
}

/** Une partie aux ressources illimitées. */
function richGame(levels: Partial<Record<BuildingId, number>> = {}): GameState {
  const game = newGame('humans', T0)
  const resources = emptyResources()
  for (const id of RESOURCE_IDS) resources[id] = 1e9
  return { ...game, resources, levels: { ...game.levels, ...levels } }
}

describe('les comptes', () => {
  it('crée un compte, puis s’y connecte', async () => {
    const server = testServer()
    const created = await server.call('POST', '/api/accounts', { body: { name: 'Arthur', password: 'excalibur' } })
    expect(created.status).toBe(201)
    expect(created.data.player).toEqual({ name: 'Arthur' })

    const login = await server.call('POST', '/api/sessions', { body: { name: 'arthur', password: 'excalibur' } })
    expect(login.status).toBe(200)
    expect(login.data.player).toEqual({ name: 'Arthur' })
    expect(login.data.token).not.toBe(created.data.token)

    for (const token of [created.data.token, login.data.token]) {
      expect((await server.call('GET', '/api/game', { token })).status).toBe(200)
    }
  })

  it('refuse un nom déjà pris, même écrit autrement', async () => {
    const server = testServer()
    await server.register('Arthur')
    for (const name of ['Arthur', 'arthur', '  ARTHUR ']) {
      const response = await server.call('POST', '/api/accounts', { body: { name, password: 'autre-mot-de-passe' } })
      expect(response).toMatchObject({ status: 409, data: { error: 'Ce nom est déjà pris.' } })
    }
  })

  it('vérifie le nom et le mot de passe', async () => {
    const server = testServer()
    const refused = [
      { name: 'Al', password: 'excalibur' },
      { name: 'Un nom beaucoup trop long', password: 'excalibur' },
      { name: '<script>', password: 'excalibur' },
      { name: '-Arthur-', password: 'excalibur' },
      { name: 'Arthur', password: 'court' },
      { name: 42, password: 'excalibur' },
      {},
    ]
    for (const body of refused) {
      const response = await server.call('POST', '/api/accounts', { body })
      expect(response.status, JSON.stringify(body)).toBe(400)
      expect(response.data.error).toEqual(expect.any(String))
    }
    // Les espaces en trop disparaissent ; les accents et les apostrophes sont permis.
    const created = await server.call('POST', '/api/accounts', {
      body: { name: '  Éléonore   d’Avalon ', password: 'excalibur' },
    })
    expect(created).toMatchObject({ status: 201, data: { player: { name: 'Éléonore d’Avalon' } } })
  })

  it('ne garde jamais un mot de passe en clair', async () => {
    const server = testServer()
    await server.register('Arthur', 'excalibur')
    const hash = server.store.findAccount('arthur')?.passwordHash ?? ''
    expect(hash).toMatch(/^scrypt\$/)
    expect(hash).not.toContain('excalibur')
  })

  it('refuse un mauvais mot de passe, ou un nom inconnu', async () => {
    const server = testServer()
    await server.register('Arthur', 'excalibur')
    for (const body of [
      { name: 'Arthur', password: 'mauvais-mot' },
      { name: 'Lancelot', password: 'excalibur' },
    ]) {
      const response = await server.call('POST', '/api/sessions', { body })
      expect(response).toMatchObject({ status: 401, data: { error: 'Nom ou mot de passe incorrect.' } })
    }
  })

  it('fait patienter qui essaie de deviner un mot de passe', async () => {
    const server = testServer()
    await server.register('Arthur', 'excalibur')
    const attempt = (password: string) => server.call('POST', '/api/sessions', { body: { name: 'Arthur', password } })
    for (let i = 0; i < LOGIN_MAX_FAILURES; i++) expect((await attempt(`essai-${i}`)).status).toBe(401)
    // Même le bon mot de passe doit attendre.
    expect((await attempt('excalibur')).status).toBe(429)
    server.wait(LOGIN_LOCK_MS)
    expect((await attempt('excalibur')).status).toBe(200)
  })

  it('compte les essais envoyés tous en même temps', async () => {
    const server = testServer()
    await server.register('Arthur', 'excalibur')
    const attempts = Array.from({ length: 3 * LOGIN_MAX_FAILURES }, (_, i) =>
      server.call('POST', '/api/sessions', { body: { name: 'Arthur', password: i === 25 ? 'excalibur' : `essai-${i}` } }),
    )
    const statuses = (await Promise.all(attempts)).map((response) => response.status)
    // Seuls les dix premiers essais sont vérifiés : le bon mot de passe, envoyé plus tard, attend son tour.
    expect(statuses.filter((status) => status === 401)).toHaveLength(LOGIN_MAX_FAILURES)
    expect(statuses.filter((status) => status === 429)).toHaveLength(2 * LOGIN_MAX_FAILURES)
  })

  it('ne retient pas les essais pour des noms sans compte, et refuse vite un nom déjà pris', async () => {
    const server = testServer()
    await server.register('Arthur', 'excalibur')
    for (let i = 0; i < 2 * LOGIN_MAX_FAILURES; i++) {
      expect((await server.call('POST', '/api/sessions', { body: { name: 'Lancelot', password: `essai-${i}` } })).status).toBe(401)
    }
    expect((await server.call('POST', '/api/accounts', { body: { name: 'arthur', password: 'autre mot de passe' } })).status).toBe(409)
  })

  it('n’accepte que du JSON', async () => {
    const server = testServer()
    const response = await server.app.request('/api/accounts', {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify({ name: 'Arthur', password: 'excalibur' }),
    })
    expect(response.status).toBe(415)
  })

  it('réserve la partie aux joueurs connectés', async () => {
    const server = testServer()
    expect((await server.call('GET', '/api/game')).status).toBe(401)
    expect((await server.call('GET', '/api/game', { token: 'jeton-invente' })).status).toBe(401)
    expect((await server.call('POST', '/api/game', { body: { race: 'elves' } })).status).toBe(401)
    expect((await server.call('POST', '/api/game/actions', { body: { type: 'upgrade', building: 'farm' } })).status).toBe(
      401,
    )
  })

  it('se déconnecter rend le jeton inutilisable', async () => {
    const server = testServer()
    const token = await server.register()
    expect((await server.call('DELETE', '/api/sessions/current', { token })).status).toBe(204)
    expect((await server.call('GET', '/api/game', { token })).status).toBe(401)
  })

  it('oublie une session qui ne sert plus pendant 30 jours', async () => {
    const server = testServer()
    const token = await server.register()
    // Une session qui sert reste ouverte…
    server.wait(SESSION_IDLE_MS - 1000)
    expect((await server.call('GET', '/api/game', { token })).status).toBe(200)
    server.wait(SESSION_IDLE_MS - 1000)
    expect((await server.call('GET', '/api/game', { token })).status).toBe(200)
    // … mais pas une session oubliée.
    server.wait(SESSION_IDLE_MS + 1000)
    expect((await server.call('GET', '/api/game', { token })).status).toBe(401)
  })
})

describe('la partie', () => {
  it('commence avec la race choisie, une seule fois', async () => {
    const server = testServer()
    const token = await server.register()
    expect((await server.call('GET', '/api/game', { token })).data).toMatchObject({
      player: { name: 'Arthur' },
      game: null,
      now: T0,
    })
    expect((await server.call('POST', '/api/game', { token, body: { race: 'dragons' } })).status).toBe(400)

    const started = await server.call('POST', '/api/game', { token, body: { race: 'elves' } })
    expect(started.status).toBe(201)
    expect(started.data.game).toEqual(newGame('elves', T0))
    expect((await server.call('POST', '/api/game', { token, body: { race: 'orcs' } })).status).toBe(409)
    expect((await server.call('GET', '/api/game', { token })).data.game.race).toBe('elves')
  })

  it('applique les ordres avec les règles du jeu', async () => {
    const server = testServer()
    const token = await server.register()
    server.giveGame('Arthur', richGame({ castle: 3 }))
    const upgrade = { type: 'upgrade', building: 'farm' }

    const first = await server.call('POST', '/api/game/actions', { token, body: upgrade })
    expect(first.status).toBe(200)
    expect(first.data).toMatchObject({ ok: true, now: T0, game: { constructions: [{ building: 'farm', targetLevel: 2 }] } })

    // Un second chantier est refusé, avec la raison donnée par les règles.
    const second = await server.call('POST', '/api/game/actions', { token, body: { type: 'upgrade', building: 'quarry' } })
    expect(second.data).toMatchObject({ ok: false, reason: 'Un chantier est déjà en cours' })
    expect(second.data.game.constructions.map((c: { building: string }) => c.building)).toEqual(['farm'])

    // Le temps passe sur le serveur : le chantier se termine, même sans personne.
    server.wait(upgradeDuration(first.data.game, getBuilding('farm'), 2))
    const third = await server.call('POST', '/api/game/actions', { token, body: { type: 'upgrade', building: 'quarry' } })
    expect(third.data.ok).toBe(true)
    expect(third.data.game.levels.farm).toBe(2)
  })

  it('envoie une armée attaquer une bande de monstres', async () => {
    const server = testServer()
    const token = await server.register()
    const game = { ...richGame(), troops: { ...emptyArmy(), warrior: 50 } }
    const band = game.bands[0]
    server.giveGame('Arthur', game)
    const attack = { type: 'march', target: { type: 'band', band: band.id }, troops: { warrior: 20 } }
    const response = await server.call('POST', '/api/game/actions', { token, body: attack })
    expect(response.data.ok).toBe(true)
    const sent = response.data.game.armies[0]
    expect(sent).toMatchObject({ order: { type: 'band', band: band.id }, status: 'marching', troops: { warrior: 20 } })

    // Un nouvel ordre pour l'armée dehors : rentrer à la cité.
    const recall = { type: 'order', army: sent.id, target: { type: 'city' } }
    const recalled = await server.call('POST', '/api/game/actions', { token, body: recall })
    expect(recalled.data.ok).toBe(true)
    expect(recalled.data.game.armies[0].order).toEqual({ type: 'city' })
    // Une bande qui n'existe pas : l'ordre est refusé par les règles.
    const ghost = { ...attack, target: { type: 'band', band: 999 } }
    const refused = await server.call('POST', '/api/game/actions', { token, body: ghost })
    expect(refused.data).toMatchObject({ ok: false, reason: 'Cette bande n’est plus là' })
  })

  it('recrute un héros, lui fait apprendre une compétence, puis l’envoie mener une armée', async () => {
    const server = testServer()
    const token = await server.register()
    const game = richGame({ castle: 5 })
    // Deux armées possibles : la seconde est refusée à cause du héros, pas faute de place.
    const techs = { ...game.techs, command: 1 }
    server.giveGame('Arthur', { ...game, techs, troops: { ...emptyArmy(), warrior: 30 } })
    const act = (body: unknown) => server.call('POST', '/api/game/actions', { token, body })

    expect((await act({ type: 'recruit', hero: 'ysolde' })).data.game.heroes).toEqual([
      { id: 'ysolde', level: 1, xp: 0, skills: {} },
    ])
    expect((await act({ type: 'skill', hero: 'ysolde', skill: 'rally' })).data.game.heroes[0].skills).toEqual({ rally: 1 })
    const march = { type: 'march', target: { type: 'camp', camp: 'wolfDen' }, troops: { warrior: 10 }, hero: 'ysolde' }
    const sent = await act(march)
    expect(sent.data.ok).toBe(true)
    expect(sent.data.game.armies[0].hero).toBe('ysolde')
    // Le même héros ne peut pas mener deux armées.
    expect((await act(march)).data).toMatchObject({ ok: false, reason: 'Ysolde de Valcourt mène déjà une armée' })
  })

  it('fait assiéger la cité par un raid, même sans personne, et garde les troupes aux remparts', async () => {
    const server = testServer()
    const token = await server.register()
    // Un raid à une seconde des portes, assez fort pour que le siège dure un moment.
    const home = RAID_GATES[0]
    const raid: Band = {
      id: 900,
      kind: 'trolls',
      level: 2,
      home,
      monsters: { troll: 72 },
      phase: distance(home, WORLD.city) - RAID_SPEED,
      since: T0,
      direction: 1,
      raid: true,
      encampment: false,
      still: false,
      chase: null,
    }
    const game = richGame({ castle: 4, walls: 2 })
    server.giveGame('Arthur', { ...game, bands: [raid], nextBandAt: null, troops: { ...emptyArmy(), warrior: 400 } })
    const march = { type: 'march', target: { type: 'camp', camp: 'wolfDen' }, troops: { warrior: 10 } }

    server.wait(5000)
    const besieged = await server.call('POST', '/api/game/actions', { token, body: march })
    expect(besieged.data).toMatchObject({ ok: false, reason: 'La cité est assiégée : tes troupes défendent les remparts' })
    expect(besieged.data.game.battles[0]).toMatchObject({ allies: [{ army: null, siege: { guards: 16 } }], foes: [{ band: 900 }] })

    // Le siège se termine sur le serveur, et les troupes peuvent de nouveau sortir.
    server.wait(10 * 60 * 1000)
    const after = await server.call('POST', '/api/game/actions', { token, body: march })
    expect(after.data.ok).toBe(true)
    expect(after.data.game.reports[0]).toMatchObject({ army: null, outcome: 'victory', siege: { guards: 16 } })
    expect(after.data.game.stats.raidsRepelled).toBe(1)
  })

  it('refuse les ordres mal formés', async () => {
    const server = testServer()
    const token = await server.register()
    server.giveGame('Arthur', richGame({ castle: 5 }))
    for (const body of [{ type: 'upgrade', building: 'dragonTower' }, { type: 'cheat' }, '{pas du json', '']) {
      const response = await server.call('POST', '/api/game/actions', { token, body })
      expect(response.status, JSON.stringify(body)).toBe(400)
    }
    const huge = { type: 'upgrade', building: 'farm', padding: 'x'.repeat(20_000) }
    expect((await server.call('POST', '/api/game/actions', { token, body: huge })).status).toBe(413)
  })

  it('ne se laisse pas dicter la partie', async () => {
    const server = testServer()
    const token = await server.register()
    await server.call('POST', '/api/game', { token, body: { race: 'humans' } })
    // Des champs ajoutés à l'ordre pour se donner de l'or : ils sont ignorés.
    const forged = { type: 'upgrade', building: 'castle', resources: { gold: 1e9 }, levels: { castle: 10 } }
    const response = await server.call('POST', '/api/game/actions', { token, body: forged })
    const game = response.data.game as GameState
    expect(game.levels.castle).toBe(1)
    expect(game.resources.gold).toBeLessThan(newGame('humans', T0).resources.gold + 1)
  })

  it('renvoie la partie de la dernière visite, et retient la nouvelle', async () => {
    const server = testServer()
    const token = await server.register()
    await server.call('POST', '/api/game', { token, body: { race: 'humans' } })
    const hour = 60 * 60 * 1000
    server.wait(hour)
    const first = await server.call('GET', '/api/game', { token })
    expect(first.data.game.updatedAt).toBe(T0)
    expect(first.data.now).toBe(T0 + hour)
    server.wait(hour)
    const second = await server.call('GET', '/api/game', { token })
    expect(second.data.game.updatedAt).toBe(T0 + hour)
  })

  it('efface la partie pour recommencer', async () => {
    const server = testServer()
    const token = await server.register()
    await server.call('POST', '/api/game', { token, body: { race: 'humans' } })
    expect((await server.call('DELETE', '/api/game', { token })).status).toBe(204)
    expect((await server.call('GET', '/api/game', { token })).data.game).toBeNull()
    expect((await server.call('POST', '/api/game', { token, body: { race: 'dwarves' } })).status).toBe(201)
  })

  it('donne à chaque joueur sa propre partie', async () => {
    const server = testServer()
    const arthur = await server.register('Arthur')
    const morgane = await server.register('Morgane')
    await server.call('POST', '/api/game', { token: arthur, body: { race: 'humans' } })
    await server.call('POST', '/api/game', { token: morgane, body: { race: 'elves' } })
    await server.call('POST', '/api/game/actions', { token: arthur, body: { type: 'upgrade', building: 'castle' } })
    expect((await server.call('GET', '/api/game', { token: arthur })).data.game.constructions).toHaveLength(1)
    expect((await server.call('GET', '/api/game', { token: morgane })).data.game).toMatchObject({
      race: 'elves',
      constructions: [],
    })
  })
})

describe('le reste', () => {
  it('répond en JSON aux adresses inconnues', async () => {
    const response = await testServer().call('GET', '/api/tresor')
    expect(response).toMatchObject({ status: 404, data: { error: expect.any(String) } })
  })

  it('envoie les fichiers du jeu construit', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'royaume-'))
    mkdirSync(join(dir, 'assets'))
    writeFileSync(join(dir, 'index.html'), '<!doctype html><title>Royaume</title>')
    writeFileSync(join(dir, 'assets', 'jeu-1234.js'), 'console.log("royaume")')
    const server = testServer(dir)

    const page = await server.call('GET', '/')
    expect(page.status).toBe(200)
    expect(page.data).toContain('<title>Royaume</title>')
    expect(page.headers.get('Cache-Control')).toBe('no-cache')
    const script = await server.call('GET', '/assets/jeu-1234.js')
    expect(script.headers.get('Cache-Control')).toContain('immutable')
    expect((await server.call('GET', '/../package.json')).status).toBe(404)
    expect((await server.call('GET', '/%2e%2e/package.json')).status).toBe(404)
  })
})
