// Relire une partie enregistrée, dans le navigateur ou sur le serveur, même si c'est une
// version plus ancienne du jeu qui l'a enregistrée.

import { RACES, START_LEVELS, type Army, type CampId, type RaceId, type Resources } from './config.ts'
import {
  emptyArmy,
  emptyResources,
  emptyTechs,
  getCamp,
  type BattleReport,
  type Expedition,
  type GameState,
  type Training,
} from './rules.ts'

/** Une armée enregistrée avant les bandes de monstres : elle ne pouvait aller qu'à un camp. */
interface OldExpedition {
  camp: CampId
  troops: Army
  departedAt: number
  arrivesAt: number
  returnsAt: number
  /** Rempli après la bataille : les survivants et le butin, sur le chemin du retour. */
  result: { survivors: Army; loot: Partial<Resources> } | null
}

/** Un rapport enregistré par une version plus ancienne : il ne nommait qu'un camp. */
type SavedReport = Partial<BattleReport> & { camp?: CampId }

/** Une partie enregistrée, peut-être par une version plus ancienne du jeu. */
type SavedState = Partial<Omit<GameState, 'expeditions' | 'reports'>> & {
  race: RaceId
  updatedAt: number
  expeditions?: (Expedition | OldExpedition)[]
  reports?: SavedReport[]
  /** Avant, un seul entraînement à la fois. */
  training?: Training | null
  /** Avant, une seule armée en campagne. */
  expedition?: OldExpedition | null
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
    // Les armées parties avant l'arrivée des bandes reçoivent ici leur numéro.
    let nextId = state.nextId ?? 1
    const expeditions = (state.expeditions ?? (state.expedition ? [state.expedition] : [])).map((e) =>
      'target' in e ? e : upgradeExpedition(e, nextId++),
    )
    return {
      race: state.race,
      resources: { ...emptyResources(), ...state.resources },
      levels: { ...START_LEVELS, ...state.levels },
      construction: state.construction ?? null,
      techs: { ...emptyTechs(), ...state.techs },
      research: state.research ?? null,
      troops: { ...emptyArmy(), ...state.troops },
      trainings: state.trainings ?? (state.training ? [state.training] : []),
      expeditions,
      reports: (state.reports ?? []).filter((report) => report.foe || report.camp).map(upgradeReport),
      // Avant les bandes de monstres, la carte était vide : elles arrivent peu à peu.
      bands: state.bands ?? [],
      nextBandAt: state.nextBandAt === undefined ? state.updatedAt : state.nextBandAt,
      seed: state.seed ?? state.updatedAt | 0,
      nextId,
      updatedAt: state.updatedAt,
    }
  } catch {
    // Une partie abîmée (un champ qui n'a pas la bonne forme) : on ne peut pas la relire.
    return null
  }
}

function upgradeExpedition(old: OldExpedition, id: number): Expedition {
  return {
    id,
    target: { type: 'camp', camp: old.camp },
    foe: { type: 'camp', camp: old.camp },
    destination: { ...getCamp(old.camp).position },
    troops: old.result?.survivors ?? old.troops,
    loot: old.result?.loot ?? {},
    departedAt: old.departedAt,
    arrivesAt: old.arrivesAt,
    returnsAt: old.returnsAt,
    returning: Boolean(old.result),
    fought: [],
  }
}

function upgradeReport(report: SavedReport): BattleReport {
  const { camp, ...rest } = report
  return {
    ...rest,
    army: report.army ?? 0,
    foe: report.foe ?? { type: 'camp', camp: camp as CampId },
    ambush: report.ambush ?? false,
    // Les rapports d'avant le journal du combat n'ont ni manches ni liste des monstres.
    enemies: report.enemies ?? {},
    starving: report.starving ?? false,
    rounds: report.rounds ?? [],
  } as BattleReport
}
