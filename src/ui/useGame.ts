// Fait le lien entre les règles du jeu et l'écran : garde la partie en mémoire,
// fait avancer le temps chaque seconde et sauvegarde dans le navigateur.

import { onMounted, onUnmounted, shallowRef } from 'vue'
import {
  RACES,
  RESOURCE_IDS,
  START_LEVELS,
  type Army,
  type BuildingId,
  type CampId,
  type RaceId,
  type Resources,
  type TechId,
  type UnitId,
} from '../game/config'
import {
  advance,
  armySize,
  checkDismiss,
  checkExpedition,
  checkResearch,
  checkTraining,
  checkUpgrade,
  dismissTroops,
  emptyArmy,
  emptyResources,
  emptyTechs,
  getBuilding,
  getCamp,
  getTech,
  getUnit,
  newGame,
  startExpedition,
  startResearch,
  startTraining,
  startUpgrade,
  type Check,
  type Expedition,
  type GameState,
  type Training,
} from '../game/rules'

const SAVE_KEY = 'royaume-sauvegarde'
// À augmenter si le format de la sauvegarde change de façon incompatible :
// les anciennes sauvegardes sont alors ignorées.
const SAVE_VERSION = 1
// En dessous d'une minute d'absence, pas de résumé « pendant ton absence ».
const AWAY_REPORT_MIN_MS = 60 * 1000

/** Ce qui s'est passé pendant que le joueur n'était pas là. */
export interface AwayReport {
  duration: number
  gains: Resources
  events: string[]
}

export function useGame() {
  const now = shallowRef(Date.now())
  const saved = loadSave()
  const state = shallowRef<GameState | null>(saved ? advance(saved, now.value) : null)
  const awayReport = shallowRef<AwayReport | null>(
    saved && state.value ? makeAwayReport(saved, state.value) : null,
  )

  function update(next: GameState | null) {
    state.value = next
    writeSave(next)
  }

  function tick() {
    now.value = Date.now()
    if (state.value) update(advance(state.value, now.value))
  }

  /** Lance une action du joueur, si elle est possible à cet instant. */
  function act(check: (s: GameState) => Check, run: (s: GameState, t: number) => GameState) {
    if (!state.value) return
    const t = Date.now()
    const current = advance(state.value, t)
    if (check(current).ok) update(run(current, t))
  }

  let timer: number | undefined
  onMounted(() => {
    timer = window.setInterval(tick, 1000)
    document.addEventListener('visibilitychange', tick)
  })
  onUnmounted(() => {
    window.clearInterval(timer)
    document.removeEventListener('visibilitychange', tick)
  })

  return {
    state,
    now,
    awayReport,
    chooseRace(race: RaceId) {
      update(newGame(race, Date.now()))
    },
    upgrade(building: BuildingId) {
      act(
        (s) => checkUpgrade(s, building),
        (s, t) => startUpgrade(s, building, t),
      )
    },
    research(tech: TechId) {
      act(
        (s) => checkResearch(s, tech),
        (s, t) => startResearch(s, tech, t),
      )
    },
    train(unit: UnitId, count: number) {
      act(
        (s) => checkTraining(s, unit, count),
        (s, t) => startTraining(s, unit, count, t),
      )
    },
    attack(camp: CampId, troops: Army) {
      act(
        (s) => checkExpedition(s, camp, troops),
        (s, t) => startExpedition(s, camp, troops, t),
      )
    },
    dismiss(troops: Army) {
      act(
        (s) => checkDismiss(s, troops),
        (s, t) => dismissTroops(s, troops, t),
      )
    },
    restart() {
      awayReport.value = null
      update(null)
    },
    dismissAwayReport() {
      awayReport.value = null
    },
  }
}

/** Une partie sauvegardée, peut-être par une version plus ancienne du jeu. */
type SavedState = Partial<GameState> & {
  race: RaceId
  updatedAt: number
  /** Avant, un seul entraînement à la fois. */
  training?: Training | null
  /** Avant, une seule armée en campagne. */
  expedition?: Expedition | null
}

function loadSave(): GameState | null {
  try {
    const raw = localStorage.getItem(SAVE_KEY)
    if (!raw) return null
    const save = JSON.parse(raw) as { version?: number; state?: SavedState }
    const state = save.state
    if (save.version !== SAVE_VERSION || !state || typeof state.updatedAt !== 'number') return null
    if (!RACES.some((race) => race.id === state.race)) return null
    // On reconstruit la partie champ par champ : ce qui manque dans une sauvegarde plus ancienne
    // prend sa valeur par défaut, et ce qui n'existe plus dans le jeu est oublié.
    return {
      race: state.race,
      resources: { ...emptyResources(), ...state.resources },
      levels: { ...START_LEVELS, ...state.levels },
      construction: state.construction ?? null,
      techs: { ...emptyTechs(), ...state.techs },
      research: state.research ?? null,
      troops: { ...emptyArmy(), ...state.troops },
      trainings: state.trainings ?? (state.training ? [state.training] : []),
      expeditions: state.expeditions ?? (state.expedition ? [state.expedition] : []),
      // Les rapports d'avant le journal du combat n'ont ni manches ni liste des monstres.
      reports: (state.reports ?? []).map((report) => ({
        ...report,
        enemies: report.enemies ?? {},
        starving: report.starving ?? false,
        rounds: report.rounds ?? [],
      })),
      updatedAt: state.updatedAt,
    }
  } catch {
    return null
  }
}

function writeSave(state: GameState | null) {
  try {
    if (state) localStorage.setItem(SAVE_KEY, JSON.stringify({ version: SAVE_VERSION, state }))
    else localStorage.removeItem(SAVE_KEY)
  } catch {
    // Stockage indisponible (navigation privée…) : on joue quand même, sans sauvegarde.
  }
}

function makeAwayReport(before: GameState, after: GameState): AwayReport | null {
  const duration = after.updatedAt - before.updatedAt
  if (duration < AWAY_REPORT_MIN_MS) return null

  const gains = emptyResources()
  for (const id of RESOURCE_IDS) gains[id] = after.resources[id] - before.resources[id]

  const events: string[] = []
  const works = before.construction
  if (works && !after.construction) {
    events.push(`${getBuilding(works.building).name} : le niveau ${works.targetLevel} est terminé.`)
  }
  const research = before.research
  if (research && !after.research) {
    events.push(`Recherche terminée : ${getTech(research.tech).name}, niveau ${research.targetLevel}.`)
  }
  for (const training of before.trainings) {
    const finished = !after.trainings.some((t) => t.unit === training.unit && t.startedAt === training.startedAt)
    if (finished) events.push(`Entraînement terminé : ${getUnit(training.unit).name} +${training.count}.`)
  }
  for (const report of after.reports.filter((r) => r.at > before.updatedAt).reverse()) {
    events.push(`${report.victory ? 'Victoire' : 'Défaite'} contre : ${getCamp(report.camp).name}.`)
  }
  for (const expedition of before.expeditions) {
    if (after.expeditions.some((e) => e.camp === expedition.camp && e.departedAt === expedition.departedAt)) continue
    const report = after.reports.find((r) => r.at === expedition.arrivesAt && r.camp === expedition.camp)
    const survived = report !== undefined && armySize(report.sent) > armySize(report.lost)
    if (expedition.result || survived) {
      events.push(`Ton armée est rentrée de : ${getCamp(expedition.camp).name}.`)
    }
  }
  return { duration, gains, events }
}
