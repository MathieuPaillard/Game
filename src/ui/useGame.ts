// Fait le lien entre les règles du jeu et l'écran. La partie vit à l'un de ces deux endroits :
// - en ligne, sur le serveur : le joueur a un compte, et c'est le serveur qui décide ;
// - sur l'appareil, sans compte : la partie est gardée dans ce navigateur.
// Dans les deux cas, l'écran fait avancer le temps chaque seconde, avec les règles du jeu.

import { onMounted, onUnmounted, shallowRef } from 'vue'
import { performAction, type Action } from '../game/actions'
import type { Army, BuildingId, CampId, RaceId, TechId, UnitId } from '../game/config'
import { advance, newGame, type GameState } from '../game/rules'
import { ONLINE_AVAILABLE, server, ServerError, serverNow, type Session } from './api'
import { makeAwayReport, type AwayReport } from './away'
import { loadLocalGame, loadSession, saveLocalGame, saveSession } from './storage'

/** Ce que montre l'écran : la connexion au compte, l'attente du serveur, ou le jeu. */
export type Screen = 'account' | 'connecting' | 'game'

/** En ligne, l'écran se recale sur le serveur toutes les minutes… */
const SYNC_INTERVAL_MS = 60 * 1000
/** … et réessaie plus souvent quand le serveur ne répond plus. */
const RETRY_INTERVAL_MS = 10 * 1000

