// Relire une partie enregistrée, dans le navigateur ou sur le serveur, même si c'est une
// version plus ancienne du jeu qui l'a enregistrée.

import { RACES, START_LEVELS, type RaceId } from './config.ts'
import { emptyArmy, emptyResources, emptyTechs, type Expedition, type GameState, type Training } from './rules.ts'

/** Une partie enregistrée, peut-être par une version plus ancienne du jeu. */
type SavedState = Partial<GameState> & {
  race: RaceId
  updatedAt: number
  /** Avant, un seul entraînement à la fois. */
  training?: Training | null
  /** Avant, une seule armée en campagne. */
  expedition?: Expedition | null
}

/**
 * Reconstruit la partie champ par champ : ce qui manque dans une partie enregistrée par une
 * version plus ancienne prend sa valeur par défaut, et ce qui n'existe plus dans le jeu est oublié.
 * Quand l'état de la partie gagne un champ, c'est ici qu'on lui donne sa valeur par défaut.
 * Renvoie null si ce n'est pas une partie.
 */
export function restoreState(saved: unknown): GameState | null {
  if (typeof saved !== 'object' || saved === null) return null
  const state = saved as SavedState
  if (typeof state.updatedAt !== 'number' || !RACES.some((race) => race.id === state.race)) return null
  try {
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
    // Une partie abîmée (un champ qui n'a pas la bonne forme) : on ne peut pas la relire.
    return null
  }
}
