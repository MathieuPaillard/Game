// Relire une partie enregistrée, dans le navigateur ou sur le serveur, même si c'est une
// version plus ancienne du jeu qui l'a enregistrée.

import {
  QUESTS,
  RACES,
  RAID_CASTLE_LEVEL,
  RAID_FIRST_SECONDS,
  START_LEVELS,
  UNIT_IDS,
  WALL_GUARD,
  WORLD_TICK_SECONDS,
  type Army,
  type CampId,
  type MonsterId,
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
  getMonster,
  getUnit,
  type AllyFighter,
  type Band,
  type Battle,
  type BattleDragon,
  type BattleReport,
  type BattleRound,
  type Construction,
  type FoeFighter,
  type Foe,
  type GameState,
  type Monsters,
  type Siege,
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

/** Une bataille d'avant les mêlées : une armée (ou la cité) contre une seule bande, ou un camp. */
interface OldBattle {
  id: number
  army: number | null
  band: number | null
  foe: Foe
  ambush?: boolean
  startedAt: number
  sent: Partial<Army>
  enemies: Monsters
  armyHealth: Partial<Army>
  foeHealth: Monsters
  healthFactor: number
  starving?: boolean
  rounds?: BattleRound[]
  siege?: Siege | null
  dragon?: BattleDragon | null
}

/** Un rapport d'une version plus ancienne : il nommait un camp, et disait seulement victoire ou non. */
type SavedReport = Partial<BattleReport> & { camp?: CampId; victory?: boolean }

/** Une partie enregistrée, peut-être par une version plus ancienne du jeu. */
type SavedState = Partial<Omit<GameState, 'reports' | 'bands' | 'battles'>> & {
  battles?: (Battle | OldBattle)[]
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
    const restored: GameState = {
      race: state.race,
      resources,
      levels,
      constructions: state.constructions ?? (state.construction ? [state.construction] : []),
      techs: { ...emptyTechs(), ...state.techs },
      research: state.research ?? null,
      spells: state.spells ?? [],
      // Avant les sorts qui se rechargent, chaque sort pouvait être relancé dès sa fin.
      spellsReadyAt: state.spellsReadyAt ?? {},
      troops,
      // Avant l'hôpital, personne n'était blessé : les troupes tombées mouraient.
      wounded: { ...emptyArmy(), ...state.wounded },
      healing: state.healing ? { ...state.healing, troops: { ...emptyArmy(), ...state.healing.troops } } : null,
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
        // Avant le grand campement, personne ne portait sa clef ; et avant les poursuites, aucune bande n'avait été semée.
        key: army.key ?? false,
        escaped: army.escaped ?? [],
      })),
      battles: (state.battles ?? []).map(upgradeBattle),
      reports: (state.reports ?? []).filter((report) => isObject(report) && (report.foe || report.camp)).map(upgradeReport),
      // Avant les quêtes, rien n'était compté : les compteurs partent de zéro.
      stats: { ...emptyStats(), ...state.stats },
      quests: questChain(state.quests ?? []),
      // Avant le repeuplement des camps, un camp vaincu restait là ; et le mode d'essai n'existait pas.
      campsCleared: state.campsCleared ?? {},
      trial: state.trial ?? false,
      // Avant le grand campement : il se peuple dès que la partie avance. Et avant ses pièges, aucun n'était déclenché.
      encampment: state.encampment
        ? { ...state.encampment, sprung: state.encampment.sprung ?? [] }
        : { resetAt: state.updatedAt, gateOpen: false, sprung: [] },
      // Une bande sans monstres (une ancienne version en laissait parfois) n'a plus rien à faire sur la carte.
      bands: (state.bands ?? []).map((band) => upgradeBand(band, state.updatedAt)).filter(hasMonsters),
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
    return isSound(restored) ? restored : null
  } catch {
    // Une partie abîmée (un champ qui n'a pas la bonne forme) : on ne peut pas la relire.
    return null
  }
}

/**
 * La partie relue a-t-elle du sens ? Une heure, une position ou un nombre abîmé (pas un nombre, ou
 * un champ qui manque) ferait planter le jeu, ou tourner `advance` sans fin : mieux vaut ne pas la
 * reprendre que bloquer le joueur, ou le serveur.
 */