export function useGame() {
  let session: Session | null = loadSession()
  const local = session ? null : loadLocalGame()

  const screen = shallowRef<Screen>(session ? 'connecting' : local || !ONLINE_AVAILABLE ? 'game' : 'account')
  /** Le nom du joueur connecté, ou null pour une partie sans compte. */
  const player = shallowRef(session?.player.name ?? null)
  const now = shallowRef(Date.now())
  const state = shallowRef<GameState | null>(local && advance(local, now.value))
  const awayReport = shallowRef<AwayReport | null>(local && state.value ? makeAwayReport(local, state.value) : null)
  /** Un message pour le joueur : un ordre refusé par le serveur, un mot de passe faux… */
  const notice = shallowRef<string | null>(null)
  /** La dernière demande n'a pas atteint le serveur. */
  const offline = shallowRef(false)
  /** Une demande attend sa réponse : connexion, création de compte, choix de la race. */
  const busy = shallowRef(false)

  /** L'heure qui fait foi : celle du serveur en ligne, celle de l'appareil sinon. */
  const clock = () => (session ? serverNow() : Date.now())

  /** Montre la partie ; sans compte, elle est aussi gardée dans le navigateur. */
  function show(next: GameState | null) {
    state.value = next
    if (!session) saveLocalGame(next)
  }

  function tick() {
    now.value = clock()
    if (state.value) show(advance(state.value, now.value))
  }

  // --- Les demandes au serveur ---

  // Elles partent l'une après l'autre, dans l'ordre où le joueur les a faites : la réponse à la
  // dernière montre donc toujours la partie la plus à jour.
  let queue: Promise<void> = Promise.resolve()
  let waiting = 0
  let lastSync = 0

  function enqueue(request: () => Promise<void>): Promise<void> {
    waiting++
    queue = queue
      .then(request)
      .then(() => {
        offline.value = false
      }, handleError)
      .finally(() => {
        waiting--
      })
    return queue
  }

  /** Personne d'autre dans la file : la réponse reçue est la plus récente. */
  const lastInLine = () => waiting === 1

  function handleError(error: unknown) {
    if (!(error instanceof ServerError)) {
      notice.value = 'Quelque chose s’est mal passé. Réessaie.'
      console.error(error)
    } else if (error.status === 401 && session) {
      // La session a expiré, ou a été fermée sur un autre appareil.
      leave('Ta session a expiré : reconnecte-toi.')
    } else if (error.status === 0 || error.status >= 500) {
      offline.value = true
    } else {
      notice.value = error.message
    }
  }

  /** Reçoit la partie du serveur, et la fait avancer jusqu'à maintenant. */
  function receive(game: GameState | null) {
    now.value = serverNow()
    state.value = game && advance(game, now.value)
  }

  /** Recharge la partie depuis le serveur. Au retour du joueur, résume ce qui s'est passé depuis sa dernière visite. */
  function sync(welcome = false) {
    return enqueue(async () => {
      if (!session) return
      const response = await server.game(session.token)
      lastSync = Date.now()
      player.value = response.player.name
      if (lastInLine()) {
        receive(response.game)
        if (welcome && response.game && state.value) awayReport.value = makeAwayReport(response.game, state.value)
      }
      screen.value = 'game'
    })
  }

  /** Applique un ordre du joueur, s'il est possible à cet instant. */
  function perform(action: Action) {
    if (!state.value) return
    const result = performAction(state.value, action, clock())
    // Un ordre impossible ne part pas : l'écran montre déjà pourquoi.
    if (!result.ok) return
    // La partie change tout de suite à l'écran, sans attendre le serveur…
    show(result.state)
    if (!session) return
    // … puis le serveur applique l'ordre à son tour, et c'est sa réponse qui fait foi.
    void enqueue(async () => {
      if (!session) return
      const response = await server.act(session.token, action)
      if (!response.ok) notice.value = `Le serveur a refusé cet ordre : ${response.reason}.`
      if (lastInLine()) receive(response.game)
    })
  }

  // --- Le compte ---

  /** Connexion ou création de compte : le serveur ouvre une session, puis on charge la partie. */
  async function enter(open: () => Promise<Session>) {
    busy.value = true
    notice.value = null
    await enqueue(async () => {
      const opened = await open()
      session = opened
      saveSession(opened)
      player.value = opened.player.name
      state.value = null
      awayReport.value = null
      screen.value = 'connecting'
    })
    if (session) await sync(true)
    busy.value = false
  }

  /** Quitte le compte et revient à l'écran de connexion. La partie sans compte, elle, reste sur l'appareil. */
  function leave(message: string | null) {
    session = null
    saveSession(null)
    player.value = null
    state.value = null
    awayReport.value = null
    notice.value = message
    offline.value = false
    screen.value = 'account'
  }

  async function logout() {
    await enqueue(async () => {
      // Même si le serveur ne répond pas, la session est oubliée sur cet appareil.
      if (session) await server.logout(session.token).catch(() => undefined)
    })
    leave(null)
  }

  // --- Le temps qui passe, et les retours sur le jeu ---

  function onVisibilityChange() {
    tick()
    if (document.visibilityState === 'visible' && session && screen.value === 'game') void sync()
  }

  let timers: number[] = []
  onMounted(() => {
    timers = [
      window.setInterval(tick, 1000),
      window.setInterval(() => {
        if (!session || screen.value === 'account' || waiting > 0 || document.visibilityState !== 'visible') return
        if (offline.value || Date.now() - lastSync >= SYNC_INTERVAL_MS) void sync(screen.value === 'connecting')
      }, RETRY_INTERVAL_MS),
    ]
    document.addEventListener('visibilitychange', onVisibilityChange)
    if (session) void sync(true)
  })
  onUnmounted(() => {
    timers.forEach((timer) => window.clearInterval(timer))
    document.removeEventListener('visibilitychange', onVisibilityChange)
  })

  return {
    screen,
    player,
    state,
    now,
    awayReport,
    notice,
    offline,
    busy,
    login: (name: string, password: string) => enter(() => server.login(name, password)),
    register: (name: string, password: string) => enter(() => server.register(name, password)),
    logout,
    retry: () => sync(true),
    /** Jouer sans compte : la partie est gardée sur cet appareil. */
    playLocally() {
      const saved = loadLocalGame()
      now.value = Date.now()
      state.value = saved && advance(saved, now.value)
      awayReport.value = saved && state.value ? makeAwayReport(saved, state.value) : null
      notice.value = null
      screen.value = 'game'
    },
    /** Depuis une partie sans compte : aller se connecter. */
    showAccount() {
      state.value = null
      awayReport.value = null
      notice.value = null
      screen.value = 'account'
    },
    async chooseRace(race: RaceId) {
      if (!session) {
        show(newGame(race, Date.now()))
        return
      }
      busy.value = true
      await enqueue(async () => {
        if (!session) return
        receive((await server.start(session.token, race)).game)
      })
      // Refusé (une partie existe déjà, peut-être commencée sur un autre appareil) : on la charge.
      if (!state.value && session) await sync()
      busy.value = false
    },
    upgrade: (building: BuildingId) => perform({ type: 'upgrade', building }),
    research: (tech: TechId) => perform({ type: 'research', tech }),
    train: (unit: UnitId, count: number) => perform({ type: 'train', unit, count }),
    attack: (camp: CampId, troops: Army) => perform({ type: 'attack', camp, troops }),
    dismiss: (troops: Army) => perform({ type: 'dismiss', troops }),
    async restart() {
      awayReport.value = null
      if (!session) {
        show(null)
        return
      }
      await enqueue(async () => {
        if (!session) return
        await server.restart(session.token)
        state.value = null
      })
    },
    dismissAwayReport() {
      awayReport.value = null
    },
    dismissNotice() {
      notice.value = null
    },
  }
}
