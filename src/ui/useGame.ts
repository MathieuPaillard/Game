// Fait le lien entre les règles du jeu et l'écran : garde la partie en mémoire,
// fait avancer le temps chaque seconde et sauvegarde dans le navigateur.

import { onMounted, onUnmounted, shallowRef } from 'vue'
import { RACES, RESOURCE_IDS, START_LEVELS, type BuildingId, type RaceId, type Resources } from '../game/config'
import { advance, checkUpgrade, emptyResources, newGame, startUpgrade, type GameState } from '../game/rules'

const SAVE_KEY = 'royaume-sauvegarde'
// À augmenter si le format de la sauvegarde change de façon incompatible :
// les anciennes sauvegardes sont alors ignorées.
const SAVE_VERSION = 1
// En dessous d'une minute d'absence, pas de résumé « pendant ton absence ».
const AWAY_REPORT_MIN_MS = 60 * 1000

/** Ce que le royaume a produit pendant que le joueur n'était pas là. */
export interface AwayReport {
  duration: number
  gains: Resources
  finished: { building: BuildingId; level: number } | null
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
      if (!state.value) return
      const t = Date.now()
      const current = advance(state.value, t)
      if (checkUpgrade(current, building).ok) update(startUpgrade(current, building, t))
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

function loadSave(): GameState | null {
  try {
    const raw = localStorage.getItem(SAVE_KEY)
    if (!raw) return null
    const save = JSON.parse(raw) as { version?: number; state?: GameState }
    const state = save.state
    if (save.version !== SAVE_VERSION || !state) return null
    if (!RACES.some((race) => race.id === state.race)) return null
    // Complète la sauvegarde avec ce qui a pu être ajouté au jeu depuis (nouveaux bâtiments…).
    return {
      ...state,
      levels: { ...START_LEVELS, ...state.levels },
      resources: { ...emptyResources(), ...state.resources },
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
  const works = before.construction
  const finished = works && !after.construction ? { building: works.building, level: works.targetLevel } : null
  return { duration, gains, finished }
}