function isSound(state: GameState): boolean {
  const works = [
    ...state.constructions,
    ...state.trainings,
    ...state.spells,
    ...(state.research ? [state.research] : []),
    ...(state.healing ? [state.healing] : []),
  ]
  const dragon = state.dragon
  return (
    [state.updatedAt, state.tickedAt, state.seed, state.nextId].every(finite) &&
    [state.nextBandAt, state.nextNodeAt, state.nextRaidAt].every(finiteOrNull) &&
    [state.resources, state.levels, state.techs, state.troops, state.wounded, state.campsCleared, state.spellsReadyAt].every(isCounts) &&
    (state.healing === null || (isCounts(state.healing.troops) && finite(state.healing.startedAt))) &&
    typeof state.trial === 'boolean' &&
    isObject(state.encampment) &&
    finiteOrNull(state.encampment.resetAt) &&
    typeof state.encampment.gateOpen === 'boolean' &&
    Array.isArray(state.encampment.sprung) &&
    state.encampment.sprung.every(finite) &&
    works.every((work) => isObject(work) && finite(work.endsAt)) &&
    state.heroes.every((hero) => isObject(hero) && finite(hero.level) && finite(hero.xp)) &&
    state.armies.every(
      (army) =>
        finite(army.id) &&
        isPoint(army.position) &&
        (army.order === null || isTarget(army.order)) &&
        isCounts(army.troops) &&
        isCounts(army.load) &&
        Array.isArray(army.fought) &&
        Array.isArray(army.escaped),
    ) &&
    state.battles.every(
      (battle) =>
        finite(battle.startedAt) &&
        finite(battle.round) &&
        Array.isArray(battle.allies) &&
        Array.isArray(battle.foes) &&
        battle.allies.every(
          (ally) =>
            typeof ally.ref === 'string' &&
            [ally.start, ally.slot, ally.healthFactor].every(finite) &&
            [ally.sent, ally.health].every(isCounts) &&
            Array.isArray(ally.rounds),
        ) &&
        battle.foes.every(
          (foe) => typeof foe.ref === 'string' && [foe.start, foe.slot].every(finite) && [foe.enemies, foe.health].every(isCounts),
        ),
    ) &&
    state.bands.every(
      (band) =>
        finite(band.id) &&
        finite(band.level) &&
        isPoint(band.home) &&
        finite(band.phase) &&
        finiteOrNull(band.since) &&
        (band.chase === null || (isObject(band.chase) && isPoint(band.chase.position) && finiteOrNull(band.chase.army))),
    ) &&
    state.nodes.every((node) => isObject(node) && finite(node.id) && isPoint(node.position) && finite(node.remaining)) &&
    (dragon === null || (isObject(dragon) && finite(dragon.xp) && finiteOrNull(dragon.hatchAt) && finiteOrNull(dragon.restUntil)))
  )
}

/** Un nombre utilisable : ni « pas un nombre », ni l'infini. */
function finite(value: unknown): boolean {
  return typeof value === 'number' && Number.isFinite(value)
}

function finiteOrNull(value: unknown): boolean {
  return value === null || finite(value)
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isPoint(value: unknown): boolean {
  return isObject(value) && finite(value.x) && finite(value.y)
}

/** Des nombres rangés par nom (ressources, troupes, monstres…), tous utilisables. */
function isCounts(value: unknown): boolean {
  return isObject(value) && Object.values(value).every(finite)
}

/** Un ordre d'armée complet : un endroit, un camp, une bande, un gisement ou la cité. */
function isTarget(value: unknown): boolean {
  if (!isObject(value)) return false
  switch (value.type) {
    case 'point':
      return finite(value.x) && finite(value.y)
    case 'band':
      return finite(value.band)
    case 'node':
      return finite(value.node)
    case 'camp':
      return typeof value.camp === 'string'
    case 'city':
      return true
    default:
      return false
  }
}

/**
 * Les objectifs réclamés. Ils forment une chaîne, qu'on réclame dans l'ordre : un objectif ajouté plus
 * tard au milieu de la chaîne compte comme réclamé quand un objectif qui le suit l'est déjà.
 */
function questChain(claimed: string[]): string[] {
  const last = Math.max(-1, ...claimed.map((id) => QUESTS.findIndex((quest) => quest.id === id)))
  return QUESTS.slice(0, last + 1).map((quest) => quest.id)
}

function hasMonsters(band: Band): boolean {
  return isCounts(band.monsters) && Object.values(band.monsters).some((count) => (count ?? 0) > 0)
}

/**
 * Une bande d'avant les patrouilles se met à faire sa ronde autour de l'endroit où elle était.
 * Avant les raids, toutes les bandes faisaient des rondes ; et avant les poursuites, aucune ne
 * poursuivait personne.
 */
function upgradeBand(band: SavedBand, updatedAt: number): Band {
  if (band.home) {
    return {
      ...band,
      raid: band.raid ?? false,
      encampment: band.encampment ?? false,
      still: band.still ?? false,
      chase: band.chase ?? null,
    } as Band
  }
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
    encampment: false,
    still: false,
    chase: null,
  }
}

