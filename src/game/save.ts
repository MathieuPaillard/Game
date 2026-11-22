// Relire une partie enregistrée, dans le navigateur ou sur le serveur, même si c'est une
// version plus ancienne du jeu qui l'a enregistrée.

import {
  RACES,
  RAID_CASTLE_LEVEL,
  RAID_FIRST_SECONDS,
  START_LEVELS,
  WORLD_TICK_SECONDS,
  type Army,
  type CampId,
  type RaceId,
  type Resources,
} from './config.ts'
import {
  addResources,
  armySize,
  emptyArmy,
  emptyResources,
  emptyStats,
  emptyTechs,
  type Band,
  type BattleReport,
  type Construction,
  type GameState,
  type Training,
} from './rules.ts'

/**
 * Une armée enregistrée par une version d'avant les ordres sur la carte : elle allait vers une
 * cible puis revenait (`troops` et `loot`), ou plus anciennement encore, vers un camp (`result`).
 */
interface OldExpedition {
  troops: Army
  loot?: Partial<Resources>
  result?: { survivors: Army; loot: Partial<Resources> } | null
}

/** Une bande d'avant les patrouilles : elle restait immobile, à `position`. */
type SavedBand = Partial<Band> & { position?: { x: number; y: number } }

/** Un rapport d'une version plus ancienne : il nommait un camp, et disait seulement victoire ou non. */
type SavedReport = Partial<BattleReport> & { camp?: CampId; victory?: boolean }

/** Une partie enregistrée, peut-être par une version plus ancienne du jeu. */
type SavedState = Partial<Omit<GameState, 'reports' | 'bands'>> & {
  race: RaceId
  updatedAt: number
  reports?: SavedReport[]
  bands?: SavedBand[]
  /** Avant, un seul chantier à la fois. */
  construction?: Construction | null
  /** Avant, un seul entraînement à la fois. */
  training?: Training | null
  /** Avant les ordres sur la carte, les armées faisaient un aller-retour. */
  expeditions?: OldExpedition[]
  /** Et encore avant, une seule armée en campagne. */
  expedition?: OldExpedition | null
}

const TICK = WORLD_TICK_SECONDS * 1000

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
    // Les armées parties avec une version plus ancienne rentrent à la cité, avec ce qu'elles portaient.
    let troops = { ...emptyArmy(), ...state.troops }
    let resources = { ...emptyResources(), ...state.resources }
    for (const old of state.expeditions ?? (state.expedition ? [state.expedition] : [])) {
      const back = old.result?.survivors ?? old.troops
      troops = { ...troops }
      for (const id of Object.keys(troops) as (keyof Army)[]) troops[id] += back[id] ?? 0
      resources = addResources(resources, old.result?.loot ?? old.loot ?? {})
    }
    const levels = { ...START_LEVELS, ...state.levels }
    return {
      race: state.race,
      resources,
      levels,
      constructions: state.constructions ?? (state.construction ? [state.construction] : []),
      techs: { ...emptyTechs(), ...state.techs },
      research: state.research ?? null,
      spells: state.spells ?? [],
      troops,
      trainings: state.trainings ?? (state.training ? [state.training] : []),
      heroes: state.heroes ?? [],
      // Avant les créatures légendaires, personne n'avait de dragon.
      dragon: state.dragon ?? null,
      // Avant les héros, les armées partaient sans héros. Et avant les troupes propres à chaque race,
      // une armée ne comptait que quatre types de troupes : les autres valent zéro.
      armies: (state.armies ?? []).map((army) => ({
        ...army,
        troops: { ...emptyArmy(), ...army.troops },
        hero: army.hero ?? null,
        dragon: army.dragon ?? false,
      })),
      battles: (state.battles ?? []).map((battle) => ({
        ...battle,
        sent: { ...emptyArmy(), ...battle.sent },
        armyHealth: { ...emptyArmy(), ...battle.armyHealth },
        // Avant les raids, toutes les batailles se livraient dehors ; et avant le dragon, sans lui.
        siege: battle.siege ?? null,
        dragon: battle.dragon ?? null,
      })),
      reports: (state.reports ?? []).filter((report) => report.foe || report.camp).map(upgradeReport),
      // Avant les quêtes, rien n'était compté : les compteurs partent de zéro.
      stats: { ...emptyStats(), ...state.stats },
      quests: state.quests ?? [],
      bands: (state.bands ?? []).map((band) => upgradeBand(band, state.updatedAt)),
      // Avant les bandes et les gisements, la carte était vide : ils arrivent peu à peu.
      nextBandAt: state.nextBandAt === undefined ? state.updatedAt : state.nextBandAt,
      // Avant les raids, personne n'attaquait la cité : si son Château est déjà assez grand, un premier
      // raid se prépare, comme pour une cité qui vient d'atteindre ce niveau.
      nextRaidAt:
        state.nextRaidAt === undefined
          ? levels.castle >= RAID_CASTLE_LEVEL
            ? state.updatedAt + RAID_FIRST_SECONDS * 1000
            : null
          : state.nextRaidAt,
      nodes: state.nodes ?? [],
      nextNodeAt: state.nextNodeAt === undefined ? state.updatedAt : state.nextNodeAt,
      seed: state.seed ?? state.updatedAt | 0,
      nextId: state.nextId ?? 1,
      tickedAt: state.tickedAt ?? Math.floor(state.updatedAt / TICK) * TICK,
      updatedAt: state.updatedAt,
    }
  } catch {
    // Une partie abîmée (un champ qui n'a pas la bonne forme) : on ne peut pas la relire.
    return null
  }
}

/**
 * Une bande d'avant les patrouilles se met à faire sa ronde autour de l'endroit où elle était.
 * Et avant les raids, toutes les bandes faisaient des rondes.
 */
function upgradeBand(band: SavedBand, updatedAt: number): Band {
  if (band.home) return { ...band, raid: band.raid ?? false } as Band
  return {
    id: band.id ?? 0,
    kind: band.kind ?? 'wolves',
    level: band.level ?? 1,
    home: { x: band.position?.x ?? 0, y: band.position?.y ?? 0 },
    monsters: band.monsters ?? {},
    phase: 0,
    since: updatedAt,
    direction: 1,
    raid: false,
  }
}

function upgradeReport(report: SavedReport): BattleReport {
  const { camp, victory, ...rest } = report
  const sent = { ...emptyArmy(), ...report.sent }
  const lost = { ...emptyArmy(), ...report.lost }
  const outcome = report.outcome ?? (victory ? 'victory' : armySize(sent) > armySize(lost) ? 'draw' : 'defeat')
  return {
    ...rest,
    sent,
    lost,
    startedAt: report.startedAt ?? report.at ?? 0,
    // null : le rapport d'un siège. Les très vieux rapports, eux, ne disaient pas quelle armée s'était battue.
    army: report.army === undefined ? 0 : report.army,
    foe: report.foe ?? { type: 'camp', camp: camp as CampId },
    ambush: report.ambush ?? false,
    outcome,
    // Les rapports d'avant le journal du combat n'ont ni manches ni liste des monstres.
    enemies: report.enemies ?? {},
    enemyLost: report.enemyLost ?? {},
    loot: report.loot ?? {},
    starving: report.starving ?? false,
    rounds: report.rounds ?? [],
    hero: report.hero ?? null,
    siege: report.siege ?? null,
    dragon: report.dragon ?? null,
  } as BattleReport
}