/**
 * Une bataille d'avant les mêlées devient une mêlée à deux : l'armée (ou la cité) et son adversaire,
 * face à face. Celles d'avant les raids se livraient dehors, et celles d'avant le dragon, sans lui.
 * Une mêlée récente garde tout, et les troupes ajoutées depuis y comptent zéro.
 */
function upgradeBattle(battle: Battle | OldBattle): Battle {
  if ('allies' in battle) {
    return {
      ...battle,
      allies: battle.allies.map((ally) => ({
        ...ally,
        sent: { ...emptyArmy(), ...ally.sent },
        health: { ...emptyArmy(), ...ally.health },
        met: ally.met ?? [],
        loot: ally.loot ?? {},
      })),
      foes: battle.foes.map((foe) => ({ ...foe, damageBy: foe.damageBy ?? {} })),
    }
  }
  const allyRef = battle.army === null ? 'city' : `army:${battle.army}`
  const camp = battle.foe.type === 'camp' ? battle.foe.camp : null
  const foeRef = battle.band !== null ? `band:${battle.band}` : `camp:${camp}`
  const rounds = battle.rounds ?? []
  const last = rounds[rounds.length - 1]
  const sent = { ...emptyArmy(), ...battle.sent }
  const siege = battle.siege ?? null
  const dragon = battle.dragon ?? null
  let start = UNIT_IDS.reduce((sum, id) => sum + sent[id] * getUnit(id).health * battle.healthFactor, 0)
  if (siege) start += siege.guards * WALL_GUARD.health
  if (dragon) start += dragon.start
  const ally: AllyFighter = {
    ref: allyRef,
    joinedAt: battle.startedAt,
    target: foeRef,
    slot: 4,
    start,
    taken: last?.taken ?? 0,
    army: battle.army,
    sent,
    health: { ...emptyArmy(), ...battle.armyHealth },
    healthFactor: battle.healthFactor,
    starving: battle.starving ?? false,
    ambush: battle.ambush ?? false,
    siege,
    dragon,
    rounds,
    met: [{ ref: foeRef, foe: battle.foe, monsters: battle.enemies }],
    loot: {},
  }
  const foe: FoeFighter = {
    ref: foeRef,
    joinedAt: battle.startedAt,
    target: allyRef,
    slot: 0,
    start: (Object.entries(battle.enemies) as [MonsterId, number][]).reduce(
      (sum, [id, count]) => sum + count * getMonster(id).health,
      0,
    ),
    taken: last?.dealt ?? 0,
    band: battle.band,
    camp,
    foe: battle.foe,
    enemies: battle.enemies,
    health: battle.foeHealth,
    damageBy: { [allyRef]: rounds.reduce((sum, round) => sum + round.dealt, 0) },
  }
  return { id: battle.id, startedAt: battle.startedAt, round: rounds.length, allies: [ally], foes: [foe] }
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
    // Avant l'hôpital, aucune troupe tombée n'était seulement blessée.
    wounded: { ...emptyArmy(), ...report.wounded },
    startedAt: report.startedAt ?? report.at ?? 0,
    // null : le rapport d'un siège. Les très vieux rapports, eux, ne disaient pas quelle armée s'était battue.
    army: report.army === undefined ? 0 : report.army,
    foe: report.foe ?? { type: 'camp', camp: camp as CampId },
    // Avant les mêlées, une bataille n'avait qu'un adversaire.
    foes: report.foes ?? [report.foe ?? { type: 'camp', camp: camp as CampId }],
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
