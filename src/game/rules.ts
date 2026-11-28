// Les règles du jeu, en TypeScript pur : aucune dépendance à Vue ni au navigateur.
// Chaque fonction reçoit l'état de la partie (et l'heure) et renvoie un résultat sans rien modifier.
// Le navigateur et le serveur utilisent exactement ces mêmes règles.

import { counts, roundCap, strike, total, type Stack } from './battle.ts'
import { clear, findRoute, insideAny, routeLength, walk, type Polygon } from './terrain.ts'
import {
  BAND_AGGRO_PER_LEVEL,
  BAND_AGGRO_RADIUS,
  BAND_SIGHT_FACTOR,
  CAMP_RESPAWN_SECONDS,
  ENCIRCLED_ATTACK_MALUS,
  ENCIRCLED_SIDES,
  MAX_ATTACKERS,
  REAR_ATTACK_BONUS,
  SIDE_ATTACK_BONUS,
  CHASE_LEASH,
  CHASE_SPEED,
  ENCAMPMENT,
  ENCAMPMENT_BANDS,
  ENCAMPMENT_GATE,
  ENCAMPMENT_GATE_FRONT,
  ENCAMPMENT_TRAPS,
  GATE_REACH,
  TRAP_DAMAGE,
  TRAP_RADIUS,
  WATCH_RADIUS,
  BAND_GROWTH,
  BAND_KINDS,
  BAND_LEVEL_RING,
  BAND_LEVEL_START,
  BAND_LEVEL_UP_CHANCE,
  BAND_LOOT_GROWTH,
  BAND_SPAWN_SECONDS,
  BAND_SPOTS,
  BARRACKS_SPEED_PER_LEVEL,
  BATTLE_ROUND_SECONDS,
  BUILDINGS,
  CAMPS,
  COST_GROWTH,
  DRAGON_ATTACK,
  DRAGON_BASE_XP,
  DRAGON_FAMILY,
  DRAGON_GROWTH,
  DRAGON_HATCH_COST,
  DRAGON_HATCH_SECONDS,
  DRAGON_HEALTH,
  DRAGON_MAX_LEVEL,
  DRAGON_REST_SECONDS,
  DRAGON_UPKEEP_PER_LEVEL,
  DRAGON_XP_GROWTH,
  DURATION_GROWTH,
  HEAL_COST_SHARE,
  HEAL_TIME_SHARE,
  HEROES,
  HERO_BASE_XP,
  HERO_MAX_LEVEL,
  HERO_XP_GROWTH,
  HOSPITAL_BEDS_BASE,
  HOSPITAL_BEDS_GROWTH,
  MARCH_SPEED,
  MOUNTAINS,
  MAX_BAND_LEVEL,
  MAX_BANDS,
  MAX_BATTLE_ROUNDS,
  MAX_LEVEL,
  MAX_NODES,
  MAX_REPORTS,
  MONSTERS,
  NODE_GROWTH,
  NODE_KINDS,
  NODE_SPAWN_SECONDS,
  NODE_SPOTS,
  PATROL_RADIUS,
  PATROL_SPEED,
  PRODUCTION_GROWTH,
  PROTECTED_PER_CASTLE_LEVEL,
  QUESTS,
  RACES,
  RAID_CASTLE_LEVEL,
  RAID_FIRST_SECONDS,
  RAID_GATES,
  RAID_INTERVAL_SECONDS,
  RAID_LOAD_PER_MONSTER,
  RAID_PLUNDER_SHARE,
  RAID_RESPITE_SECONDS,
  RAID_SIZE,
  RAID_SPEED,
  RESOURCES,
  RESOURCE_IDS,
  SECOND_CONSTRUCTION_CASTLE_LEVEL,
  SIEGE_WAIT_SECONDS,
  SKILL_MAX_LEVEL,
  SPELLS,
  START_BANDS,
  START_LEVELS,
  START_NODES,
  START_RESOURCES,
  STARVATION_ATTACK_MALUS,
  STORAGE_BASE,
  STORAGE_GROWTH,
  TRIAL_BOOST,
  TECHS,
  TRAINING_BATCH_PER_LEVEL,
  UNITS,
  UNIT_IDS,
  WALL_GUARD,
  WALL_GUARDS_PER_LEVEL,
  WALL_HEALTH_PER_LEVEL,
  WORLD,
  WORLD_TICK_SECONDS,
  WOUNDED_SHARE,
  type Army,
  type BandKindDef,
  type BandKindId,
  type BuildingDef,
  type BuildingId,
  type CampDef,
  type CampId,
  type Family,
  type HeroDef,
  type HeroId,
  type MonsterDef,
  type MonsterId,
  type Point,
  type QuestDef,
  type RaceDef,
  type RaceId,
  type ResourceId,
  type Resources,
  type SkillEffect,
  type SpellDef,
  type SpellEffect,
  type SpellId,
  type TechDef,
  type TechEffect,
  type TechId,
  type UnitDef,
  type UnitId,
} from './config.ts'

// --- L'état de la partie ---

/** Un chantier en cours : quel bâtiment, vers quel niveau, et quand il se termine. */
export interface Construction {
  building: BuildingId
  targetLevel: number
  startedAt: number
  endsAt: number
}

/** Un entraînement en cours à la Caserne. */
export interface Training {
  unit: UnitId
  count: number
  startedAt: number
  endsAt: number
}

/** Des blessés en soins à l'hôpital : ils rejoignent la garnison à `endsAt`. */
export interface Healing {
  troops: Army
  startedAt: number
  endsAt: number
}

/** Une recherche en cours à l'Académie. */
export interface Research {
  tech: TechId
  targetLevel: number
  startedAt: number
  endsAt: number
}

/** Un sort lancé : il agit jusqu'à `endsAt`. */
export interface ActiveSpell {
  spell: SpellId
  endsAt: number
}

/** Des monstres : un nombre pour chaque sorte. */
export type Monsters = Partial<Record<MonsterId, number>>

/** Ce qu'une armée peut viser : un endroit de la carte, un camp, une bande, un gisement, ou la cité. */
export type Target =
  | { type: 'point'; x: number; y: number }
  | { type: 'camp'; camp: CampId }
  | { type: 'band'; band: number }
  | { type: 'node'; node: number }
  | { type: 'city' }

/**
 * Contre qui une bataille a lieu, pour les rapports : un camp, ou une sorte de bande et son niveau
 * (`raid` : cette bande était un raid, en marche vers la cité). Un piège du grand campement a aussi
 * son rapport, sans bataille.
 */
export type Foe =
  | { type: 'camp'; camp: CampId }
  | { type: 'band'; kind: BandKindId; level: number; raid?: boolean }
  | { type: 'trap' }

/** Une bande lancée à la poursuite d'une armée, ou qui regagne sa ronde après l'avoir perdue de vue. */
export interface Chase {
  /** L'armée poursuivie ; null quand la bande regagne sa ronde. */
  army: number | null
  /** Là où se trouve la bande. */
  position: Point
}

/**
 * Une bande de monstres. Elle fait des rondes autour de son repaire ; ou bien c'est un raid
 * (`raid`), qui part du bord de la carte et marche droit sur la cité pour la piller.
 */
export interface Band {
  id: number
  kind: BandKindId
  level: number
  /** Le repaire, au centre de sa ronde. Pour un raid : son point de départ, au bord de la carte. */
  home: Point
  /** Les monstres encore debout : une bande garde ses pertes d'une bataille à l'autre. */
  monsters: Monsters
  /** Le chemin déjà parcouru sur sa ronde, ou vers la cité (en unités de carte), à l'instant `since`. */
  phase: number
  /**
   * Depuis quand elle marche sur sa ronde (ou vers la cité) ; null quand elle l'a quittée : pour se
   * battre, ou pour poursuivre une armée. Sa ronde reprendra là où elle l'a laissée.
   */
  since: number | null
  /** 1 ou -1 : le sens de sa ronde. */
  direction: number
  /** Un raid : il ne fait pas de ronde, il marche sur la cité. */
  raid: boolean
  /** Une bande du grand campement : elle revient à chaque repeuplement, et n'occupe aucun repaire de la carte. */
  encampment: boolean
  /** Un chef immobile : il garde sa place, sans faire de ronde. */
  still: boolean
  /** Sa poursuite d'une armée (ou son retour vers sa ronde) ; null quand elle n'a pas quitté sa ronde. */
  chase: Chase | null
}

/**
 * Le grand campement : quand il se repeuplera (null : pas de campement, pour les tests), sa porte,
 * et les pièges déjà déclenchés (leur numéro dans ENCAMPMENT_TRAPS).
 */
export interface EncampmentState {
  resetAt: number | null
  gateOpen: boolean
  sprung: number[]
}

/** Un gisement de ressources : champs, scierie, carrière, mine d'or ou source de mana. */
export interface ResourceNode {
  id: number
  resource: ResourceId
  level: number
  position: Point
  /** Ce qu'il reste à récolter. */
  remaining: number
}

/** Ce que fait une armée : elle marche, attend, se bat ou récolte. */
export type ArmyStatus = 'marching' | 'idle' | 'fighting' | 'gathering'

/** Une armée sortie de la cité. Elle reste sur la carte et suit les ordres, jusqu'à ce qu'elle rentre. */
export interface FieldArmy {
  id: number
  troops: Army
  position: Point
  /** Son ordre : où elle va, ce qu'elle attaque ou récolte. null quand elle attend sur place. */
  order: Target | null
  status: ArmyStatus
  /** Ce qu'elle porte (butin et récolte), déposé dans les réserves quand elle rentre à la cité. */
  load: Partial<Resources>
  /** Les bandes qui l'ont déjà combattue : elles ne l'attaquent plus d'elles-mêmes. */
  fought: number[]
  /** Les bandes qu'elle a semées : elles ne la poursuivent plus (mais l'attaquent encore si elle passe à leur portée). */
  escaped: number[]
  /** Le héros qui la mène, ou null. */
  hero: HeroId | null
  /** Le dragon l'accompagne. */
  dragon: boolean
  /** Elle porte la clef du grand campement, prise à son gardien. */
  key: boolean
}

/**
 * Le dragon, la créature légendaire de la cité. L'œuf attend d'être couvé (egg), il éclora à
 * `hatchAt` (hatching), ou le dragon est né (grown).
 */
export interface Dragon {
  stage: 'egg' | 'hatching' | 'grown'
  hatchAt: number | null
  /** L'expérience gagnée depuis sa naissance : son niveau en découle, dans la limite de son aire. */
  xp: number
  /** Blessé, il se repose dans son aire jusqu'à cette heure ; null quand il est en forme. */
  restUntil: number | null
}

/** Ce qu'a gagné le dragon dans une bataille, et s'il en est sorti blessé. */
export interface DragonGain {
  xp: number
  level: number
  levelsGained: number
  wounded: boolean
}

/** Un héros recruté : son niveau, son expérience, et ce qu'il a appris. */
export interface Hero {
  id: HeroId
  level: number
  /** L'expérience gagnée depuis son dernier niveau. */
  xp: number
  /** Le niveau de chacune de ses compétences apprises, par identifiant. */
  skills: Record<string, number>
}

/** Ce qu'a gagné le héros d'une armée dans une bataille. */
export interface HeroGain {
  hero: HeroId
  xp: number
  /** Son niveau après la bataille, et les niveaux gagnés pendant celle-ci. */
  level: number
  levelsGained: number
}

/** Une manche du combat d'une de tes troupes (une armée, ou la cité), telle que la raconte le journal. */
export interface BattleRound {
  /** Dégâts infligés par ta troupe à sa cible, puis par tous les monstres qui la frappaient. */
  dealt: number
  taken: number
  /** Pertes de la manche : les tiennes, puis les monstres abattus par ta troupe. */
  lost: Army
  enemyLost: Monsters
  /** Pendant un siège : les gardes des Remparts tombés dans la manche. */
  guardsLost?: number
  /** Le dragon est tombé pendant cette manche : blessé, il quitte le combat. */
  dragonFell?: true
  /** Ta troupe frappait sa cible de côté, ou de dos (rien : de face). */
  flank?: 'side' | 'rear'
  /** Le nombre de monstres (bandes ou camp) qui la frappaient, quand ils étaient plusieurs. */
  attackers?: number
  /** Ta troupe était encerclée : son attaque était réduite. */
  encircled?: true
  /** La vie que ses soigneurs ont rendue à ses troupes pendant la manche, et les tombés qu'ils ont relevés. */
  healed?: number
  raised?: Army
}

/** Le dragon dans une bataille : son attaque, sa vie au début de la bataille et ce qu'il en reste. */
export interface BattleDragon {
  attack: number
  start: number
  health: number
}

/** Un siège : la bataille se joue aux portes de la cité, avec les gardes des Remparts. */
export interface Siege {
  /** Les gardes des Remparts au début du siège, et les points de vie qui leur restent. */
  guards: number
  guardHealth: number
}

/**
 * Ce qu'ont en commun les combattants d'une mêlée. Chacun frappe une seule cible, dans l'autre camp ;
 * plusieurs peuvent frapper la même, chacun à sa place autour d'elle (MAX_ATTACKERS au plus).
 */
export interface FighterBase {
  /** Son nom dans la mêlée : `army:12` (une armée), `city` (la cité), `band:34` (une bande) ou `camp:wolfDen`. */
  ref: string
  /** Quand il est entré dans la mêlée. */
  joinedAt: number
  /** Celui qu'il frappe (le nom d'un combattant de l'autre camp), ou null s'il attend une place libre. */
  target: string | null
  /**
   * Sa place autour de sa cible, de 0 à 7 : la direction où il se tient, vu de sa cible (0 à l'est,
   * puis tous les 45° dans le sens des aiguilles d'une montre). Il regarde donc dans la direction
   * opposée : devant lui, sa cible.
   */
  slot: number
  /** Sa vie en entrant dans la mêlée : en une manche, chaque assaillant ne peut lui en ôter qu'une part. */
  start: number
  /** Les dégâts reçus à la dernière manche, pour l'animation. */
  taken: number
}

/** Ton camp, dans une mêlée : une de tes armées, ou la cité qui se défend (pendant un siège). */
export interface AllyFighter extends FighterBase {
  /** L'armée, ou null pour la cité. */
  army: number | null
  /** Les troupes en entrant dans la mêlée, et les points de vie qui restent à chaque groupe. */
  sent: Army
  health: Army
  /** L'effet des Armures, du héros et des sorts (et des Remparts, pour la cité) : il fixe la vie de chaque troupe. */
  healthFactor: number
  /** Elle avait faim en entrant dans la mêlée. */
  starving: boolean
  /** Une bande l'a attaquée la première. */
  ambush: boolean
  /** La cité se défend : les gardes des Remparts ; null pour une armée. */
  siege: Siege | null
  /** Le dragon se bat avec elle ; null s'il n'est pas là. */
  dragon: BattleDragon | null
  /** Son journal, manche par manche. */
  rounds: BattleRound[]
  /** Les adversaires rencontrés, dans l'ordre, avec leurs monstres à la rencontre. */
  met: { ref: string; foe: Foe; monsters: Monsters }[]
  /** Sa part du butin des adversaires tombés, qu'elle emportera en quittant la mêlée. */
  loot: Partial<Resources>
}

/** L'autre camp : une bande de monstres (ou un raid), ou les défenseurs d'un camp. */
export interface FoeFighter extends FighterBase {
  band: number | null
  camp: CampId | null
  foe: Foe
  /** Les monstres en entrant dans la mêlée, et les points de vie qui restent à chaque sorte. */
  enemies: Monsters
  health: Monsters
  /** Les dégâts reçus de chacun de tes combattants (par nom) : son butin se partage d'après eux. */
  damageBy: Record<string, number>
}

/** Une bataille en cours : une mêlée, avec une manche toutes les BATTLE_ROUND_SECONDS, jusqu'à ce qu'un camp tombe. */
export interface Battle {
  id: number
  startedAt: number
  /** Les manches déjà jouées. */
  round: number
  /** Ton camp (tes armées, ou la cité et les armées venues l'aider), et celui des monstres. */
  allies: AllyFighter[]
  foes: FoeFighter[]
}

/** Comment une bataille s'est terminée, pour ton armée. */
export type Outcome = 'victory' | 'defeat' | 'retreat' | 'draw'

/** Ce qu'un siège a coûté à la cité, pour le rapport. */
export interface SiegeReport {
  /** Les gardes des Remparts au début du siège, et ceux qui sont tombés (ils sont remplacés ensuite). */
  guards: number
  guardsLost: number
  /**
   * Les troupes tombées pendant le siège qui se relevaient aussitôt, avant l'hôpital (les vieux rapports) ;
   * vide depuis : les blessés vont à l'hôpital (BattleReport.wounded).
   */
  healed: Army
  /** Ce que les monstres ont emporté, si la cité est tombée. */
  plunder: Partial<Resources>
}

export interface BattleReport {
  /** La fin de la bataille. */
  at: number
  startedAt: number
  /** Le numéro de l'armée qui s'est battue, ou null pour un siège. */
  army: number | null
  /** Le premier adversaire rencontré, et tous ceux de la mêlée (le premier compris). */
  foe: Foe
  foes: Foe[]
  ambush: boolean
  outcome: Outcome
  sent: Army
  /** Les troupes tombées, et parmi elles celles qui ne sont que blessées : elles sont allées à l'hôpital. */
  lost: Army
  wounded: Army
  /** Les monstres présents au début de la bataille. */
  enemies: Monsters
  enemyLost: Monsters
  loot: Partial<Resources>
  /** L'armée avait faim : son attaque était réduite. */
  starving: boolean
  /** Le journal du combat, manche par manche. */
  rounds: BattleRound[]
  /** Le héros qui menait l'armée, et l'expérience qu'il a gagnée ; null sans héros. */
  hero: HeroGain | null
  /** Un siège de la cité : ses gardes, ses blessés soignés, et ce qui a été pillé ; null pour une bataille dehors. */
  siege: SiegeReport | null
  /** Le dragon s'est battu : l'expérience gagnée, et s'il a été blessé ; null s'il n'était pas là. */
  dragon: DragonGain | null
}

/** Ce que le joueur a accompli depuis le début de la partie : les quêtes en tiennent compte. */
export interface Stats {
  /** Batailles remportées. */
  victories: number
  /** Bandes de monstres vaincues. */
  bandsDefeated: number
  /** Ressources récoltées sur les gisements. */
  gathered: number
  /** Raids repoussés : vaincus aux portes de la cité, ou interceptés en chemin. */
  raidsRepelled: number
  /** Victoires contre chaque camp de monstres. */
  campsDefeated: Partial<Record<CampId, number>>
}

/** Tout ce qu'il faut savoir sur une partie. Les heures sont en millisecondes (comme Date.now()). */
export interface GameState {
  race: RaceId
  resources: Resources
  levels: Record<BuildingId, number>
  /** Les chantiers en cours : un seul au début, deux plus tard (maxConstructions). */
  constructions: Construction[]
  /** Niveau atteint dans chaque recherche. */
  techs: Record<TechId, number>
  research: Research | null
  /** Les sorts qui agissent en ce moment : un seul exemplaire de chaque. */
  spells: ActiveSpell[]
  /** Quand chaque sort qui se recharge (la Brume d'oubli) pourra être relancé. */
  spellsReadyAt: Partial<Record<SpellId, number>>
  /** Troupes présentes dans la cité. Celles qui sont sorties sont dans `armies`. */
  troops: Army
  /** Les blessés qui attendent à l'hôpital qu'on les soigne : ils ne mangent pas et ne se battent pas. */
  wounded: Army
  /** Les blessés en soins, un seul groupe à la fois ; null si personne n'est soigné. */
  healing: Healing | null
  /** Entraînements en cours à la Caserne : au plus un par type de troupe. */
  trainings: Training[]
  /** Les héros recrutés, dans l'ordre de leur arrivée. */
  heroes: Hero[]
  /** Le dragon (ou son œuf), une fois gagné par une quête ; null avant. */
  dragon: Dragon | null
  /** Les armées sorties de la cité, sur la carte des alentours : pas plus que maxArmies(). */
  armies: FieldArmy[]
  /** Les batailles en cours. */
  battles: Battle[]
  /** Derniers rapports de bataille, du plus récent au plus ancien. */
  reports: BattleReport[]
  /** Ce que le joueur a accompli, pour les quêtes. */
  stats: Stats
  /** Les quêtes dont la récompense a été reçue, dans l'ordre. */
  quests: string[]
  /** Les camps vaincus, et l'heure où leurs monstres reviennent : d'ici là, le camp est vide. */
  campsCleared: Partial<Record<CampId, number>>
  /** Le mode d'essai : les troupes du joueur sont bien plus fortes (parties sans compte seulement). */
  trial: boolean
  /** Le grand campement : son prochain repeuplement, et sa porte. */
  encampment: EncampmentState
  /** Les bandes de monstres sur la carte des alentours. */
  bands: Band[]
  /** Quand la prochaine bande apparaîtra, ou null si la carte est pleine. */
  nextBandAt: number | null
  /** Quand le prochain raid partira vers la cité, ou null tant que le Château est trop petit pour en attirer. */
  nextRaidAt: number | null
  /** Les gisements de ressources sur la carte des alentours. */
  nodes: ResourceNode[]
  /** Quand le prochain gisement apparaîtra, ou null si la carte en a assez. */
  nextNodeAt: number | null
  /** La graine du hasard (voir random) : bandes et gisements sont tirés au sort, de façon reproductible. */
  seed: number
  /** Le prochain numéro libre, pour les bandes, les gisements, les armées et les batailles. */
  nextId: number
  /** Le dernier pas du monde : tant que des armées sont dehors, il avance d'une seconde à la fois. */
  tickedAt: number
  /** Instant jusqu'auquel les ressources ont été calculées. */
  updatedAt: number
}

/** Une action est-elle possible ? Sinon, pourquoi ? */
export type Check = { ok: true } | { ok: false; reason: string }

const SECOND = 1000
const HOUR = 60 * 60 * SECOND
const TICK = WORLD_TICK_SECONDS * SECOND
const ROUND = BATTLE_ROUND_SECONDS * SECOND

/** Une nouvelle partie. La graine du hasard vient par défaut de l'heure de création. */
export function newGame(race: RaceId, now: number, seed = now): GameState {
  let state: GameState = {
    race,
    resources: { ...START_RESOURCES },
    levels: { ...START_LEVELS },
    constructions: [],
    techs: emptyTechs(),
    research: null,
    spells: [],
    spellsReadyAt: {},
    troops: emptyArmy(),
    wounded: emptyArmy(),
    healing: null,
    trainings: [],
    heroes: [],
    dragon: null,
    armies: [],
    battles: [],
    reports: [],
    stats: emptyStats(),
    quests: [],
    campsCleared: {},
    trial: false,
    encampment: { resetAt: null, gateOpen: false, sprung: [] },
    bands: [],
    nextBandAt: null,
    nextRaidAt: null,
    nodes: [],
    nextNodeAt: null,
    seed: seed | 0,
    nextId: 1,
    tickedAt: Math.floor(now / TICK) * TICK,
    updatedAt: now,
  }
  // Quelques bandes rôdent déjà, et quelques gisements attendent d'être récoltés.
  for (let i = 0; i < START_BANDS; i++) state = spawnBand(state, now)
  for (let i = 0; i < START_NODES; i++) state = spawnNode(state, now)
  // Le grand campement est peuplé dès le début.
  return resetEncampment(state, now)
}

export function emptyResources(): Resources {
  return Object.fromEntries(RESOURCE_IDS.map((id) => [id, 0])) as Resources
}

export function emptyStats(): Stats {
  return { victories: 0, bandsDefeated: 0, gathered: 0, raidsRepelled: 0, campsDefeated: {} }
}

export function emptyArmy(): Army {
  return Object.fromEntries(UNIT_IDS.map((id) => [id, 0])) as Army
}

export function emptyTechs(): Record<TechId, number> {
  return Object.fromEntries(TECHS.map((tech) => [tech.id, 0])) as Record<TechId, number>
}

export function armySize(army: Army): number {
  return UNIT_IDS.reduce((sum, id) => sum + army[id], 0)
}

function byId<T extends { id: string }>(list: T[], id: string): T {
  const item = list.find((x) => x.id === id)
  if (!item) throw new Error(`Identifiant inconnu : ${id}`)
  return item
}

export function getBuilding(id: BuildingId): BuildingDef {
  return byId(BUILDINGS, id)
}

export function getRace(id: RaceId): RaceDef {
  return byId(RACES, id)
}

export function getTech(id: TechId): TechDef {
  return byId(TECHS, id)
}

export function getUnit(id: UnitId): UnitDef {
  return byId(UNITS, id)
}

export function getMonster(id: MonsterId): MonsterDef {
  return byId(MONSTERS, id)
}

export function getCamp(id: CampId): CampDef {
  return byId(CAMPS, id)
}

export function getBandKind(id: BandKindId): BandKindDef {
  return byId(BAND_KINDS, id)
}

/** La bande qui porte ce numéro, si elle est toujours sur la carte. */
export function getBand(state: GameState, id: number): Band | undefined {
  return state.bands.find((band) => band.id === id)
}

/** L'armée qui porte ce numéro, si elle est toujours dehors. */
export function getArmy(state: GameState, id: number): FieldArmy | undefined {
  return state.armies.find((army) => army.id === id)
}

/** Le gisement qui porte ce numéro, s'il n'est pas épuisé. */
export function getNode(state: GameState, id: number): ResourceNode | undefined {
  return state.nodes.find((node) => node.id === id)
}

// --- Ressources et production ---

export function canAfford(resources: Resources, cost: Partial<Resources>): boolean {
  return RESOURCE_IDS.every((id) => resources[id] >= (cost[id] ?? 0))
}

/** « de pierre », « d’or » : le nom d'une ressource, après un nombre. */
function ofResource(id: ResourceId): string {
  const name = RESOURCES[id].name.toLowerCase()
  return `${/^[aeiouh]/.test(name) ? 'd’' : 'de '}${name}`
}

/**
 * Peut-on payer ? Sinon, ce qui manque : « Il manque 65 de mana et 120 de pierre ». Avec la place des
 * réserves (`capacity`), un coût qui la dépasse demande d'abord un plus grand Entrepôt : la production
 * ne pourra jamais l'atteindre.
 */
export function checkCost(resources: Resources, cost: Partial<Resources>, capacity = Infinity): Check {
  const short = RESOURCE_IDS.filter((id) => resources[id] < (cost[id] ?? 0))
  if (short.length === 0) return { ok: true }
  const tooBig = short.find((id) => (cost[id] ?? 0) > capacity)
  if (tooBig) {
    return { ok: false, reason: `Tes réserves ne gardent que ${Math.floor(capacity)} ${ofResource(tooBig)} : agrandis l’Entrepôt` }
  }
  const missing = short.map((id) => `${Math.ceil((cost[id] ?? 0) - resources[id])} ${ofResource(id)}`)
  const list = missing.length === 1 ? missing[0] : `${missing.slice(0, -1).join(', ')} et ${missing[missing.length - 1]}`
  return { ok: false, reason: `Il manque ${list}` }
}

/**
 * Ce que les réserves gardent de chaque ressource : l'Entrepôt, plus l'Intendance. Au-delà, la
 * production s'arrête (voir accrue) ; le butin, les récoltes et les récompenses entrent quand même.
 */
export function storageCapacity(state: GameState, warehouseLevel = state.levels.warehouse): number {
  return Math.floor(STORAGE_BASE * STORAGE_GROWTH ** warehouseLevel * (1 + techBonus(state, 'storage')))
}

/** Peut-on payer ce coût ? Avec la place des réserves : un coût qui la dépasse demande un plus grand Entrepôt. */
function checkPay(state: GameState, cost: Partial<Resources>): Check {
  return checkCost(state.resources, cost, storageCapacity(state))
}

/** Ajoute (ou retire, avec sign = -1) des ressources. */
export function addResources(resources: Resources, delta: Partial<Resources>, sign = 1): Resources {
  const result = { ...resources }
  for (const id of RESOURCE_IDS) result[id] += sign * (delta[id] ?? 0)
  return result
}

/** Production par heure d'un bâtiment à un niveau donné, bonus de race et de recherches compris. */
export function buildingOutput(state: GameState, building: BuildingDef, level: number): number {
  if (!building.produces || !building.baseProductionPerHour || level <= 0) return 0
  const raceBonus = getRace(state.race).productionBonus[building.produces] ?? 0
  const researchBonus = techBonus(state, 'production', building.produces)
  const magic = spellBonus(state, 'production', building.produces)
  return building.baseProductionPerHour * PRODUCTION_GROWTH ** (level - 1) * (1 + raceBonus + researchBonus + magic)
}

/** Production totale de la cité, par heure et par ressource. */
export function productionPerHour(state: GameState): Resources {
  const total = emptyResources()
  for (const building of BUILDINGS) {
    if (building.produces) {
      total[building.produces] += buildingOutput(state, building, state.levels[building.id])
    }
  }
  return total
}

// --- Entretien des troupes ---

/** Toutes les troupes du joueur : celles de la cité et celles qui sont dehors. */
export function allTroops(state: GameState): Army {
  const all = { ...state.troops }
  for (const army of state.armies) {
    for (const id of UNIT_IDS) all[id] += army.troops[id]
  }
  return all
}

function armyUpkeep(army: Army): number {
  return UNIT_IDS.reduce((sum, id) => sum + army[id] * getUnit(id).upkeepPerHour, 0)
}

/** Nourriture mangée chaque heure par les troupes (dans la cité comme en campagne) et par le dragon. */
export function upkeepPerHour(state: GameState): number {
  return armyUpkeep(allTroops(state)) + DRAGON_UPKEEP_PER_LEVEL * dragonLevel(state)
}

/** Ce que la cité gagne vraiment chaque heure : la production, moins l'entretien des troupes. */
export function netPerHour(state: GameState): Resources {
  const rates = productionPerHour(state)
  rates.food -= upkeepPerHour(state)
  return rates
}

/** Dans combien de temps (en millisecondes) la nourriture sera épuisée, ou null si elle ne baisse pas. */
export function timeUntilFamine(state: GameState): number | null {
  const net = netPerHour(state).food
  if (net >= 0) return null
  return (state.resources.food / -net) * HOUR
}

/**
 * Famine : les réserves de nourriture sont vides et les fermes ne suffisent plus.
 * Les troupes ont faim et se battent moins bien (voir STARVATION_ATTACK_MALUS).
 */
export function isStarving(state: GameState): boolean {
  return state.resources.food < 1 && netPerHour(state).food < 0
}

// --- Constructions ---

/** Coût d'un niveau : le coût de base, multiplié par COST_GROWTH à chaque niveau. */
function levelCost(baseCost: Partial<Resources>, level: number): Partial<Resources> {
  const cost: Partial<Resources> = {}
  for (const id of RESOURCE_IDS) {
    const base = baseCost[id]
    if (base) cost[id] = Math.round(base * COST_GROWTH ** (level - 1))
  }
  return cost
}

/** Coût pour amener un bâtiment au niveau `level`. */
export function upgradeCost(building: BuildingDef, level: number): Partial<Resources> {
  return levelCost(building.baseCost, level)
}

/** Durée (en millisecondes) pour amener un bâtiment au niveau `level`, bonus de race et Maçonnerie compris. */
export function upgradeDuration(state: GameState, building: BuildingDef, level: number): number {
  const seconds = building.baseDurationSeconds * DURATION_GROWTH ** (level - 1)
  const speedUp = getRace(state.race).constructionSpeedBonus + techBonus(state, 'constructionSpeed')
  return Math.round(seconds * (1 - speedUp) * SECOND)
}

/** Le nombre de chantiers possibles en même temps : un, puis deux à partir d'un niveau du Château. */
export function maxConstructions(state: GameState): number {
  return state.levels.castle >= SECOND_CONSTRUCTION_CASTLE_LEVEL ? 2 : 1
}

/** Le chantier en cours sur ce bâtiment, s'il y en a un. */
export function constructionOf(state: GameState, buildingId: BuildingId): Construction | undefined {
  return state.constructions.find((construction) => construction.building === buildingId)
}

export function checkUpgrade(state: GameState, buildingId: BuildingId): Check {
  const building = getBuilding(buildingId)
  const level = state.levels[buildingId]
  const castleLevel = state.levels.castle

  if (level >= MAX_LEVEL) return { ok: false, reason: 'Niveau maximum atteint' }
  if (level === 0 && castleLevel < building.unlockedAtCastleLevel) {
    return { ok: false, reason: `Se débloque au Château niveau ${building.unlockedAtCastleLevel}` }
  }
  if (buildingId !== 'castle' && level + 1 > castleLevel) {
    return { ok: false, reason: `Nécessite le Château niveau ${level + 1}` }
  }
  if (constructionOf(state, buildingId)) return { ok: false, reason: 'Ce bâtiment est déjà en chantier' }
  const slots = maxConstructions(state)
  if (state.constructions.length >= slots) {
    return { ok: false, reason: slots === 1 ? 'Un chantier est déjà en cours' : `Tes ${slots} chantiers sont occupés` }
  }
  return checkPay(state, upgradeCost(building, level + 1))
}

/** Lance l'amélioration d'un bâtiment : retire son coût et ouvre le chantier. */
export function startUpgrade(state: GameState, buildingId: BuildingId, now: number): GameState {
  const current = advance(state, now)
  const check = checkUpgrade(current, buildingId)
  if (!check.ok) throw new Error(check.reason)

  const building = getBuilding(buildingId)
  const targetLevel = current.levels[buildingId] + 1
  return {
    ...current,
    resources: addResources(current.resources, upgradeCost(building, targetLevel), -1),
    constructions: [
      ...current.constructions,
      { building: buildingId, targetLevel, startedAt: now, endsAt: now + upgradeDuration(current, building, targetLevel) },
    ],
  }
}

// --- Recherches ---

/**
 * Bonus total apporté par les recherches pour un type d'effet : 0.15 = +15 %,
 * ou un nombre d'armées supplémentaires. Pour la production, on précise la ressource.
 */
export function techBonus(state: GameState, kind: TechEffect['kind'], resource?: ResourceId): number {
  let total = 0
  for (const tech of TECHS) {
    const effect = tech.effect
    if (effect.kind !== kind) continue
    if (effect.kind === 'production' && (!resource || !effect.resources.includes(resource))) continue
    total += effect.perLevel * state.techs[tech.id]
  }
  return total
}

export function researchCost(tech: TechDef, level: number): Partial<Resources> {
  return levelCost(tech.baseCost, level)
}

/** Durée (en millisecondes) d'une recherche pour atteindre le niveau `level`. */
export function researchDuration(tech: TechDef, level: number): number {
  return Math.round(tech.baseDurationSeconds * DURATION_GROWTH ** (level - 1) * SECOND)
}

export function checkResearch(state: GameState, techId: TechId): Check {
  const tech = getTech(techId)
  const academy = state.levels.academy
  const level = state.techs[techId]
  if (academy === 0) return { ok: false, reason: 'Construis d’abord l’Académie' }
  if (academy < tech.unlockedAtAcademyLevel) {
    return { ok: false, reason: `Nécessite l’Académie niveau ${tech.unlockedAtAcademyLevel}` }
  }
  if (level >= tech.maxLevel) return { ok: false, reason: 'Niveau maximum atteint' }
  if (level + 1 > academy) return { ok: false, reason: `Nécessite l’Académie niveau ${level + 1}` }
  if (state.research) return { ok: false, reason: 'Une recherche est déjà en cours' }
  return checkPay(state, researchCost(tech, level + 1))
}

/** Lance une recherche : retire son coût, le nouveau niveau s'applique à la fin. */
export function startResearch(state: GameState, techId: TechId, now: number): GameState {
  const current = advance(state, now)
  const check = checkResearch(current, techId)
  if (!check.ok) throw new Error(check.reason)

  const tech = getTech(techId)
  const targetLevel = current.techs[techId] + 1
  return {
    ...current,
    resources: addResources(current.resources, researchCost(tech, targetLevel), -1),
    research: { tech: techId, targetLevel, startedAt: now, endsAt: now + researchDuration(tech, targetLevel) },
  }
}

// --- Entraînement des troupes ---

/** Nombre maximum de troupes par entraînement : il augmente avec le niveau de la Caserne. */
export function maxTrainingBatch(state: GameState): number {
  return TRAINING_BATCH_PER_LEVEL * state.levels.barracks
}

export function trainingCost(unit: UnitDef, count: number): Partial<Resources> {
  const cost: Partial<Resources> = {}
  for (const id of RESOURCE_IDS) {
    const each = unit.cost[id]
    if (each) cost[id] = each * count
  }
  return cost
}

/** Durée (en millisecondes) pour entraîner `count` troupes, bonus de race et de Caserne compris. */
export function trainingDuration(state: GameState, unit: UnitDef, count: number): number {
  const barracksSpeedUp = (1 - BARRACKS_SPEED_PER_LEVEL) ** Math.max(0, state.levels.barracks - 1)
  const raceSpeedUp = 1 - getRace(state.race).trainingSpeedBonus
  return Math.round(unit.trainingSeconds * count * barracksSpeedUp * raceSpeedUp * SECOND)
}

export function checkTraining(state: GameState, unitId: UnitId, count: number): Check {
  const unit = getUnit(unitId)
  const barracks = state.levels.barracks
  if (unit.race && unit.race !== state.race) return { ok: false, reason: `Réservés aux ${getRace(unit.race).name}` }
  if (barracks === 0) return { ok: false, reason: 'Construis d’abord la Caserne' }
  if (barracks < unit.barracksLevel) {
    return { ok: false, reason: `Nécessite la Caserne niveau ${unit.barracksLevel}` }
  }
  if (!Number.isInteger(count) || count < 1) return { ok: false, reason: 'Choisis combien de troupes entraîner' }
  if (count > maxTrainingBatch(state)) {
    return { ok: false, reason: `${maxTrainingBatch(state)} troupes au maximum à la fois` }
  }
  // Chaque type de troupe s'entraîne de son côté : un seul entraînement à la fois par type.
  if (state.trainings.some((t) => t.unit === unitId)) {
    return { ok: false, reason: `Des ${unit.name} sont déjà à l’entraînement` }
  }
  return checkCost(state.resources, trainingCost(unit, count))
}

/** Lance un entraînement : retire son coût, les troupes arrivent à la fin. */
export function startTraining(state: GameState, unitId: UnitId, count: number, now: number): GameState {
  const current = advance(state, now)
  const check = checkTraining(current, unitId, count)
  if (!check.ok) throw new Error(check.reason)

  const unit = getUnit(unitId)
  return {
    ...current,
    resources: addResources(current.resources, trainingCost(unit, count), -1),
    trainings: [
      ...current.trainings,
      { unit: unitId, count, startedAt: now, endsAt: now + trainingDuration(current, unit, count) },
    ],
  }
}

// --- L'hôpital ---

/** Deux groupes de troupes réunis. */
function addArmies(a: Army, b: Army): Army {
  const sum = emptyArmy()
  for (const id of UNIT_IDS) sum[id] = a[id] + b[id]
  return sum
}

/** Les lits de l'hôpital : aucun sans hôpital, puis HOSPITAL_BEDS_GROWTH fois plus à chaque niveau. */
export function hospitalBeds(state: GameState): number {
  const level = state.levels.hospital
  return level > 0 ? Math.floor(HOSPITAL_BEDS_BASE * HOSPITAL_BEDS_GROWTH ** (level - 1)) : 0
}

/** Les lits encore libres : sans blessé qui attend, ni blessé en soins. */
export function freeBeds(state: GameState): number {
  const occupied = armySize(state.wounded) + (state.healing ? armySize(state.healing.troops) : 0)
  return Math.max(0, hospitalBeds(state) - occupied)
}

/**
 * Des troupes sont tombées : une part n'est que blessée (WOUNDED_SHARE, arrondie au-dessus) et va à
 * l'hôpital, dans la limite de ses lits libres ; les autres meurent. Quand les lits manquent, chaque
 * sorte de troupe en reçoit selon son nombre de blessés. Renvoie la partie, et les blessés.
 */
function woundFallen(state: GameState, fallen: Army): { state: GameState; wounded: Army } {
  const hurt = emptyArmy()
  for (const id of UNIT_IDS) hurt[id] = Math.max(0, Math.ceil(fallen[id] * WOUNDED_SHARE - 1e-9))
  const free = freeBeds(state)
  const wounded = emptyArmy()
  if (armySize(hurt) <= free) Object.assign(wounded, hurt)
  else apportion(free, UNIT_IDS.map((id) => hurt[id])).forEach((count, i) => (wounded[UNIT_IDS[i]] = count))
  if (armySize(wounded) === 0) return { state, wounded }
  return { state: { ...state, wounded: addArmies(state.wounded, wounded) }, wounded }
}

/** Ce que coûte la guérison de ces blessés : une part de leur entraînement (HEAL_COST_SHARE), arrondie au-dessus. */
export function healingCost(troops: Army): Partial<Resources> {
  const cost: Partial<Resources> = {}
  for (const id of RESOURCE_IDS) {
    const training = UNIT_IDS.reduce((sum, unit) => sum + troops[unit] * (getUnit(unit).cost[id] ?? 0), 0)
    if (training > 0) cost[id] = Math.ceil(training * HEAL_COST_SHARE - 1e-9)
  }
  return cost
}

/** Combien de temps (en millisecondes) dure leur guérison : une part de leur entraînement (HEAL_TIME_SHARE). */
export function healingDuration(state: GameState, troops: Army): number {
  const training = UNIT_IDS.reduce((sum, id) => sum + trainingDuration(state, getUnit(id), troops[id]), 0)
  return Math.round(training * HEAL_TIME_SHARE)
}

export function checkHealing(state: GameState, troops: Army): Check {
  if (state.levels.hospital === 0) return { ok: false, reason: 'Construis d’abord l’Hôpital' }
  if (state.healing) return { ok: false, reason: 'Des blessés sont déjà en soins' }
  if (UNIT_IDS.some((id) => !Number.isInteger(troops[id]) || troops[id] < 0)) {
    return { ok: false, reason: 'Nombre de blessés invalide' }
  }
  if (armySize(troops) === 0) return { ok: false, reason: 'Choisis les blessés à soigner' }
  if (UNIT_IDS.some((id) => troops[id] > state.wounded[id])) return { ok: false, reason: 'Tu n’as pas autant de blessés' }
  return checkCost(state.resources, healingCost(troops))
}

/** Soigne des blessés : leur guérison coûte une part de leur entraînement, et ils rejoignent la garnison à la fin. */
export function startHealing(state: GameState, troops: Army, now: number): GameState {
  const current = advance(state, now)
  const check = checkHealing(current, troops)
  if (!check.ok) throw new Error(check.reason)
  const wounded = { ...current.wounded }
  for (const id of UNIT_IDS) wounded[id] -= troops[id]
  return {
    ...current,
    resources: addResources(current.resources, healingCost(troops), -1),
    wounded,
    healing: { troops: { ...troops }, startedAt: now, endsAt: now + healingDuration(current, troops) },
  }
}

// --- Les sorts de la Tour des mages ---

export function getSpell(id: SpellId): SpellDef {
  return byId(SPELLS, id)
}

/** Ce que les sorts en cours apportent, pour un type d'effet (et une ressource, pour la production). */
export function spellBonus(state: GameState, kind: SpellEffect['kind'], resource?: ResourceId): number {
  let total = 0
  for (const active of state.spells) {
    const effect = getSpell(active.spell).effect
    if (effect.kind !== kind) continue
    if (effect.kind === 'production' && (!resource || !effect.resources.includes(resource))) continue
    total += 'amount' in effect ? effect.amount : 1
  }
  return total
}

/** Jusqu'à quand un sort cache la cité aux raids (la Brume d'oubli), ou null s'il n'y en a pas. */
export function raidsHeldUntil(state: GameState): number | null {
  const veils = state.spells.filter((active) => getSpell(active.spell).effect.kind === 'noRaids').map((active) => active.endsAt)
  return veils.length > 0 ? Math.max(...veils) : null
}

export function checkCast(state: GameState, spellId: SpellId): Check {
  const spell = getSpell(spellId)
  const tower = state.levels.mageTower
  if (tower === 0) return { ok: false, reason: 'Construis d’abord la Tour des mages' }
  if (tower < spell.towerLevel) return { ok: false, reason: `Nécessite la Tour des mages niveau ${spell.towerLevel}` }
  if (state.spells.some((active) => active.spell === spellId)) return { ok: false, reason: 'Ce sort agit déjà' }
  const ready = state.spellsReadyAt[spellId]
  if (ready !== undefined && state.updatedAt < ready) return { ok: false, reason: 'Ce sort se recharge' }
  return checkPay(state, spell.cost)
}

/** Lance un sort : il coûte du mana, et agit tout de suite, pour sa durée. */
export function castSpell(state: GameState, spellId: SpellId, now: number): GameState {
  const current = advance(state, now)
  const check = checkCast(current, spellId)
  if (!check.ok) throw new Error(check.reason)
  const spell = getSpell(spellId)
  const endsAt = now + spell.durationSeconds * SECOND
  return {
    ...current,
    resources: addResources(current.resources, spell.cost, -1),
    spells: [...current.spells, { spell: spellId, endsAt }],
    // Un sort qui se recharge ne pourra être relancé qu'un moment après sa fin.
    spellsReadyAt: spell.rechargeSeconds
      ? { ...current.spellsReadyAt, [spellId]: endsAt + spell.rechargeSeconds * SECOND }
      : current.spellsReadyAt,
  }
}

// --- Les quêtes : une suite d'objectifs, chacun avec sa récompense ---

export function getQuest(id: string): QuestDef {
  return byId(QUESTS, id)
}

/** Où en est un objectif : la valeur atteinte, et celle à atteindre. */
export function questProgress(state: GameState, quest: QuestDef): { current: number; target: number } {
  const goal = quest.goal
  switch (goal.kind) {
    case 'building':
      return { current: state.levels[goal.building], target: goal.level }
    case 'troops':
      return { current: allTroops(state)[goal.unit], target: goal.count }
    case 'heroes':
      return { current: state.heroes.length, target: goal.count }
    case 'heroLevel':
      return { current: Math.max(0, ...state.heroes.map((hero) => hero.level)), target: goal.level }
    case 'research':
      return { current: Object.values(state.techs).reduce((sum, level) => sum + level, 0), target: goal.levels }
    case 'victories':
      return { current: state.stats.victories, target: goal.count }
    case 'bands':
      return { current: state.stats.bandsDefeated, target: goal.count }
    case 'gathered':
      // Les petites quantités récoltées à chaque seconde s'additionnent avec des arrondis (379,9999…) :
      // on ne veut ni afficher 379 pour 380, ni bloquer l'objectif à un cheveu du but.
      return { current: Math.floor(state.stats.gathered + 1e-6), target: goal.amount }
    case 'raids':
      return { current: state.stats.raidsRepelled, target: goal.count }
    case 'camp':
      return { current: state.stats.campsDefeated[goal.camp] ?? 0, target: goal.count }
    case 'dragonLevel':
      return { current: dragonLevel(state), target: goal.level }
  }
}

export function questDone(state: GameState, quest: QuestDef): boolean {
  const { current, target } = questProgress(state, quest)
  return current >= target
}

/** L'objectif du moment : le premier de la liste dont la récompense n'a pas été reçue (null : tout est fait). */
export function currentQuest(state: GameState): QuestDef | null {
  return QUESTS.find((quest) => !state.quests.includes(quest.id)) ?? null
}

export function checkClaim(state: GameState, questId: string): Check {
  if (state.quests.includes(questId)) return { ok: false, reason: 'Récompense déjà reçue' }
  if (currentQuest(state)?.id !== questId) return { ok: false, reason: 'Termine d’abord l’objectif en cours' }
  if (!questDone(state, getQuest(questId))) return { ok: false, reason: 'Objectif pas encore atteint' }
  return { ok: true }
}

/** Reçoit la récompense de l'objectif atteint : l'objectif suivant devient l'objectif du moment. */
export function claimQuest(state: GameState, questId: string, now: number): GameState {
  const current = advance(state, now)
  const check = checkClaim(current, questId)
  if (!check.ok) throw new Error(check.reason)
  const quest = getQuest(questId)
  // Un œuf de dragon : il attend dans la cité qu'on le couve.
  const egg: Dragon | null =
    quest.gift === 'dragonEgg' && current.dragon === null
      ? { stage: 'egg', hatchAt: null, xp: 0, restUntil: null }
      : current.dragon
  return {
    ...current,
    resources: addResources(current.resources, quest.reward),
    quests: [...current.quests, questId],
    dragon: egg,
  }
}

// --- Le dragon : on couve son œuf, il grandit en combattant, il accompagne une armée ---

/** L'expérience totale qu'il faut au dragon pour atteindre ce niveau. */
export function dragonXpForLevel(level: number): number {
  let xp = 0
  for (let l = 1; l < level; l++) xp += DRAGON_BASE_XP * DRAGON_XP_GROWTH ** (l - 1)
  return Math.round(xp)
}

/** Le niveau du dragon : celui que lui vaut son expérience, sans dépasser son aire (0 avant sa naissance). */
export function dragonLevel(state: GameState): number {
  const dragon = state.dragon
  if (!dragon || dragon.stage !== 'grown') return 0
  let level = 1
  while (level < DRAGON_MAX_LEVEL && dragon.xp >= dragonXpForLevel(level + 1)) level++
  return Math.max(1, Math.min(level, state.levels.dragonRoost))
}

/** L'attaque et la vie du dragon à ce niveau. */
export function dragonAttack(level: number): number {
  return DRAGON_ATTACK * DRAGON_GROWTH ** (level - 1)
}

export function dragonHealth(level: number): number {
  return DRAGON_HEALTH * DRAGON_GROWTH ** (level - 1)
}

/** L'armée que le dragon accompagne, s'il est dehors. */
export function dragonArmy(state: GameState): FieldArmy | undefined {
  return state.armies.find((army) => army.dragon)
}

/** Le dragon se repose-t-il dans son aire, blessé, à l'instant `at` ? */
export function dragonResting(state: GameState, at = state.updatedAt): boolean {
  const rest = state.dragon?.restUntil ?? null
  return rest !== null && rest > at
}

/** Le dragon peut-il partir avec une nouvelle armée ? */
export function checkDragon(state: GameState): Check {
  if (state.dragon?.stage !== 'grown') return { ok: false, reason: 'Tu n’as pas encore de dragon' }
  if (dragonArmy(state)) return { ok: false, reason: 'Le dragon accompagne déjà une armée' }
  if (dragonResting(state)) return { ok: false, reason: 'Le dragon, blessé, se repose dans son aire' }
  return { ok: true }
}

/** Le dragon est-il dans son aire, en forme, pour défendre la cité à l'instant `at` ? */
function dragonAtHome(state: GameState, at: number): boolean {
  return state.dragon?.stage === 'grown' && !dragonArmy(state) && !dragonResting(state, at)
}

export function checkHatch(state: GameState): Check {
  const dragon = state.dragon
  if (!dragon) return { ok: false, reason: 'Il te faut d’abord un œuf de dragon' }
  if (dragon.stage === 'hatching') return { ok: false, reason: 'L’œuf est déjà en train d’éclore' }
  if (dragon.stage === 'grown') return { ok: false, reason: 'Le dragon est déjà né' }
  if (state.levels.dragonRoost < 1) return { ok: false, reason: 'Construis d’abord l’Aire du dragon' }
  return checkPay(state, DRAGON_HATCH_COST)
}

/** On couve l'œuf dans l'Aire du dragon : il éclora dans DRAGON_HATCH_SECONDS. */
export function hatchEgg(state: GameState, now: number): GameState {
  const current = advance(state, now)
  const check = checkHatch(current)
  if (!check.ok) throw new Error(check.reason)
  return {
    ...current,
    resources: addResources(current.resources, DRAGON_HATCH_COST, -1),
    dragon: { stage: 'hatching', hatchAt: now + DRAGON_HATCH_SECONDS * SECOND, xp: 0, restUntil: null },
  }
}

/**
 * Le dragon d'une bataille gagne de l'expérience pour chaque monstre vaincu. S'il est tombé, il
 * regagne son aire pour se reposer. Renvoie la partie, et ce qu'il a gagné.
 */
function dragonAfterBattle(
  state: GameState,
  ally: AllyFighter,
  xp: number,
  at: number,
  outcome: Outcome,
): { state: GameState; gain: DragonGain | null } {
  const dragon = state.dragon
  if (!ally.dragon || !dragon) return { state, gain: null }
  const before = dragonLevel(state)
  // Tombé au combat, ou resté seul quand toute son escorte est tombée : il regagne son aire et s'y repose.
  const wounded = ally.dragon.health <= 1e-9 || (ally.siege === null && outcome === 'defeat')
  const next: GameState = {
    ...state,
    dragon: { ...dragon, xp: dragon.xp + xp, restUntil: wounded ? at + DRAGON_REST_SECONDS * SECOND : dragon.restUntil },
  }
  const level = dragonLevel(next)
  return { state: next, gain: { xp, level, levelsGained: level - before, wounded } }
}

/** Le dragon, tel qu'il entre dans une bataille, avec les bonus de vie de son camp. */
function battleDragon(state: GameState, healthFactor: number): BattleDragon {
  const level = dragonLevel(state)
  const health = dragonHealth(level) * healthFactor
  return { attack: dragonAttack(level), start: health, health }
}

// --- Les héros : on les recrute, ils gagnent de l'expérience et apprennent des compétences ---

export function getHeroDef(id: HeroId): HeroDef {
  return byId(HEROES, id)
}

/** Un héros recruté, ou undefined s'il n'est pas (encore) à ton service. */
export function getHero(state: GameState, id: HeroId): Hero | undefined {
  return state.heroes.find((hero) => hero.id === id)
}

/** L'armée que mène ce héros, ou undefined s'il attend à la cité. */
export function heroArmy(state: GameState, id: HeroId): FieldArmy | undefined {
  return state.armies.find((army) => army.hero === id)
}

/** L'expérience qu'il faut pour passer du niveau `level` au suivant. */
export function xpToNextLevel(level: number): number {
  return Math.round(HERO_BASE_XP * HERO_XP_GROWTH ** (level - 1))
}

/** Les points de compétence qui restent à placer : un par niveau, le premier compris. */
export function skillPoints(hero: Hero): number {
  return hero.level - Object.values(hero.skills).reduce((sum, level) => sum + level, 0)
}

/** Ajoute de l'expérience à un héros : il gagne autant de niveaux qu'elle le permet. */
export function gainXp(hero: Hero, xp: number): Hero {
  let level = hero.level
  let rest = hero.xp + xp
  while (level < HERO_MAX_LEVEL && rest >= xpToNextLevel(level)) {
    rest -= xpToNextLevel(level)
    level++
  }
  // Au niveau maximum, l'expérience ne sert plus à rien.
  return { ...hero, level, xp: level >= HERO_MAX_LEVEL ? 0 : rest }
}

/**
 * Ce que les compétences d'un héros apportent à son armée, pour un type d'effet : 0.12 veut dire
 * +12 %. `family` dit quelles troupes sont concernées par un effet 'familyAttack'.
 */
export function heroBonus(
  state: GameState,
  heroId: HeroId | null,
  kind: SkillEffect['kind'],
  family?: Family,
): number {
  const hero = heroId === null ? undefined : getHero(state, heroId)
  if (!hero) return 0
  return getHeroDef(hero.id).skills.reduce((sum, skill) => {
    const effect = skill.effect
    if (effect.kind !== kind || (effect.kind === 'familyAttack' && effect.family !== family)) return sum
    return sum + effect.perLevel * (hero.skills[skill.id] ?? 0)
  }, 0)
}

export function checkRecruit(state: GameState, heroId: HeroId): Check {
  const hero = getHeroDef(heroId)
  if (getHero(state, heroId)) return { ok: false, reason: 'Ce héros est déjà à ton service' }
  if (state.levels.castle < hero.castleLevel) {
    return { ok: false, reason: `Nécessite le Château niveau ${hero.castleLevel}` }
  }
  return checkPay(state, hero.cost)
}

/** Recrute un héros : il arrive au niveau 1, avec un point de compétence à placer. */
export function recruitHero(state: GameState, heroId: HeroId, now: number): GameState {
  const current = advance(state, now)
  const check = checkRecruit(current, heroId)
  if (!check.ok) throw new Error(check.reason)
  return {
    ...current,
    resources: addResources(current.resources, getHeroDef(heroId).cost, -1),
    heroes: [...current.heroes, { id: heroId, level: 1, xp: 0, skills: {} }],
  }
}

export function checkSkill(state: GameState, heroId: HeroId, skillId: string): Check {
  const hero = getHero(state, heroId)
  if (!hero) return { ok: false, reason: 'Recrute d’abord ce héros' }
  if (!getHeroDef(heroId).skills.some((skill) => skill.id === skillId)) {
    return { ok: false, reason: 'Ce héros n’a pas cette compétence' }
  }
  if ((hero.skills[skillId] ?? 0) >= SKILL_MAX_LEVEL) return { ok: false, reason: 'Niveau maximum atteint' }
  if (skillPoints(hero) <= 0) {
    return { ok: false, reason: 'Aucun point de compétence : le héros doit gagner un niveau' }
  }
  return { ok: true }
}

/** Place un point de compétence : la compétence gagne un niveau, et son effet compte aussitôt. */
export function learnSkill(state: GameState, heroId: HeroId, skillId: string, now: number): GameState {
  const current = advance(state, now)
  const check = checkSkill(current, heroId, skillId)
  if (!check.ok) throw new Error(check.reason)
  const hero = getHero(current, heroId)!
  return updateHero(current, { ...hero, skills: { ...hero.skills, [skillId]: (hero.skills[skillId] ?? 0) + 1 } })
}

function updateHero(state: GameState, hero: Hero): GameState {
  return { ...state, heroes: state.heroes.map((h) => (h.id === hero.id ? hero : h)) }
}

// --- Les armées dehors : on les envoie, puis on leur donne des ordres ---

/** Nombre d'armées qui peuvent être dehors en même temps : 1, plus le Commandement. */
export function maxArmies(state: GameState): number {
  return 1 + techBonus(state, 'armies')
}

/** Vitesse de marche d'une armée, en unités de carte par seconde : la Marche forcée, son héros et les sorts l'augmentent. */
export function marchSpeed(state: GameState, hero: HeroId | null = null): number {
  const bonus = techBonus(state, 'marchSpeed') + heroBonus(state, hero, 'marchSpeed') + spellBonus(state, 'marchSpeed')
  return MARCH_SPEED / (1 - bonus)
}

/** Durée (en millisecondes) d'une marche de `from` à `to`, montagnes contournées, avec ce héros à sa tête. */
export function marchDuration(state: GameState, from: Point, to: Point, hero: HeroId | null = null): number {
  const route = routeBetween(state, from, to)
  return Math.round(((route ? routeLength(route) : distance(from, to)) / marchSpeed(state, hero)) * SECOND)
}

// --- Le relief : les montagnes, et la porte du grand campement ---

// Deux tableaux qui ne changent pas, pour que les détours ne se calculent qu'une fois pour chacun.
const GATE_OPEN: Polygon[] = MOUNTAINS
const GATE_CLOSED: Polygon[] = [...MOUNTAINS, ENCAMPMENT_GATE]

/** Au-delà de la porte du grand campement : dans la région d'au-delà, ou le passage qui y mène. */
function beyondGate(point: Point): boolean {
  return point.x > ENCAMPMENT.center.x + ENCAMPMENT.radius + ENCAMPMENT.gateDepth / 2
}

/**
 * Ce qui barre le chemin d'une armée partie de `from` : les montagnes, et la porte du grand campement
 * tant qu'elle est fermée. Une armée qui se trouve au-delà peut toujours revenir : la porte s'ouvre de
 * ce côté.
 */
export function obstaclesFrom(state: GameState, from: Point): Polygon[] {
  return state.encampment.gateOpen || beyondGate(from) ? GATE_OPEN : GATE_CLOSED
}

/** Le chemin de `from` à `to`, qui contourne les montagnes : [from, …détours, to], ou null si rien n'y mène. */
export function routeBetween(state: GameState, from: Point, to: Point): Point[] | null {
  return findRoute(from, to, obstaclesFrom(state, from), WORLD)
}

/**
 * Les endroits qu'une armée partie de la cité peut atteindre : bandes et gisements ne s'installent
 * que là, pour ne pas occuper la carte au-delà d'une porte fermée.
 */
function reachableFromCity(state: GameState, spots: Point[]): Point[] {
  return spots.filter((spot) => routeBetween(state, WORLD.city, spot) !== null)
}

/** Peut-on voir (et donc attaquer) de `a` à `b`, sans montagne entre les deux ? */
function inSight(state: GameState, a: Point, b: Point): boolean {
  return clear(a, b, obstaclesFrom(state, a))
}

/** Ce qui donne plus de vie aux troupes d'une armée : les Armures, son héros, les sorts (et le mode d'essai). */
function armyHealthFactor(state: GameState, hero: HeroId | null): number {
  return (1 + techBonus(state, 'health') + heroBonus(state, hero, 'health') + spellBonus(state, 'health')) * trialBoost(state)
}

/**
 * L'armée qui va de sa position à `to` passe-t-elle sur un piège encore armé du grand campement ? Il se
 * déclenche : ses dégâts se répartissent entre les troupes selon leur nombre (les Armures, le héros et
 * les sorts les protègent), et il reste désarmé jusqu'au repeuplement. Ce que portaient les troupes
 * tombées reste sur place. Renvoie la partie, et l'armée, ou null si personne n'a survécu.
 */
function springTrap(state: GameState, army: FieldArmy, to: Point, at: number): { state: GameState; army: FieldArmy | null } {
  const { resetAt, sprung } = state.encampment
  if (resetAt === null) return { state, army }
  const trap = ENCAMPMENT_TRAPS.findIndex(
    (point, i) => !sprung.includes(i) && distanceToSegment(point, army.position, to) <= TRAP_RADIUS,
  )
  if (trap < 0) return { state, army }
  const factor = armyHealthFactor(state, army.hero)
  const size = armySize(army.troops)
  const troops = { ...army.troops }
  const lost = emptyArmy()
  for (const id of UNIT_IDS) {
    const damage = (TRAP_DAMAGE * army.troops[id]) / size
    lost[id] = Math.min(army.troops[id], Math.floor(damage / (getUnit(id).health * factor) + 1e-9))
    troops[id] -= lost[id]
  }
  const wiped = armySize(troops) === 0
  const hurt = woundFallen(state, lost)
  // Resté seul, le dragon regagne son aire pour s'y reposer : il ne se bat jamais sans escorte.
  const dragonRests = wiped && army.dragon && state.dragon !== null
  const report: BattleReport = {
    at,
    startedAt: at,
    army: army.id,
    foe: { type: 'trap' },
    foes: [{ type: 'trap' }],
    ambush: true,
    outcome: 'defeat',
    sent: { ...army.troops },
    lost,
    wounded: hurt.wounded,
    enemies: {},
    enemyLost: {},
    loot: {},
    starving: false,
    rounds: [],
    hero: null,
    siege: null,
    dragon: dragonRests ? { xp: 0, level: dragonLevel(state), levelsGained: 0, wounded: true } : null,
  }
  let next: GameState = {
    ...hurt.state,
    encampment: { ...state.encampment, sprung: [...sprung, trap] },
    reports: [report, ...state.reports].slice(0, MAX_REPORTS),
  }
  if (!wiped) return { state: next, army: { ...army, troops, load: fitLoad(army.load, carryCapacity(next, troops, army.hero)) } }
  next = removeArmy(next, army.id)
  if (dragonRests && next.dragon) next = { ...next, dragon: { ...next.dragon, restUntil: at + DRAGON_REST_SECONDS * SECOND } }
  // Personne pour porter la clef : elle retourne à son gardien.
  return { state: army.key ? returnKey(next, at) : next, army: null }
}

/** Ce qu'une armée peut porter : le butin et la récolte. Son héros peut l'augmenter. */
export function carryCapacity(state: GameState, troops: Army, hero: HeroId | null = null): number {
  const base = UNIT_IDS.reduce((sum, id) => sum + troops[id] * getUnit(id).load, 0)
  return base * (1 + heroBonus(state, hero, 'load'))
}

/** Ce qu'une armée récolte par seconde sur un gisement de cette ressource. */
export function gatherRate(state: GameState, troops: Army, resource: ResourceId, hero: HeroId | null = null): number {
  return armySize(troops) * NODE_KINDS[resource].gatherRate * (1 + heroBonus(state, hero, 'gatherSpeed'))
}

/** Ce qu'une armée porte déjà. */
export function loadSize(load: Partial<Resources>): number {
  return RESOURCE_IDS.reduce((sum, id) => sum + (load[id] ?? 0), 0)
}

/** Où se trouve une cible à l'instant `at` (une bande bouge), ou null si elle n'est plus là. */
export function targetPosition(state: GameState, target: Target, at = state.updatedAt): Point | null {
  switch (target.type) {
    case 'point':
      return { x: target.x, y: target.y }
    case 'camp':
      return getCamp(target.camp).position
    case 'band': {
      const band = getBand(state, target.band)
      return band ? bandPosition(band, at) : null
    }
    case 'node':
      return getNode(state, target.node)?.position ?? null
    case 'city':
      return WORLD.city
  }
}

/** Ces deux cibles sont-elles la même ? */
export function sameTarget(a: Target, b: Target): boolean {
  switch (a.type) {
    case 'point':
      return b.type === 'point' && a.x === b.x && a.y === b.y
    case 'camp':
      return b.type === 'camp' && a.camp === b.camp
    case 'band':
      return b.type === 'band' && a.band === b.band
    case 'node':
      return b.type === 'node' && a.node === b.node
    case 'city':
      return b.type === 'city'
  }
}

/** L'armée qui récolte ce gisement, ou qui est en route pour le faire. */
export function nodeGatherer(state: GameState, nodeId: number): FieldArmy | undefined {
  return state.armies.find((army) => army.order?.type === 'node' && army.order.node === nodeId)
}

/** Une cible valable ? (`armyId` : l'armée qui reçoit l'ordre, ou null pour une armée qui sort de la cité.) */
function checkTarget(state: GameState, target: Target, armyId: number | null): Check {
  const kind = checkTargetKind(state, target, armyId)
  if (!kind.ok || target.type === 'city') return kind
  // Encore faut-il qu'un chemin y mène, depuis la cité ou depuis là où se trouve l'armée.
  const origin = armyId === null ? WORLD.city : getArmy(state, armyId)?.position
  const position = targetPosition(state, target)
  if (origin && position && !routeBetween(state, origin, position)) {
    return { ok: false, reason: 'Aucun chemin n’y mène : la porte du grand campement est fermée' }
  }
  return { ok: true }
}

function checkTargetKind(state: GameState, target: Target, armyId: number | null): Check {
  switch (target.type) {
    case 'point': {
      const inside = target.x >= 0 && target.x <= WORLD.width && target.y >= 0 && target.y <= WORLD.height
      if (!inside) return { ok: false, reason: 'Cet endroit est hors de la carte' }
      if (insideAny(target, GATE_CLOSED)) return { ok: false, reason: 'Aucune armée ne peut franchir ces montagnes' }
      return { ok: true }
    }
    case 'camp':
      getCamp(target.camp)
      if (campEmptyUntil(state, target.camp) !== null) {
        return { ok: false, reason: 'Ce camp est vide : ses monstres ne sont pas encore revenus' }
      }
      return { ok: true }
    case 'band':
      return getBand(state, target.band) ? { ok: true } : { ok: false, reason: 'Cette bande n’est plus là' }
    case 'node': {
      if (!getNode(state, target.node)) return { ok: false, reason: 'Ce gisement est épuisé' }
      const gatherer = nodeGatherer(state, target.node)
      if (gatherer && gatherer.id !== armyId) return { ok: false, reason: 'Une de tes armées récolte déjà ici' }
      return { ok: true }
    }
    case 'city':
      return armyId === null ? { ok: false, reason: 'Ton armée est déjà à la cité' } : { ok: true }
  }
}

/** Vérifie une sélection de troupes prises dans la cité. */
function checkSelection(state: GameState, troops: Army): Check {
  if (UNIT_IDS.some((id) => !Number.isInteger(troops[id]) || troops[id] < 0)) {
    return { ok: false, reason: 'Nombre de troupes invalide' }
  }
  if (armySize(troops) === 0) return { ok: false, reason: 'Choisis au moins une troupe' }
  if (UNIT_IDS.some((id) => troops[id] > state.troops[id])) {
    return { ok: false, reason: 'Tu n’as pas autant de troupes' }
  }
  return { ok: true }
}

/** Une nouvelle armée peut-elle sortir de la cité vers cette cible, quelles que soient ses troupes ? */
export function checkMarchSlot(state: GameState, target: Target): Check {
  const valid = checkTarget(state, target, null)
  if (!valid.ok) return valid
  if (siegeOf(state)) return { ok: false, reason: BESIEGED }
  const max = maxArmies(state)
  if (state.armies.length >= max) {
    return { ok: false, reason: max === 1 ? 'Ton armée est déjà dehors' : `Tes ${max} armées sont déjà dehors` }
  }
  return { ok: true }
}

/** Le héros choisi peut-il mener une nouvelle armée ? (null : l'armée part sans héros.) */
function checkHero(state: GameState, hero: HeroId | null): Check {
  if (hero === null) return { ok: true }
  if (!getHero(state, hero)) return { ok: false, reason: 'Recrute d’abord ce héros' }
  if (heroArmy(state, hero)) return { ok: false, reason: `${getHeroDef(hero).name} mène déjà une armée` }
  return { ok: true }
}

export function checkMarch(
  state: GameState,
  target: Target,
  troops: Army,
  hero: HeroId | null = null,
  dragon = false,
): Check {
  const slot = checkMarchSlot(state, target)
  if (!slot.ok) return slot
  const selection = checkSelection(state, troops)
  if (!selection.ok) return selection
  const leader = checkHero(state, hero)
  if (!leader.ok) return leader
  return dragon ? checkDragon(state) : { ok: true }
}

/** Une armée sort de la cité, avec un premier ordre : aller quelque part, attaquer ou récolter. Un héros peut la mener. */
export function startMarch(
  state: GameState,
  target: Target,
  troops: Army,
  now: number,
  hero: HeroId | null = null,
  dragon = false,
): GameState {
  const current = advance(state, now)
  const check = checkMarch(current, target, troops, hero, dragon)
  if (!check.ok) throw new Error(check.reason)

  const home = { ...current.troops }
  for (const id of UNIT_IDS) home[id] -= troops[id]
  const army: FieldArmy = {
    id: current.nextId,
    troops: { ...troops },
    position: { ...WORLD.city },
    order: { ...target },
    status: 'marching',
    load: {},
    fought: [],
    escaped: [],
    hero,
    dragon,
    key: false,
  }
  return { ...current, troops: home, armies: [...current.armies, army], nextId: current.nextId + 1 }
}

/**
 * Un ordre possible pour cette armée ? Pendant une mêlée, elle peut se tourner vers un autre
 * adversaire de la mêlée, s'il reste une place autour de lui ; mais pas vers celui qu'elle frappe déjà
 * (elle battrait en retraite pour aussitôt reprendre le même combat, ses blessés remis sur pied).
 */
export function checkOrder(state: GameState, armyId: number, target: Target): Check {
  if (!getArmy(state, armyId)) return { ok: false, reason: 'Cette armée n’est plus dehors' }
  const fighting = armyBattle(state, armyId)
  const ref = targetRef(target)
  if (fighting && ref !== null) {
    if (fighting.ally.target === ref) return { ok: false, reason: 'Ton armée combat déjà cette cible' }
    const foe = fighting.battle.foes.find((f) => f.ref === ref)
    if (foe) {
      const free = attackersOf(fighting.battle, foe.ref).length < MAX_ATTACKERS
      return free ? { ok: true } : { ok: false, reason: `Plus de place autour de cette cible : ${MAX_ATTACKERS} troupes la frappent déjà` }
    }
  }
  return checkTarget(state, target, armyId)
}

/**
 * Un nouvel ordre pour une armée dehors. Si elle se bat, elle se tourne vers un autre adversaire de sa
 * mêlée, ou bat en retraite pour partir ailleurs.
 */
export function orderArmy(state: GameState, armyId: number, target: Target, now: number): GameState {
  const current = advance(state, now)
  const check = checkOrder(current, armyId, target)
  if (!check.ok) throw new Error(check.reason)

  const fighting = armyBattle(current, armyId)
  const foe = fighting?.battle.foes.find((f) => f.ref === targetRef(target))
  if (fighting && foe) return switchTarget(current, fighting.battle, fighting.ally, foe, now)
  const next = fighting
    ? afterLeave(leave(current, fighting.battle.id, fighting.ally.ref, now, 'retreat'), fighting.battle.id, now)
    : current
  const army = getArmy(next, armyId)
  if (!army) return next
  return updateArmy(next, { ...army, order: { ...target }, status: 'marching' })
}

/**
 * Les bandes qui patrouillent près du chemin de `from` à `to` : l'armée risque d'y être attaquée.
 * Un raid compte quand il se trouve en ce moment près de ce chemin.
 */
export function bandsNearPath(state: GameState, from: Point, to: Point, except?: Target): Band[] {
  const center = (band: Band) => (band.raid || band.chase ? bandPosition(band, state.updatedAt) : band.home)
  // Une bande en patrouille voit passer l'armée, et la prend en chasse ; un chef attaque qui l'approche.
  const reach = (band: Band) =>
    band.still ? aggroRadius(band.level) : PATROL_RADIUS + (canChase(band) ? sightRadius(band.level) : aggroRadius(band.level))
  const route = routeBetween(state, from, to) ?? [from, to]
  const near = (band: Band) => route.some((point, i) => i > 0 && distanceToSegment(center(band), route[i - 1], point) <= reach(band))
  return state.bands
    .filter((band) => !(except?.type === 'band' && except.band === band.id))
    .filter(near)
    .sort((a, b) => distance(from, center(a)) - distance(from, center(b)))
}

function updateArmy(state: GameState, army: FieldArmy): GameState {
  return { ...state, armies: state.armies.map((a) => (a.id === army.id ? army : a)) }
}

function removeArmy(state: GameState, id: number): GameState {
  return { ...state, armies: state.armies.filter((a) => a.id !== id) }
}

/** Tout le butin que laisse un adversaire vaincu : un camp, une bande ou un raid (un piège n'en laisse aucun). */
export function foeLoot(foe: Foe): Partial<Resources> {
  if (foe.type === 'trap') return {}
  if (foe.type === 'camp') return { ...getCamp(foe.camp).loot }
  return foe.raid ? raidLoot(foe.kind, foe.level) : bandLoot(foe.kind, foe.level)
}

/** Le camp est vide (vaincu, ses monstres pas encore revenus) : jusqu'à quelle heure ? Sinon null. */
export function campEmptyUntil(state: GameState, camp: CampId, at = state.updatedAt): number | null {
  const back = state.campsCleared[camp]
  return back !== undefined && back > at ? back : null
}

/** Le mode d'essai multiplie l'attaque et la vie des troupes du joueur (et de son dragon). */
export function trialBoost(state: GameState): number {
  return state.trial ? TRIAL_BOOST : 1
}

/** Active ou coupe le mode d'essai. (Le serveur refuse cet ordre : il ne sert qu'aux parties sans compte.) */
export function setTrial(state: GameState, on: boolean, now: number): GameState {
  return { ...advance(state, now), trial: on }
}

/** Ce qu'une armée emporte d'un butin quand elle n'a de place que pour `room` ressources : un peu de chaque. */
export function fitLoad(loot: Partial<Resources>, room: number): Partial<Resources> {
  const size = loadSize(loot)
  if (size <= room) return { ...loot }
  const share = Math.max(0, room) / size
  const taken: Partial<Resources> = {}
  for (const id of RESOURCE_IDS) {
    const amount = Math.floor((loot[id] ?? 0) * share + 1e-9)
    if (amount > 0) taken[id] = amount
  }
  return taken
}

function mergeLoot(a: Partial<Resources>, b: Partial<Resources>): Partial<Resources> {
  const total: Partial<Resources> = { ...a }
  for (const id of RESOURCE_IDS) if (b[id]) total[id] = (total[id] ?? 0) + (b[id] ?? 0)
  return total
}

// --- Le monde, seconde par seconde ---

/**
 * Un pas du monde, à l'instant `at` : d'abord les batailles (une manche quand c'est l'heure), puis
 * les armées (elles marchent, récoltent ou arrivent), puis les bandes lancées à leur poursuite ; une
 * bande au contact d'une armée l'attaque, et enfin les bandes repèrent les armées qu'elles voient.
 */
function worldTick(state: GameState, at: number): GameState {
  let next: GameState = { ...state, tickedAt: at }
  for (const battle of state.battles) {
    if (at >= battle.startedAt + (battle.round + 1) * ROUND) next = playRound(next, battle.id, at)
  }
  for (const army of state.armies) next = stepArmy(next, army.id, at)
  next = stepChases(next, at)
  return spotArmies(checkAggro(openGate(next), at), at)
}

/**
 * Rien ne peut arriver dehors : aucune bataille, aucune bande lancée à une poursuite, et chaque armée
 * attend sur place, hors de vue des bandes. Le monde n'a alors pas besoin d'avancer seconde par
 * seconde. (Un raid arrive à la cité à une heure connue d'avance : sans armée dehors pour le croiser,
 * il n'a pas besoin de ces pas.)
 */
function worldIsQuiet(state: GameState): boolean {
  if (state.battles.length > 0) return false
  // Une bande qui poursuit une armée, ou qui regagne sa ronde, avance à chaque pas.
  if (state.bands.some((band) => band.chase !== null)) return false
  if (state.armies.length === 0) return true
  // Un raid en marche peut croiser une armée, même immobile.
  if (state.bands.some((band) => band.raid)) return false
  const tower = watchtower(state)
  return state.armies.every((army) => army.status === 'idle' && state.bands.every((band) => !threatens(state, band, army, tower)))
}

/**
 * Cette bande pourra-t-elle s'en prendre à cette armée qui attend sur place : la voir en passant sur
 * sa ronde, l'atteindre s'il s'agit d'un chef, ou accourir à l'alerte de la tour de guet ? Sinon, rien
 * ne se passera entre elles tant que personne ne donne d'ordre.
 */
function threatens(state: GameState, band: Band, army: FieldArmy, tower: Band | undefined): boolean {
  if (army.fought.includes(band.id)) return false
  const hunts = canChase(band) && !army.escaped.includes(band.id)
  if (hunts && band.encampment && tower && towerSees(state, tower, army.position)) return true
  const radius = hunts ? sightRadius(band.level) : aggroRadius(band.level)
  if (band.still) return distance(band.home, army.position) <= radius && inSight(state, band.home, army.position)
  return patrolSees(state, band.home, army.position, radius)
}

/**
 * Une bande qui fait sa ronde autour de `home` passera-t-elle à moins de `radius` de `point`, sans
 * montagne entre eux ? (On essaie les endroits de sa ronde tous les quelques pas.)
 */
function patrolSees(state: GameState, home: Point, point: Point, radius: number): boolean {
  if (patrolDistance(home, point) > radius) return false
  const loop = patrolLoop(home)
  return loop.some((from, i) => {
    const to = loop[(i + 1) % loop.length]
    const steps = Math.ceil(distance(from, to) / 4)
    for (let s = 0; s < steps; s++) {
      const spot = along(from, to, s / steps)
      if (distance(spot, point) <= radius && inSight(state, spot, point)) return true
    }
    return false
  })
}

/** Une armée avance d'un pas vers son but, récolte, ou arrive. */
function stepArmy(state: GameState, id: number, at: number): GameState {
  const army = getArmy(state, id)
  if (!army || army.status === 'fighting' || army.status === 'idle') return state
  if (army.status === 'gathering') return gather(state, army, at)

  const order = army.order
  const destination = order && targetPosition(state, order, at)
  // Plus d'ordre, ou la cible a disparu (bande vaincue, gisement épuisé) : l'armée s'arrête là.
  if (!order || !destination) return updateArmy(state, { ...army, order: null, status: 'idle' })

  // Une bande visée : l'armée l'attaque dès qu'elle est à portée (et pas derrière une montagne), en
  // rejoignant la mêlée si la bande se bat déjà ; s'il n'y a plus de place autour d'elle, elle attend.
  if (order.type === 'band') {
    const band = getBand(state, order.band)
    if (band && distance(army.position, destination) <= aggroRadius(band.level) && inSight(state, army.position, destination)) {
      return engage(state, armyRef(army.id), bandRef(band.id), at)
    }
  }
  // L'armée suit son chemin, en contournant les montagnes. Si plus rien n'y mène, elle s'arrête là.
  const route = routeBetween(state, army.position, destination)
  if (!route) return updateArmy(state, { ...army, order: null, status: 'idle' })
  const step = marchSpeed(state, army.hero) * WORLD_TICK_SECONDS
  const arrives = routeLength(route) <= step
  const to = arrives ? { ...destination } : walk(route, step)
  // Un piège caché sur ce bout de chemin ?
  const trapped = springTrap(state, army, to, at)
  if (!trapped.army) return trapped.state
  const moved = updateArmy(trapped.state, { ...trapped.army, position: to })
  return arrives ? arrive(moved, army.id, at) : moved
}

/** L'armée arrive au bout de son chemin. */
function arrive(state: GameState, id: number, at: number): GameState {
  const army = getArmy(state, id)
  if (!army?.order) return state
  switch (army.order.type) {
    case 'city':
      return disband(state, army, at)
    case 'camp': {
      const camp = getCamp(army.order.camp)
      // Une autre armée l'a vidé entre-temps : il n'y a plus personne à combattre. Sinon, elle l'attaque
      // (avec les armées qui l'attaquent déjà) ; s'il n'y a plus de place autour du camp, elle attend.
      if (campEmptyUntil(state, camp.id, at) !== null) return updateArmy(state, { ...army, order: null, status: 'idle' })
      return engage(state, armyRef(army.id), campRef(camp.id), at)
    }
    case 'node':
      return getNode(state, army.order.node)
        ? updateArmy(state, { ...army, status: 'gathering' })
        : updateArmy(state, { ...army, order: null, status: 'idle' })
    case 'band':
    case 'point':
      return updateArmy(state, { ...army, order: null, status: 'idle' })
  }
}

/** L'armée rentre : ses troupes retrouvent la cité, et ce qu'elle porte rejoint les réserves. */
function disband(state: GameState, army: FieldArmy, at: number): GameState {
  const troops = { ...state.troops }
  for (const id of UNIT_IDS) troops[id] += army.troops[id]
  const home = { ...removeArmy(state, army.id), troops, resources: addResources(state.resources, army.load) }
  // La clef du grand campement ne sert qu'à sa porte : rapportée à la cité, elle retourne à son gardien.
  return army.key ? returnKey(home, at) : home
}

/**
 * Une seconde de récolte : chaque troupe ramasse un peu. Quand l'armée ne peut plus rien porter,
 * ou que le gisement est épuisé, elle rentre d'elle-même à la cité.
 */
function gather(state: GameState, army: FieldArmy, at: number): GameState {
  const node = army.order?.type === 'node' ? getNode(state, army.order.node) : undefined
  if (!node) return updateArmy(state, { ...army, order: null, status: 'idle' })
  const room = carryCapacity(state, army.troops, army.hero) - loadSize(army.load)
  const rate = gatherRate(state, army.troops, node.resource, army.hero) * WORLD_TICK_SECONDS
  const amount = Math.max(0, Math.min(rate, room, node.remaining))
  const remaining = node.remaining - amount
  const load = { ...army.load, [node.resource]: (army.load[node.resource] ?? 0) + amount }
  const exhausted = remaining <= 1e-9
  const counted = { ...state, stats: { ...state.stats, gathered: state.stats.gathered + amount } }
  const next = exhausted ? removeNode(counted, node.id, at) : updateNode(counted, { ...node, remaining })
  const done = exhausted || room - amount <= 1e-9
  return updateArmy(next, done ? { ...army, load, order: { type: 'city' }, status: 'marching' } : { ...army, load })
}

/**
 * Une bande attaque toute armée qui entre dans sa zone d'aggro (ou qu'elle a rattrapée), sauf celles
 * qu'elle a déjà combattues ; si l'armée se bat déjà, la bande rejoint la mêlée, tant qu'il reste une
 * place autour de l'armée. L'armée qui marchait sur cette bande l'attaque elle-même : ce n'est pas une
 * embuscade.
 */
function checkAggro(state: GameState, at: number): GameState {
  let next = state
  for (const { id } of state.armies) {
    for (const { id: bandId } of state.bands) {
      const army = getArmy(next, id)
      const band = getBand(next, bandId)
      if (!army) break
      if (!band || bandFighting(next, band.id) || army.fought.includes(band.id)) continue
      const position = bandPosition(band, at)
      if (distance(army.position, position) > aggroRadius(band.level) || !inSight(next, position, army.position)) continue
      const targeted = army.status !== 'fighting' && army.order?.type === 'band' && army.order.band === band.id
      next = targeted ? engage(next, armyRef(id), bandRef(band.id), at) : engage(next, bandRef(band.id), armyRef(id), at, true)
    }
  }
  return next
}

// --- Les batailles : des mêlées, manche par manche ---
//
// Chaque combattant (une de tes armées, la cité pendant un siège, une bande, un raid ou un camp)
// frappe une seule cible, dans l'autre camp, et regarde vers elle. Plusieurs peuvent frapper la même
// cible : chacun prend une des huit places autour d'elle (MAX_ATTACKERS), du côté d'où il arrive.
// Frapper de côté ou de dos donne un bonus ; une troupe frappée d'au moins trois côtés est encerclée,
// et son attaque baisse. La cité, derrière ses murs, n'a ni flancs ni dos.

/** Le nom de la cité dans une mêlée, et celui des autres combattants. */
const CITY_REF = 'city'

function armyRef(id: number): string {
  return `army:${id}`
}

function bandRef(id: number): string {
  return `band:${id}`
}

function campRef(id: CampId): string {
  return `camp:${id}`
}

/** Le combattant de la mêlée qui porte ce nom, d'un camp ou de l'autre. */
export function fighterOf(battle: Battle, ref: string | null): AllyFighter | FoeFighter | undefined {
  if (ref === null) return undefined
  return battle.allies.find((f) => f.ref === ref) ?? battle.foes.find((f) => f.ref === ref)
}

/** Ce combattant est-il de ton camp ? */
export function isAlly(fighter: AllyFighter | FoeFighter): fighter is AllyFighter {
  return 'sent' in fighter
}

function getBattle(state: GameState, id: number): Battle | undefined {
  return state.battles.find((battle) => battle.id === id)
}

function updateBattle(state: GameState, battle: Battle): GameState {
  return { ...state, battles: state.battles.map((b) => (b.id === battle.id ? battle : b)) }
}

function removeBattle(state: GameState, id: number): GameState {
  return { ...state, battles: state.battles.filter((battle) => battle.id !== id) }
}

/** La mêlée où se trouve ce combattant (par son nom). */
function battleWith(state: GameState, ref: string): Battle | undefined {
  return state.battles.find((battle) => fighterOf(battle, ref) !== undefined)
}

/** La mêlée où se bat cette armée, et sa place dans cette mêlée. */
export function armyBattle(state: GameState, armyId: number): { battle: Battle; ally: AllyFighter } | undefined {
  const ref = armyRef(armyId)
  for (const battle of state.battles) {
    const ally = battle.allies.find((f) => f.ref === ref)
    if (ally) return { battle, ally }
  }
  return undefined
}

/** La mêlée où se bat cette bande, et sa place dans cette mêlée. */
export function bandBattle(state: GameState, bandId: number): { battle: Battle; foe: FoeFighter } | undefined {
  const ref = bandRef(bandId)
  for (const battle of state.battles) {
    const foe = battle.foes.find((f) => f.ref === ref)
    if (foe) return { battle, foe }
  }
  return undefined
}

/** La bande se bat-elle en ce moment ? */
export function bandFighting(state: GameState, bandId: number): boolean {
  return bandBattle(state, bandId) !== undefined
}

/** Le nom, dans une mêlée, de ce qu'une armée peut viser : une bande ou un camp (null pour le reste). */
function targetRef(target: Target): string | null {
  if (target.type === 'band') return bandRef(target.band)
  if (target.type === 'camp') return campRef(target.camp)
  return null
}

/** Où se tient un combattant sur la carte. */
export function fighterPosition(state: GameState, ref: string, at = state.updatedAt): Point {
  const [kind, id] = ref.split(':')
  if (kind === 'army') return getArmy(state, Number(id))?.position ?? WORLD.city
  if (kind === 'band') {
    const band = getBand(state, Number(id))
    return band ? bandPosition(band, at) : WORLD.city
  }
  if (kind === 'camp') return getCamp(id as CampId).position
  return WORLD.city
}

/** D'où arrive un assaillant : là où il est, sauf un raid aux portes de la cité, qui arrive de son point de départ. */
function approachFrom(state: GameState, ref: string, target: string, at: number): Point {
  const band = ref.startsWith('band:') ? getBand(state, Number(ref.slice(5))) : undefined
  if (band?.raid && target === CITY_REF) return band.home
  return fighterPosition(state, ref, at)
}

/** tan(22,5°) : la limite entre deux des huit directions. */
const OCTANT = 0.41421356237309503

/**
 * La direction (de 0 à 7) de `from` vers `to` : 0 à l'est, puis tous les 45° dans le sens des
 * aiguilles d'une montre (2 au sud, 4 à l'ouest, 6 au nord). Sans trigonométrie : de simples
 * multiplications donnent le même résultat sur tous les navigateurs.
 */
export function directionOf(from: Point, to: Point): number {
  const dx = to.x - from.x
  const dy = to.y - from.y
  const ax = Math.abs(dx)
  const ay = Math.abs(dy)
  if (ay <= ax * OCTANT) return dx >= 0 ? 0 : 4
  if (ax <= ay * OCTANT) return dy >= 0 ? 2 : 6
  if (dx >= 0) return dy >= 0 ? 1 : 7
  return dy >= 0 ? 3 : 5
}

/** Ceux qui frappent ce combattant. */
export function attackersOf(battle: Battle, ref: string): (AllyFighter | FoeFighter)[] {
  return [...battle.allies, ...battle.foes].filter((f) => f.target === ref)
}

/**
 * La place libre la plus proche de `wanted` autour du combattant `ref`, ou null quand MAX_ATTACKERS
 * assaillants l'entourent déjà.
 */
function freeSlot(battle: Battle, ref: string, wanted: number): number | null {
  const taken = attackersOf(battle, ref).map((f) => f.slot)
  if (taken.length >= MAX_ATTACKERS) return null
  for (const step of [0, 1, -1, 2, -2, 3, -3, 4]) {
    const slot = (((wanted + step) % 8) + 8) % 8
    if (!taken.includes(slot)) return slot
  }
  return null
}

/**
 * Où se tient un assaillant par rapport à sa cible : 0 face à elle, 2 ou 6 sur ses côtés, 4 dans son
 * dos. Une cible regarde vers celle qu'elle frappe ; la cité n'a ni flancs ni dos, et une cible qui
 * ne frappe personne fait face à tous.
 */
export function relativeSlot(battle: Battle, attacker: FighterBase): number {
  const target = fighterOf(battle, attacker.target)
  if (!target || target.ref === CITY_REF || target.target === null) return 0
  const facing = (target.slot + 4) % 8
  return (((attacker.slot - facing) % 8) + 8) % 8
}

/** De face, de côté ou de dos (les places en biais comptent avec celles de face, ou de dos). */
export function flankOf(relative: number): 'front' | 'side' | 'rear' {
  if (relative === 2 || relative === 6) return 'side'
  if (relative >= 3 && relative <= 5) return 'rear'
  return 'front'
}

/** Le bonus d'attaque d'un assaillant, selon sa place. */
function flankBonus(relative: number): number {
  const flank = flankOf(relative)
  return flank === 'rear' ? REAR_ATTACK_BONUS : flank === 'side' ? SIDE_ATTACK_BONUS : 0
}

/** Le côté d'où frappe un assaillant : 0 devant, 1 à droite, 2 derrière, 3 à gauche. */
function sideOf(relative: number): number {
  if (relative === 2) return 1
  if (relative >= 3 && relative <= 5) return 2
  if (relative === 6) return 3
  return 0
}

/** Ce combattant est-il encerclé : frappé d'au moins ENCIRCLED_SIDES côtés ? (Jamais la cité.) */
export function encircled(battle: Battle, ref: string): boolean {
  if (ref === CITY_REF) return false
  const sides = new Set(attackersOf(battle, ref).map((f) => sideOf(relativeSlot(battle, f))))
  return sides.size >= ENCIRCLED_SIDES
}

/** La vie d'un combattant : en entrant dans la mêlée, et maintenant (troupes, gardes et dragon ; ou monstres). */
export function fighterHealth(fighter: AllyFighter | FoeFighter): { start: number; now: number } {
  if (!isAlly(fighter)) return { start: fighter.start, now: sumOf(fighter.health) }
  let now = UNIT_IDS.reduce((sum, id) => sum + fighter.health[id], 0)
  if (fighter.siege) now += fighter.siege.guardHealth
  if (fighter.dragon) now += fighter.dragon.health
  return { start: fighter.start, now }
}

function sumOf(values: Partial<Record<string, number>>): number {
  return Object.values(values).reduce<number>((sum, value) => sum + (value ?? 0), 0)
}

/** Les troupes, les gardes des Remparts et le dragon encore debout d'un combattant de ton camp. */
export function allySurvivors(ally: AllyFighter): { troops: Army; guards: number; dragon: boolean } {
  const troops = emptyArmy()
  for (const id of UNIT_IDS) {
    troops[id] = Math.max(0, Math.ceil(ally.health[id] / (getUnit(id).health * ally.healthFactor) - 1e-9))
  }
  const guards = ally.siege ? Math.max(0, Math.ceil(ally.siege.guardHealth / WALL_GUARD.health - 1e-9)) : 0
  return { troops, guards, dragon: ally.dragon !== null && ally.dragon.health > 1e-9 }
}

/** Les monstres encore debout d'un combattant monstre. */
export function foeSurvivors(foe: FoeFighter): Monsters {
  const monsters: Monsters = {}
  for (const id of Object.keys(foe.enemies) as MonsterId[]) {
    monsters[id] = Math.max(0, Math.ceil((foe.health[id] ?? 0) / getMonster(id).health - 1e-9))
  }
  return monsters
}

/** Un combattant de ton camp est tombé : toutes ses troupes (dehors, le dragon ne se bat jamais seul), ou tous les défenseurs de la cité. */
function allyFallen(ally: AllyFighter): boolean {
  const { troops, guards, dragon } = allySurvivors(ally)
  return armySize(troops) === 0 && (ally.siege === null || (guards === 0 && !dragon))
}

// Les combattants qui entrent dans une mêlée.

function armyFighter(state: GameState, army: FieldArmy, at: number, ambush: boolean): AllyFighter {
  const healthFactor = armyHealthFactor(state, army.hero)
  const health = emptyArmy()
  for (const id of UNIT_IDS) health[id] = army.troops[id] * getUnit(id).health * healthFactor
  const fighter: AllyFighter = {
    ref: armyRef(army.id),
    joinedAt: at,
    target: null,
    slot: 0,
    start: 0,
    taken: 0,
    army: army.id,
    sent: { ...army.troops },
    health,
    healthFactor,
    starving: isStarving(state),
    ambush,
    siege: null,
    dragon: army.dragon && state.dragon ? battleDragon(state, healthFactor) : null,
    rounds: [],
    met: [],
    loot: {},
  }
  return { ...fighter, start: fighterHealth(fighter).now }
}

/** La cité se défend : ses troupes, mieux protégées par les Remparts, leurs gardes, et le dragon s'il est dans son aire. */
function cityFighter(state: GameState, at: number): AllyFighter {
  const healthFactor =
    (1 +
      techBonus(state, 'health') +
      spellBonus(state, 'health') +
      spellBonus(state, 'siegeHealth') +
      WALL_HEALTH_PER_LEVEL * state.levels.walls) *
    trialBoost(state)
  const health = emptyArmy()
  for (const id of UNIT_IDS) health[id] = state.troops[id] * getUnit(id).health * healthFactor
  const guards = wallGuards(state)
  const fighter: AllyFighter = {
    ref: CITY_REF,
    joinedAt: at,
    target: null,
    slot: 0,
    start: 0,
    taken: 0,
    army: null,
    sent: { ...state.troops },
    health,
    healthFactor,
    starving: isStarving(state),
    ambush: false,
    siege: { guards, guardHealth: guards * WALL_GUARD.health },
    dragon: dragonAtHome(state, at) ? battleDragon(state, healthFactor) : null,
    rounds: [],
    met: [],
    loot: {},
  }
  return { ...fighter, start: fighterHealth(fighter).now }
}

function monsterFighter(ref: string, foe: Foe, monsters: Monsters, at: number): FoeFighter {
  const enemies = standing(monsters)
  const health = monsterHealth(enemies)
  return {
    ref,
    joinedAt: at,
    target: null,
    slot: 0,
    start: sumOf(health),
    taken: 0,
    band: ref.startsWith('band:') ? Number(ref.slice(5)) : null,
    camp: foe.type === 'camp' ? foe.camp : null,
    foe,
    enemies,
    health,
    damageBy: {},
  }
}

/** Ce combattant, tel qu'il entre dans la mêlée (undefined s'il n'est plus là). */
function newFighter(state: GameState, ref: string, at: number, ambush: boolean): AllyFighter | FoeFighter | undefined {
  if (ref === CITY_REF) return cityFighter(state, at)
  const [kind, id] = ref.split(':')
  if (kind === 'army') {
    const army = getArmy(state, Number(id))
    return army && armyFighter(state, army, at, ambush)
  }
  if (kind === 'band') {
    const band = getBand(state, Number(id))
    return band && monsterFighter(ref, bandFoe(band), band.monsters, at)
  }
  const camp = getCamp(id as CampId)
  return monsterFighter(ref, { type: 'camp', camp: camp.id }, camp.defenders, at)
}

/** Ce combattant s'arrête pour se battre : une armée est au combat, une bande quitte sa ronde (ou sa marche). */
function holdFighter(state: GameState, ref: string, at: number): GameState {
  const [kind, id] = ref.split(':')
  if (kind === 'army') {
    const army = getArmy(state, Number(id))
    return army ? updateArmy(state, { ...army, status: 'fighting' }) : state
  }
  if (kind === 'band') {
    const band = getBand(state, Number(id))
    return band ? updateBand(state, { ...band, phase: bandPhase(band, at), since: null }) : state
  }
  return state
}

function withFighter(battle: Battle, fighter: AllyFighter | FoeFighter): Battle {
  return isAlly(fighter) ? { ...battle, allies: [...battle.allies, fighter] } : { ...battle, foes: [...battle.foes, fighter] }
}

function replaceFighter(battle: Battle, fighter: AllyFighter | FoeFighter): Battle {
  return isAlly(fighter)
    ? { ...battle, allies: battle.allies.map((f) => (f.ref === fighter.ref ? fighter : f)) }
    : { ...battle, foes: battle.foes.map((f) => (f.ref === fighter.ref ? fighter : f)) }
}

/** Chacun des tiens note les adversaires qu'il rencontre : sa cible, et ceux qui le frappent. */
function noteMeetings(battle: Battle): Battle {
  return {
    ...battle,
    allies: battle.allies.map((ally) => {
      const refs = [ally.target, ...battle.foes.filter((foe) => foe.target === ally.ref).map((foe) => foe.ref)]
      const met = [...ally.met]
      for (const ref of refs) {
        const foe = battle.foes.find((f) => f.ref === ref)
        if (foe && !met.some((m) => m.ref === foe.ref)) met.push({ ref: foe.ref, foe: foe.foe, monsters: foeSurvivors(foe) })
      }
      return met.length === ally.met.length ? ally : { ...ally, met }
    }),
  }
}

/**
 * `attacker` (une armée, une bande ou un raid, qui ne se bat pas encore) attaque `target` (une bande,
 * un camp, une armée, ou la cité). Si la cible se bat déjà, l'assaillant rejoint sa mêlée ; sinon,
 * une mêlée commence, et la cible riposte. L'assaillant prend la place libre la plus proche de là
 * d'où il arrive ; si toutes sont prises, il attend son tour, et la partie ne change pas. `ambush` :
 * une bande attaque une de tes armées la première.
 */
function engage(state: GameState, attacker: string, target: string, at: number, ambush = false): GameState {
  const existing = battleWith(state, target)
  let battle: Battle = existing ?? { id: state.nextId, startedAt: at, round: 0, allies: [], foes: [] }
  if (!existing) {
    const defender = newFighter(state, target, at, ambush)
    if (!defender) return state
    battle = withFighter(battle, defender)
  }
  const fresh = newFighter(state, attacker, at, ambush)
  if (!fresh) return state
  const wanted = directionOf(fighterPosition(state, target, at), approachFrom(state, attacker, target, at))
  const slot = freeSlot(battle, target, wanted)
  if (slot === null) return state
  battle = withFighter(battle, { ...fresh, target, slot })
  // La cible qui ne frappait personne riposte : elle se tourne vers son assaillant.
  const defender = fighterOf(battle, target)
  if (defender && defender.target === null) battle = replaceFighter(battle, { ...defender, target: attacker, slot: (slot + 4) % 8 })
  let next = holdFighter(holdFighter(state, attacker, at), target, at)
  next = existing ? updateBattle(next, noteMeetings(battle)) : { ...next, battles: [...next.battles, noteMeetings(battle)], nextId: next.nextId + 1 }
  return next
}

function bandFoe(band: Band): Foe {
  return band.raid
    ? { type: 'band', kind: band.kind, level: band.level, raid: true }
    : { type: 'band', kind: band.kind, level: band.level }
}

/** L'expérience que rapportent des monstres vaincus, au héros comme au dragon. */
function battleXp(enemyLost: Monsters): number {
  return (Object.entries(enemyLost) as [MonsterId, number][]).reduce(
    (sum, [id, count]) => sum + count * getMonster(id).xp,
    0,
  )
}

/** Les monstres présents : on oublie les sortes dont il ne reste personne. */
function standing(monsters: Monsters): Monsters {
  return Object.fromEntries(Object.entries(monsters).filter(([, count]) => (count ?? 0) > 0)) as Monsters
}

/** Les points de vie de chaque sorte de monstres, au complet. */
function monsterHealth(monsters: Monsters): Monsters {
  const health: Monsters = {}
  for (const [id, count] of Object.entries(monsters) as [MonsterId, number][]) {
    health[id] = count * getMonster(id).health
  }
  return health
}

/** Des monstres de plusieurs groupes, additionnés. */
function addMonsters(groups: Monsters[]): Monsters {
  const sum: Monsters = {}
  for (const group of groups) {
    for (const [id, count] of Object.entries(group) as [MonsterId, number][]) {
      if (count) sum[id] = (sum[id] ?? 0) + count
    }
  }
  return sum
}

/**
 * Les groupes d'un combattant de ton camp, avec leurs forces du moment (la Forge, les compétences du
 * héros, les sorts et la faim comptent à chaque manche), et la vie qui leur reste. Pendant un siège,
 * les gardes des Remparts forment un groupe de plus, après les troupes ; puis vient le dragon.
 */
function allyStacks(state: GameState, ally: AllyFighter): { stacks: Stack[]; health: number[] } {
  const hero = ally.army === null ? null : (getArmy(state, ally.army)?.hero ?? null)
  const hunger = (isStarving(state) ? 1 - STARVATION_ATTACK_MALUS : 1) * trialBoost(state)
  const attackBonus = techBonus(state, 'attack') + heroBonus(state, hero, 'attack') + spellBonus(state, 'attack')
  const stacks: Stack[] = UNIT_IDS.map((id) => {
    const unit = getUnit(id)
    const factor = (1 + attackBonus + heroBonus(state, hero, 'familyAttack', unit.family)) * hunger
    return { family: unit.family, attack: unit.attack * factor, health: unit.health * ally.healthFactor, count: 0 }
  })
  const health = UNIT_IDS.map((id) => ally.health[id])
  if (ally.siege) {
    stacks.push({ ...WALL_GUARD, count: 0 })
    health.push(ally.siege.guardHealth)
  }
  if (ally.dragon) {
    stacks.push({ family: DRAGON_FAMILY, attack: ally.dragon.attack * (1 + attackBonus) * hunger, health: ally.dragon.start, count: 0 })
    health.push(ally.dragon.health)
  }
  return { stacks, health }
}

/**
 * Les soigneurs d'un des tiens encore debout après les coups de la manche (`standing` : ceux qui
 * tombent ne soignent plus) rendent de la vie à ses troupes (pas aux gardes des Remparts ni au
 * dragon) : chaque groupe en reçoit selon ce qu'il a perdu depuis son entrée dans la mêlée, sans
 * dépasser sa vie du début. Ceux qui étaient tombés peuvent se relever. Change `health` (la vie de
 * chaque groupe après les coups), et renvoie la vie rendue.
 */
function healTroops(ally: AllyFighter, standing: number[], health: number[]): number {
  const power = UNIT_IDS.reduce((sum, id, i) => sum + standing[i] * (getUnit(id).heal ?? 0), 0) * ally.healthFactor
  if (power <= 0) return 0
  const missing = UNIT_IDS.map((id, i) => Math.max(0, ally.sent[id] * getUnit(id).health * ally.healthFactor - health[i]))
  const wanted = total(missing)
  if (wanted <= 0) return 0
  const share = Math.min(1, power / wanted)
  UNIT_IDS.forEach((_, i) => (health[i] += missing[i] * share))
  return Math.min(power, wanted)
}

/** Les groupes d'un combattant monstre, et la vie qui leur reste. */
function foeStacks(foe: FoeFighter): { stacks: Stack[]; health: number[] } {
  const ids = Object.keys(foe.enemies) as MonsterId[]
  return {
    stacks: ids.map((id) => {
      const monster = getMonster(id)
      return { family: monster.family, attack: monster.attack, health: monster.health, count: 0 }
    }),
    health: ids.map((id) => foe.health[id] ?? 0),
  }
}

/**
 * Partage `amount` entre plusieurs parts, selon leurs poids : des nombres entiers, qui font bien
 * `amount` au total (les plus gros restes reçoivent une unité de plus ; à égalité, le premier).
 */
function apportion(amount: number, weights: number[]): number[] {
  const whole = Math.round(amount)
  const sum = weights.reduce((a, b) => a + b, 0)
  if (sum <= 0 || whole <= 0) return weights.map(() => 0)
  const exact = weights.map((weight) => (whole * weight) / sum)
  const parts = exact.map((share) => Math.floor(share + 1e-9))
  let left = whole - parts.reduce((a, b) => a + b, 0)
  const order = exact.map((share, i) => ({ i, rest: share - parts[i] })).sort((a, b) => b.rest - a.rest || a.i - b.i)
  for (const { i } of order) {
    if (left <= 0) break
    parts[i]++
    left--
  }
  return parts
}

/**
 * Une manche : chaque combattant frappe sa cible, tous en même temps, avec le bonus de sa place (de
 * côté, de dos) et le malus d'un combattant encerclé. Chaque assaillant ne peut ôter à sa cible qu'une
 * part de sa vie du début (roundCap) : face à un seul adversaire, une bataille dure au moins
 * MIN_BATTLE_ROUNDS manches ; face à plusieurs, elle va bien plus vite. Puis on relève ceux qui sont tombés.
 */
function playRound(state: GameState, battleId: number, at: number): GameState {
  const battle = getBattle(state, battleId)
  if (!battle) return state
  const groups = new Map<string, { stacks: Stack[]; health: number[] }>()
  for (const ally of battle.allies) groups.set(ally.ref, allyStacks(state, ally))
  for (const foe of battle.foes) groups.set(foe.ref, foeStacks(foe))

  // Les coups, calculés d'après la vie de chacun au début de la manche.
  const hits = new Map<string, number[]>()
  const strikes: { from: string; to: string; damage: number }[] = []
  for (const fighter of [...battle.allies, ...battle.foes]) {
    const target = fighterOf(battle, fighter.target)
    if (!target) continue
    const from = groups.get(fighter.ref)!
    const to = groups.get(target.ref)!
    const factor =
      (1 + flankBonus(relativeSlot(battle, fighter))) * (encircled(battle, fighter.ref) ? 1 - ENCIRCLED_ATTACK_MALUS : 1)
    const boosted = from.stacks.map((stack) => ({ ...stack, attack: stack.attack * factor }))
    const damage = strike(boosted, from.health, to.stacks, to.health, roundCap(target.start))
    hits.set(target.ref, (hits.get(target.ref) ?? to.stacks.map(() => 0)).map((sum, i) => sum + damage[i]))
    strikes.push({ from: fighter.ref, to: target.ref, damage: total(damage) })
  }

  // Les monstres reçoivent leurs coups ; ceux qu'ils perdent sont comptés à ceux des tiens qui les ont frappés.
  const kills = new Map<string, Monsters>()
  const foes = battle.foes.map((foe) => {
    const damage = hits.get(foe.ref)
    if (!damage) return { ...foe, taken: 0 }
    const group = groups.get(foe.ref)!
    const ids = Object.keys(foe.enemies) as MonsterId[]
    const after = group.health.map((hp, i) => Math.max(0, hp - damage[i]))
    const before = counts(group.stacks, group.health)
    const left = counts(group.stacks, after)
    const strikers = strikes.filter((s) => s.to === foe.ref)
    ids.forEach((id, i) => {
      apportion(before[i] - left[i], strikers.map((s) => s.damage)).forEach((count, k) => {
        if (count === 0) return
        const tally = { ...(kills.get(strikers[k].from) ?? {}) }
        tally[id] = (tally[id] ?? 0) + count
        kills.set(strikers[k].from, tally)
      })
    })
    const damageBy = { ...foe.damageBy }
    for (const s of strikers) damageBy[s.from] = (damageBy[s.from] ?? 0) + s.damage
    const health: Monsters = {}
    ids.forEach((id, i) => (health[id] = after[i]))
    return { ...foe, health, taken: total(damage), damageBy }
  })

  // Les tiens reçoivent les leurs, et chacun note la manche dans son journal.
  const allies = battle.allies.map((ally) => {
    const group = groups.get(ally.ref)!
    const damage = hits.get(ally.ref) ?? group.stacks.map(() => 0)
    const after = group.health.map((hp, i) => Math.max(0, hp - damage[i]))
    const before = counts(group.stacks, group.health)
    const struck = counts(group.stacks, after)
    // Ses soigneurs encore debout rendent de la vie à ses troupes : des tombés se relèvent.
    const healed = healTroops(ally, struck, after)
    const left = counts(group.stacks, after)
    const health = emptyArmy()
    const lost = emptyArmy()
    const raised = emptyArmy()
    UNIT_IDS.forEach((id, i) => {
      health[id] = after[i]
      lost[id] = before[i] - struck[i]
      raised[id] = left[i] - struck[i]
    })
    const played: BattleRound = {
      dealt: Math.round(strikes.find((s) => s.from === ally.ref)?.damage ?? 0),
      taken: Math.round(total(damage)),
      lost,
      enemyLost: kills.get(ally.ref) ?? {},
    }
    if (Math.round(healed) > 0) played.healed = Math.round(healed)
    if (armySize(raised) > 0) played.raised = raised
    let index = UNIT_IDS.length
    let siege = ally.siege
    if (siege) {
      played.guardsLost = before[index] - left[index]
      siege = { ...siege, guardHealth: after[index] }
      index++
    }
    let dragon = ally.dragon
    if (dragon) {
      if (before[index] > 0 && left[index] === 0) played.dragonFell = true
      dragon = { ...dragon, health: after[index] }
    }
    const flank = ally.target === null ? 'front' : flankOf(relativeSlot(battle, ally))
    if (flank !== 'front') played.flank = flank
    const attackers = battle.foes.filter((foe) => foe.target === ally.ref).length
    if (attackers > 1) played.attackers = attackers
    if (encircled(battle, ally.ref)) played.encircled = true
    return { ...ally, health, siege, dragon, taken: total(damage), rounds: [...ally.rounds, played] }
  })

  return settleRound(updateBattle(state, { ...battle, round: battle.round + 1, allies, foes }), battleId, at)
}

/**
 * Après une manche : les monstres tombés quittent la mêlée (leur butin se partage), puis les tiens.
 * Quand tous les monstres sont tombés, c'est une victoire pour tous les tiens, même ceux qui tombent
 * dans la même manche. Au-delà de MAX_BATTLE_ROUNDS, chacun repart sans vainqueur. Sinon, ceux dont
 * la cible est tombée en choisissent une autre.
 */
function settleRound(state: GameState, battleId: number, at: number): GameState {
  const battle = getBattle(state, battleId)
  if (!battle) return state
  const fallen = battle.foes.filter((foe) => sumOf(foeSurvivors(foe)) === 0)
  let next = state
  for (const foe of fallen) next = foeFalls(next, battleId, foe.ref, at)
  if (fallen.length === battle.foes.length) {
    next = { ...next, stats: { ...next.stats, victories: next.stats.victories + 1 } }
    for (const ally of battle.allies) next = leave(next, battleId, ally.ref, at, 'victory')
    return removeBattle(next, battleId)
  }
  for (const ally of battle.allies) {
    if (!allyFallen(ally)) continue
    next = leave(next, battleId, ally.ref, at, 'defeat')
    // La cité est tombée : le siège est fini.
    if (!getBattle(next, battleId)) return next
  }
  const current = getBattle(next, battleId)
  if (!current) return next
  if (current.allies.length === 0) return closeBattle(next, battleId, at)
  if (current.round >= MAX_BATTLE_ROUNDS) {
    for (const ally of current.allies) next = leave(next, battleId, ally.ref, at, 'draw')
    return closeBattle(next, battleId, at)
  }
  return retarget(next, battleId, at)
}

/**
 * Un adversaire tombe : il quitte la mêlée, et son butin se partage entre ceux des tiens qui l'ont
 * frappé, selon leurs coups. Une bande vaincue disparaît ; un camp vaincu reste vide un moment. Le
 * gardien de la clef la laisse à l'armée qui l'a frappé le plus fort.
 */
function foeFalls(state: GameState, battleId: number, ref: string, at: number): GameState {
  const battle = getBattle(state, battleId)
  const foe = battle?.foes.find((f) => f.ref === ref)
  if (!battle || !foe) return state
  const loot = foeLoot(foe.foe)
  const weights = battle.allies.map((ally) => foe.damageBy[ally.ref] ?? 0)
  const shares = battle.allies.map(() => ({}) as Partial<Resources>)
  for (const id of RESOURCE_IDS) {
    apportion(loot[id] ?? 0, weights.some((w) => w > 0) ? weights : weights.map((_, i) => (i === 0 ? 1 : 0))).forEach(
      (amount, i) => {
        if (amount > 0) shares[i][id] = amount
      },
    )
  }
  let next = updateBattle(state, {
    ...battle,
    foes: battle.foes.filter((f) => f.ref !== ref),
    allies: battle.allies.map((ally, i) => ({ ...ally, loot: mergeLoot(ally.loot, shares[i]) })),
  })
  const stats = next.stats
  const kind = foe.foe
  if (kind.type === 'camp') {
    next = {
      ...next,
      campsCleared: { ...next.campsCleared, [kind.camp]: at + CAMP_RESPAWN_SECONDS * SECOND },
      stats: { ...stats, campsDefeated: { ...stats.campsDefeated, [kind.camp]: (stats.campsDefeated[kind.camp] ?? 0) + 1 } },
    }
  } else if (kind.type === 'band') {
    // Un raid arrêté en chemin, ou aux portes, n'atteindra jamais la cité : il est repoussé.
    next = {
      ...next,
      stats: { ...stats, bandsDefeated: stats.bandsDefeated + 1, raidsRepelled: stats.raidsRepelled + (kind.raid ? 1 : 0) },
    }
    if (foe.band !== null) next = removeBand(next, foe.band, at)
    if (kind.kind === 'keeper') {
      const bearers = battle.allies.filter((ally) => ally.army !== null)
      const bearer = bearers.reduce<AllyFighter | undefined>(
        (best, ally) => (!best || (foe.damageBy[ally.ref] ?? 0) > (foe.damageBy[best.ref] ?? 0) ? ally : best),
        undefined,
      )
      const army = bearer?.army == null ? undefined : getArmy(next, bearer.army)
      next = army ? updateArmy(next, { ...army, key: true }) : returnKey(next, at)
    }
  }
  return next
}

/**
 * Un des tiens quitte la mêlée (tombé, en retraite, vainqueur, ou sans vainqueur) : on écrit son
 * rapport. Une armée anéantie disparaît ; sinon elle emporte sa part du butin, dans la limite de ce
 * que portent ses survivants. Attaquée en chemin, elle reprend sa route ; sinon elle attend sur place.
 */
function leave(state: GameState, battleId: number, ref: string, at: number, outcome: Outcome): GameState {
  const battle = getBattle(state, battleId)
  const ally = battle?.allies.find((a) => a.ref === ref)
  if (!battle || !ally) return state
  if (ally.army === null) return leaveCity(state, battle, ally, at, outcome)
  let next = updateBattle(state, { ...battle, allies: battle.allies.filter((a) => a.ref !== ref) })
  const { troops: survivors } = allySurvivors(ally)
  const lost = emptyArmy()
  for (const id of UNIT_IDS) lost[id] = ally.sent[id] - survivors[id]
  // Une part des tombés n'est que blessée : elle va à l'hôpital, s'il y reste des lits.
  const hurt = woundFallen(next, lost)
  next = hurt.state
  const enemyLost = addMonsters(ally.rounds.map((round) => round.enemyLost))
  const xp = battleXp(enemyLost)
  const withDragon = dragonAfterBattle(next, ally, xp, at, outcome)
  next = withDragon.state
  const army = getArmy(next, ally.army)
  const hero = army?.hero == null ? undefined : getHero(next, army.hero)
  let heroGain: HeroGain | null = null
  if (hero) {
    const after = gainXp(hero, xp)
    next = updateHero(next, after)
    heroGain = { hero: hero.id, xp, level: after.level, levelsGained: after.level - hero.level }
  }
  const room = army ? carryCapacity(next, survivors, army.hero) - loadSize(army.load) : 0
  const loot = outcome === 'defeat' ? {} : fitLoad(ally.loot, room)
  const report = allyReport(ally, at, outcome, lost, hurt.wounded, enemyLost, loot, heroGain, withDragon.gain, null)
  next = { ...next, reports: [report, ...next.reports].slice(0, MAX_REPORTS) }
  if (!army) return next
  if (armySize(survivors) === 0) {
    // Personne pour porter la clef : elle retourne à son gardien.
    const gone = removeArmy(next, army.id)
    return army.key ? returnKey(gone, at) : gone
  }
  // Les bandes rencontrées ne l'attaqueront plus d'elles-mêmes.
  const met = ally.met.flatMap((m) => (m.ref.startsWith('band:') ? [Number(m.ref.slice(5))] : []))
  const fought = [...army.fought, ...met.filter((id) => !army.fought.includes(id))]
  // Blessé, le dragon quitte l'armée pour regagner son aire.
  const dragon = army.dragon && !withDragon.gain?.wounded
  const after: FieldArmy = { ...army, troops: survivors, load: mergeLoot(army.load, loot), fought, dragon }
  const resume = ally.ambush && army.order !== null
  return updateArmy(next, resume ? { ...after, status: 'marching' } : { ...after, status: 'idle', order: null })
}

/** Le rapport d'un des tiens qui quitte la mêlée. */
function allyReport(
  ally: AllyFighter,
  at: number,
  outcome: Outcome,
  lost: Army,
  wounded: Army,
  enemyLost: Monsters,
  loot: Partial<Resources>,
  hero: HeroGain | null,
  dragon: DragonGain | null,
  siege: SiegeReport | null,
): BattleReport {
  const foes = ally.met.map((m) => m.foe)
  return {
    at,
    startedAt: ally.joinedAt,
    army: ally.army,
    foe: foes[0] ?? { type: 'trap' },
    foes,
    ambush: ally.ambush,
    outcome,
    sent: { ...ally.sent },
    lost,
    wounded,
    enemies: addMonsters(ally.met.map((m) => m.monsters)),
    enemyLost,
    loot,
    starving: ally.starving,
    rounds: ally.rounds,
    hero,
    siege,
    dragon,
  }
}

/**
 * Plus personne de ton camp dans la mêlée : elle se termine. Les bandes gardent leurs survivants, et
 * reprennent leur ronde (ou la regagnent, si elles avaient poursuivi une armée), ou leur marche sur la cité.
 */
function closeBattle(state: GameState, battleId: number, at: number): GameState {
  const battle = getBattle(state, battleId)
  if (!battle) return state
  let next = removeBattle(state, battleId)
  for (const foe of battle.foes) {
    const band = foe.band === null ? undefined : getBand(next, foe.band)
    if (!band) continue
    const monsters = foeSurvivors(foe)
    next = updateBand(
      next,
      band.chase ? { ...band, monsters, chase: { army: null, position: band.chase.position } } : { ...band, monsters, since: at },
    )
  }
  return next
}

/**
 * Ceux dont la cible est partie (tombée, en retraite) en choisissent une autre : d'abord un de leurs
 * assaillants, sinon l'adversaire le plus proche autour duquel il reste une place. Faute de place, ils attendent.
 */
function retarget(state: GameState, battleId: number, at: number): GameState {
  let battle = getBattle(state, battleId)
  if (!battle) return state
  for (const { ref } of [...battle.allies, ...battle.foes]) {
    const fighter = fighterOf(battle, ref)
    if (!fighter || (fighter.target !== null && fighterOf(battle, fighter.target))) continue
    const opponents: (AllyFighter | FoeFighter)[] = isAlly(fighter) ? battle.foes : battle.allies
    let choice: { target: string; slot: number } | null = null
    for (const attacker of opponents.filter((o) => o.target === ref)) {
      const slot = freeSlot(battle, attacker.ref, (attacker.slot + 4) % 8)
      if (slot !== null) {
        choice = { target: attacker.ref, slot }
        break
      }
    }
    if (!choice) {
      const here = fighterPosition(state, ref, at)
      const nearest = [...opponents].sort(
        (a, b) => distance(here, fighterPosition(state, a.ref, at)) - distance(here, fighterPosition(state, b.ref, at)),
      )
      for (const opponent of nearest) {
        const slot = freeSlot(battle, opponent.ref, directionOf(fighterPosition(state, opponent.ref, at), here))
        if (slot !== null) {
          choice = { target: opponent.ref, slot }
          break
        }
      }
    }
    battle = replaceFighter(battle, { ...fighter, target: choice?.target ?? null, slot: choice?.slot ?? fighter.slot })
  }
  return updateBattle(state, noteMeetings(battle))
}

/** Après le départ d'un des tiens (en retraite) : la mêlée continue sans lui, ou se termine. */
function afterLeave(state: GameState, battleId: number, at: number): GameState {
  const battle = getBattle(state, battleId)
  if (!battle) return state
  return battle.allies.length === 0 ? closeBattle(state, battleId, at) : retarget(state, battleId, at)
}

/** Ton armée se tourne vers un autre adversaire de sa mêlée, sans quitter le combat. */
function switchTarget(state: GameState, battle: Battle, ally: AllyFighter, foe: FoeFighter, at: number): GameState {
  const wanted = directionOf(fighterPosition(state, foe.ref, at), fighterPosition(state, ally.ref, at))
  const slot = freeSlot(battle, foe.ref, wanted)
  if (slot === null) return state
  return updateBattle(state, noteMeetings(replaceFighter(battle, { ...ally, target: foe.ref, slot })))
}

// --- Les bandes de monstres ---

/** Le niveau d'une bande ou d'un gisement à cet endroit, d'après sa distance à la cité. */
export function levelAt(point: Point): number {
  const level = 1 + Math.floor(Math.max(0, distance(WORLD.city, point) - BAND_LEVEL_START) / BAND_LEVEL_RING)
  return Math.min(MAX_BAND_LEVEL, level)
}

/** Le rayon de la zone d'aggro d'une bande, en unités de carte : il grandit avec son niveau. */
export function aggroRadius(level: number): number {
  return BAND_AGGRO_RADIUS + BAND_AGGRO_PER_LEVEL * (level - 1)
}

/** Les monstres d'une bande au complet, selon sa sorte et son niveau. */
export function bandMonsters(kind: BandKindId, level: number): Monsters {
  return scaled(getBandKind(kind).monsters, BAND_GROWTH ** (level - 1))
}

/** Ce que rapporte la victoire sur une bande. */
export function bandLoot(kind: BandKindId, level: number): Partial<Resources> {
  return scaled(getBandKind(kind).loot, BAND_LOOT_GROWTH ** (level - 1))
}

function scaled<K extends string>(base: Partial<Record<K, number>>, factor: number): Partial<Record<K, number>> {
  const result: Partial<Record<K, number>> = {}
  for (const [key, value] of Object.entries(base) as [K, number][]) {
    result[key] = Math.max(1, Math.round(value * factor))
  }
  return result
}

// La ronde d'une bande : un octogone autour de son repaire (0.7071 ≈ √2 / 2).
const LOOP_SHAPE: [number, number][] = [
  [0, -1],
  [0.7071, -0.7071],
  [1, 0],
  [0.7071, 0.7071],
  [0, 1],
  [-0.7071, 0.7071],
  [-1, 0],
  [-0.7071, -0.7071],
]

/** Les étapes de la ronde d'une bande autour de son repaire. */
export function patrolLoop(home: Point): Point[] {
  return LOOP_SHAPE.map(([x, y]) => ({ x: home.x + x * PATROL_RADIUS, y: home.y + y * PATROL_RADIUS }))
}

/** Au plus près, à quelle distance de `point` passe la ronde d'une bande dont le repaire est `home` ? */
export function patrolDistance(home: Point, point: Point): number {
  const loop = patrolLoop(home)
  return Math.min(...loop.map((from, i) => distanceToSegment(point, from, loop[(i + 1) % loop.length])))
}

function loopLength(loop: Point[]): number {
  return loop.reduce((sum, point, i) => sum + distance(point, loop[(i + 1) % loop.length]), 0)
}

/**
 * Le chemin parcouru par une bande à l'instant `at` : sur sa ronde, entre 0 et la longueur de la
 * ronde ; pour un raid, depuis son point de départ, jusqu'à la cité au plus.
 */
function bandPhase(band: Band, at: number): number {
  if (band.raid) {
    const walked = band.since === null ? 0 : (RAID_SPEED * Math.max(0, at - band.since)) / SECOND
    return Math.min(raidLength(band), band.phase + walked)
  }
  const length = loopLength(patrolLoop(band.home))
  const walked = band.since === null ? 0 : (band.direction * PATROL_SPEED * Math.max(0, at - band.since)) / SECOND
  return (((band.phase + walked) % length) + length) % length
}

/**
 * Où se trouve une bande à l'instant `at` : elle avance sur sa ronde (ou, pour un raid, vers la
 * cité), sauf pendant un combat ; ou bien elle a quitté sa ronde pour poursuivre une armée.
 */
export function bandPosition(band: Band, at: number): Point {
  if (band.chase) return { ...band.chase.position }
  if (band.still) return { ...band.home }
  if (band.raid) {
    const length = raidLength(band)
    return along(band.home, WORLD.city, length === 0 ? 1 : bandPhase(band, at) / length)
  }
  const loop = patrolLoop(band.home)
  let rest = bandPhase(band, at)
  for (let i = 0; i < loop.length; i++) {
    const from = loop[i]
    const to = loop[(i + 1) % loop.length]
    const side = distance(from, to)
    if (rest <= side) return along(from, to, side === 0 ? 0 : rest / side)
    rest -= side
  }
  return loop[0]
}

function updateBand(state: GameState, band: Band): GameState {
  return { ...state, bands: state.bands.map((b) => (b.id === band.id ? band : b)) }
}

// --- Les poursuites ---

/** Jusqu'où voit une bande en patrouille de ce niveau : plus loin que sa zone d'aggro. */
export function sightRadius(level: number): number {
  return aggroRadius(level) * BAND_SIGHT_FACTOR
}

/** Cette bande prend-elle en chasse les armées qu'elle voit ? Les chefs gardent leur place, et les raids leur route. */
export function canChase(band: Band): boolean {
  return !band.raid && !band.still
}

/** La tour de guet du grand campement, tant qu'elle tient. */
export function watchtower(state: GameState): Band | undefined {
  return state.bands.find((band) => band.kind === 'watchtower')
}

/** La tour de guet voit-elle cet endroit ? */
function towerSees(state: GameState, tower: Band, point: Point): boolean {
  return distance(tower.home, point) <= WATCH_RADIUS && inSight(state, tower.home, point)
}

/**
 * Les bandes en patrouille prennent en chasse la plus proche des armées qu'elles voient, même en plein
 * combat (elles rejoignent alors la mêlée) ; et tant que la tour de guet tient, les patrouilles du
 * grand campement accourent vers les armées qu'elle voit. Une bande ne poursuit ni une armée qu'elle a
 * déjà combattue, ni une armée qui l'a semée.
 */
function spotArmies(state: GameState, at: number): GameState {
  const tower = watchtower(state)
  const watched = tower ? state.armies.filter((army) => towerSees(state, tower, army.position)).map((army) => army.id) : []
  let next = state
  for (const { id } of state.bands) {
    const band = getBand(next, id)
    if (!band || !canChase(band) || band.chase !== null || bandFighting(next, band.id)) continue
    const position = bandPosition(band, at)
    let prey: FieldArmy | undefined
    for (const army of next.armies) {
      if (army.fought.includes(band.id) || army.escaped.includes(band.id)) continue
      const alerted = band.encampment && watched.includes(army.id)
      const gap = distance(position, army.position)
      const seen = gap <= sightRadius(band.level) && inSight(next, position, army.position)
      if ((seen || alerted) && (!prey || gap < distance(position, prey.position))) prey = army
    }
    // Elle quitte sa ronde, qu'elle reprendra là où elle l'a laissée.
    if (prey) next = updateBand(next, { ...band, phase: bandPhase(band, at), since: null, chase: { army: prey.id, position } })
  }
  return next
}

/**
 * Les bandes qui ont quitté leur ronde avancent d'un pas : vers l'armée qu'elles poursuivent (elles
 * l'attaquent en l'atteignant : voir checkAggro), ou vers leur ronde, qu'elles reprennent en y arrivant.
 */
function stepChases(state: GameState, at: number): GameState {
  let next = state
  for (const { id } of state.bands) {
    const band = getBand(next, id)
    if (band?.chase && !bandFighting(next, band.id)) next = stepChase(next, band, band.chase, at)
  }
  return next
}

/**
 * Un pas de poursuite. La bande renonce quand elle s'est trop éloignée de son repaire, quand aucun
 * chemin ne mène plus à l'armée, ou quand l'armée a quitté la carte (rentrée à la cité, ou anéantie).
 */
function stepChase(state: GameState, band: Band, chase: Chase, at: number): GameState {
  const step = CHASE_SPEED * WORLD_TICK_SECONDS
  if (chase.army !== null) {
    const army = getArmy(state, chase.army)
    if (!army || army.fought.includes(band.id)) return giveUp(state, band, chase, undefined)
    // Elle l'a rattrapée : elle attaque (ou attend que l'armée ait fini le combat qu'elle livre).
    if (distance(chase.position, army.position) <= aggroRadius(band.level) && inSight(state, chase.position, army.position)) {
      return state
    }
    const route = distance(band.home, chase.position) > CHASE_LEASH ? null : routeBetween(state, chase.position, army.position)
    if (!route) return giveUp(state, band, chase, army)
    return updateBand(state, { ...band, chase: { ...chase, position: walk(route, step) } })
  }
  // De retour sur sa ronde, là où elle l'avait quittée : elle reprend sa patrouille.
  const back = bandPosition({ ...band, chase: null }, at)
  const route = routeBetween(state, chase.position, back)
  if (!route || routeLength(route) <= step) return updateBand(state, { ...band, chase: null, since: at })
  return updateBand(state, { ...band, chase: { ...chase, position: walk(route, step) } })
}

/** La bande renonce : elle regagne sa ronde, et l'armée qui l'a semée n'a plus à craindre sa poursuite. */
function giveUp(state: GameState, band: Band, chase: Chase, army: FieldArmy | undefined): GameState {
  const next = updateBand(state, { ...band, chase: { army: null, position: chase.position } })
  return army && !army.escaped.includes(band.id) ? updateArmy(next, { ...army, escaped: [...army.escaped, band.id] }) : next
}

/**
 * Un tirage au hasard, mais reproductible : la même graine donne toujours le même nombre.
 * La graine est gardée dans la partie : le navigateur et le serveur tirent donc les mêmes
 * nombres, et la partie avance de la même façon d'un coup ou seconde par seconde.
 * Renvoie un nombre entre 0 (compris) et 1 (exclu), et la graine suivante (algorithme mulberry32).
 */
export function random(seed: number): { value: number; seed: number } {
  const next = (seed + 0x6d2b79f5) | 0
  let t = Math.imul(next ^ (next >>> 15), next | 1)
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
  return { value: ((t ^ (t >>> 14)) >>> 0) / 4294967296, seed: next }
}

/** Tire plusieurs nombres au hasard d'un coup, et renvoie la graine suivante. */
function draws(seed: number, count: number): { values: number[]; seed: number } {
  const values: number[] = []
  let current = seed
  for (let i = 0; i < count; i++) {
    const result = random(current)
    values.push(result.value)
    current = result.seed
  }
  return { values, seed: current }
}

/**
 * Une nouvelle bande s'installe sur un repaire libre, tiré au sort. Son niveau dépend de sa distance
 * à la cité (parfois un de plus), et sa sorte est tirée parmi celles de ce niveau. Elle ne s'installe
 * jamais assez près d'une armée pour l'attaquer aussitôt.
 */
function spawnBand(state: GameState, at: number): GameState {
  const free = reachableFromCity(state, BAND_SPOTS).filter((spot) => {
    if (state.bands.some((band) => distance(band.home, spot) < 1)) return false
    const radius = sightRadius(Math.min(MAX_BAND_LEVEL, levelAt(spot) + 1))
    return state.armies.every((army) => patrolDistance(spot, army.position) > radius)
  })
  let next = state
  if (free.length > 0 && patrolCount(state) < MAX_BANDS) {
    const { values, seed } = draws(state.seed, 5)
    const home = free[Math.floor(values[0] * free.length)]
    const level = Math.min(MAX_BAND_LEVEL, levelAt(home) + (values[1] < BAND_LEVEL_UP_CHANCE ? 1 : 0))
    const kinds = BAND_KINDS.filter((kind) => kind.minLevel <= level)
    const kind = kinds[Math.floor(values[2] * kinds.length)].id
    const band: Band = {
      id: state.nextId,
      kind,
      level,
      home: { ...home },
      monsters: bandMonsters(kind, level),
      phase: values[3] * loopLength(patrolLoop(home)),
      since: at,
      direction: values[4] < 0.5 ? 1 : -1,
      raid: false,
      encampment: false,
      still: false,
      chase: null,
    }
    next = { ...state, bands: [...state.bands, band], seed, nextId: state.nextId + 1 }
  }
  // Tant qu'il reste de la place, une autre bande viendra plus tard.
  return { ...next, nextBandAt: patrolCount(next) < MAX_BANDS ? at + BAND_SPAWN_SECONDS * SECOND : null }
}

/** Les bandes qui font leur ronde : les raids ne prennent pas leur place sur la carte. */
function patrolCount(state: GameState): number {
  return state.bands.filter((band) => !band.raid && !band.encampment).length
}

/**
 * Une bande vaincue disparaît. Si la carte était pleine, une autre bande viendra prendre sa place
 * (un raid, lui, ne libère aucun repaire).
 */
function removeBand(state: GameState, id: number, at: number): GameState {
  const band = getBand(state, id)
  return {
    ...state,
    bands: state.bands.filter((other) => other.id !== id),
    nextBandAt: band?.raid || band?.encampment ? state.nextBandAt : (state.nextBandAt ?? at + BAND_SPAWN_SECONDS * SECOND),
  }
}

// --- Le grand campement ---

/**
 * Le grand campement se repeuple : ses patrouilles et ses chefs reviennent au complet, à leur place,
 * sa porte se referme, ses pièges sont tendus à nouveau, et la clef retourne à son gardien. Une bande
 * du campement en pleine bataille la finit d'abord (elle garde sa place jusqu'au repeuplement suivant).
 */
function resetEncampment(state: GameState, at: number): GameState {
  const fighting = state.bands.filter((band) => band.encampment && bandFighting(state, band.id))
  let next: GameState = {
    ...state,
    bands: state.bands.filter((band) => !band.encampment || fighting.includes(band)),
    armies: state.armies.map((army) => (army.key ? { ...army, key: false } : army)),
    encampment: { resetAt: at + CAMP_RESPAWN_SECONDS * SECOND, gateOpen: false, sprung: [] },
  }
  for (const def of ENCAMPMENT_BANDS) {
    if (!fighting.some((band) => distance(band.home, def.home) < 1)) next = placeEncampmentBand(next, def, at)
  }
  return next
}

function placeEncampmentBand(state: GameState, def: (typeof ENCAMPMENT_BANDS)[number], at: number): GameState {
  const band: Band = {
    id: state.nextId,
    kind: def.kind,
    level: def.level,
    home: { ...def.home },
    monsters: bandMonsters(def.kind, def.level),
    phase: 0,
    since: at,
    direction: 1,
    raid: false,
    encampment: true,
    still: def.still,
    chase: null,
  }
  return { ...state, bands: [...state.bands, band], nextId: state.nextId + 1 }
}

/**
 * La clef est perdue (son armée est tombée, ou l'a rapportée à la cité) : elle retourne à son gardien,
 * qui revient la garder. (Sauf si la porte est déjà ouverte, ou une autre armée porte une clef.)
 */
function returnKey(state: GameState, at: number): GameState {
  if (state.encampment.resetAt === null || state.encampment.gateOpen) return state
  if (state.armies.some((army) => army.key) || state.bands.some((band) => band.kind === 'keeper')) return state
  const keeper = ENCAMPMENT_BANDS.find((def) => def.kind === 'keeper')
  return keeper ? placeEncampmentBand(state, keeper, at) : state
}

/** L'armée qui porte la clef arrive au seuil de la porte : la porte s'ouvre, jusqu'au prochain repeuplement. */
function openGate(state: GameState): GameState {
  const bearer = state.armies.find((army) => army.key && distance(army.position, ENCAMPMENT_GATE_FRONT) <= GATE_REACH)
  if (!bearer) return state
  return {
    ...state,
    armies: state.armies.map((army) => (army.id === bearer.id ? { ...army, key: false } : army)),
    encampment: { ...state.encampment, gateOpen: true },
  }
}

/** Le grand campement est-il là, et sa porte ouverte ? (Pour l'affichage et les tests.) */
export function gateOpen(state: GameState): boolean {
  return state.encampment.gateOpen
}

// --- Les raids et la défense de la cité ---

const BESIEGED = 'La cité est assiégée : tes troupes défendent les remparts'

/** Le niveau des raids qui visent la cité : il grandit avec le Château. */
export function raidLevel(state: GameState): number {
  return Math.min(MAX_BAND_LEVEL, Math.max(1, state.levels.castle - RAID_CASTLE_LEVEL + 1))
}

/** Les monstres d'un raid : plus nombreux que ceux d'une bande du même niveau. */
export function raidMonsters(kind: BandKindId, level: number): Monsters {
  return scaled(bandMonsters(kind, level), RAID_SIZE)
}

/** Ce que rapporte la victoire sur un raid : plus que sur une bande du même niveau. */
export function raidLoot(kind: BandKindId, level: number): Partial<Resources> {
  return scaled(bandLoot(kind, level), RAID_SIZE)
}

/** Les gardes qui veillent sur les Remparts : ils se battent à chaque siège, toujours au complet. */
export function wallGuards(state: GameState): number {
  return WALL_GUARDS_PER_LEVEL * state.levels.walls
}

/** Ce que le Château met à l'abri des pillards, pour chaque ressource. */
export function protectedAmount(state: GameState): number {
  return PROTECTED_PER_CASTLE_LEVEL * state.levels.castle
}

/** Le siège en cours, s'il y en a un : un raid se bat aux portes de la cité. */
export function siegeOf(state: GameState): Battle | undefined {
  return state.battles.find((battle) => battle.allies.some((ally) => ally.ref === CITY_REF))
}

/** La longueur du chemin d'un raid, de son point de départ à la cité. */
function raidLength(band: Band): number {
  return distance(band.home, WORLD.city)
}

/** Quand un raid atteindra la cité s'il n'est pas arrêté en chemin (null : il se bat). */
export function raidArrival(band: Band): number | null {
  if (!band.raid || band.since === null) return null
  const left = Math.max(0, raidLength(band) - band.phase)
  return band.since + Math.ceil((left / RAID_SPEED) * SECOND)
}

/**
 * Un raid part d'un bord de la carte, tiré au sort, et marche droit sur la cité. Sa sorte est
 * tirée parmi celles de son niveau. Il ne part jamais d'assez près d'une armée pour l'attaquer aussitôt,
 * ni tant que la Brume d'oubli cache la cité.
 */
function spawnRaid(state: GameState, at: number): GameState {
  // Une brume cache la cité : le raid attendra qu'elle se lève.
  const veil = raidsHeldUntil(state)
  if (veil !== null && veil > at) return { ...state, nextRaidAt: veil }
  const level = raidLevel(state)
  const far = RAID_GATES.filter((gate) =>
    state.armies.every((army) => distance(gate, army.position) > aggroRadius(level)),
  )
  const gates = far.length > 0 ? far : RAID_GATES
  const { values, seed } = draws(state.seed, 2)
  const gate = gates[Math.floor(values[0] * gates.length)]
  const kinds = BAND_KINDS.filter((kind) => kind.minLevel <= level)
  const kind = kinds[Math.floor(values[1] * kinds.length)].id
  const band: Band = {
    id: state.nextId,
    kind,
    level,
    home: { ...gate },
    monsters: raidMonsters(kind, level),
    phase: 0,
    since: at,
    direction: 1,
    raid: true,
    encampment: false,
    still: false,
    chase: null,
  }
  return {
    ...state,
    bands: [...state.bands, band],
    seed,
    nextId: state.nextId + 1,
    nextRaidAt: at + RAID_INTERVAL_SECONDS * SECOND,
  }
}

/**
 * Un raid arrive aux portes : il attaque la cité. Les troupes présentes dans la cité se battent, mieux
 * protégées grâce aux Remparts, avec les gardes qui y veillent (et le dragon, s'il est dans son aire).
 * Un raid qui arrive pendant un siège s'y joint ; s'il n'y a plus de place autour de la cité, il
 * attend son tour aux portes. Une cité sans défenseur est pillée sans combat.
 */
function startSiege(state: GameState, bandId: number, at: number): GameState {
  const band = getBand(state, bandId)
  if (!band) return state
  const atGates = updateBand(state, { ...band, phase: raidLength(band), since: at })
  const besieged = siegeOf(atGates)
  const next = engage(atGates, bandRef(bandId), CITY_REF, at)
  if (next === atGates) return updateBand(state, { ...band, phase: raidLength(band), since: at + SIEGE_WAIT_SECONDS * SECOND })
  if (besieged) return next
  const siege = siegeOf(next)
  const city = siege?.allies.find((ally) => ally.ref === CITY_REF)
  if (!siege || !city) return next
  const nobody = armySize(city.sent) === 0 && (city.siege?.guards ?? 0) === 0 && city.dragon === null
  return nobody ? leave(next, siege.id, CITY_REF, at, 'defeat') : next
}

/** Ce qu'un raid victorieux emporte : une part de ce que le Château ne protège pas, dans la limite de ce que portent les monstres. */
export function plunderOf(state: GameState, monsters: Monsters): Partial<Resources> {
  const safe = protectedAmount(state)
  const wanted = RESOURCE_IDS.map((id) => Math.max(0, state.resources[id] - safe) * RAID_PLUNDER_SHARE)
  const sum = wanted.reduce((a, b) => a + b, 0)
  const carriers = Object.values(monsters).reduce((a, b) => a + (b ?? 0), 0)
  const share = sum === 0 ? 0 : Math.min(1, (carriers * RAID_LOAD_PER_MONSTER) / sum)
  const plunder: Partial<Resources> = {}
  RESOURCE_IDS.forEach((id, i) => {
    // Le petit ajout évite qu'un calcul qui tombe juste (24) ne soit arrondi à 23 (23,999999…).
    const amount = Math.floor(wanted[i] * share + 1e-9)
    if (amount > 0) plunder[id] = amount
  })
  return plunder
}

/**
 * La cité quitte la mêlée : le siège se termine. Repoussés, les raids ont laissé leur butin, qui
 * rejoint les réserves ; vainqueurs, ils pillent la cité (tous ensemble), puis les monstres la laissent
 * tranquille un moment. Une part des défenseurs tombés n'est que blessée : elle va à l'hôpital, s'il
 * y reste des lits. Les raids encore debout s'en vont, et les armées venues aider la cité repartent,
 * sans vainqueur.
 */
function leaveCity(state: GameState, battle: Battle, ally: AllyFighter, at: number, outcome: Outcome): GameState {
  const { troops: survivors, guards: guardsLeft } = allySurvivors(ally)
  const lost = emptyArmy()
  const troops = { ...state.troops }
  for (const id of UNIT_IDS) {
    lost[id] = ally.sent[id] - survivors[id]
    troops[id] = Math.max(0, troops[id] - lost[id])
  }
  const hurt = woundFallen(state, lost)
  const enemyLost = addMonsters(ally.rounds.map((round) => round.enemyLost))
  const plunder = outcome === 'defeat' ? plunderOf(state, addMonsters(battle.foes.map(foeSurvivors))) : {}
  const withDragon = dragonAfterBattle(state, ally, battleXp(enemyLost), at, outcome)
  const guards = ally.siege?.guards ?? 0
  const siege: SiegeReport = { guards, guardsLost: guards - guardsLeft, healed: emptyArmy(), plunder }
  const report = allyReport(ally, at, outcome, lost, hurt.wounded, enemyLost, ally.loot, null, withDragon.gain, siege)
  let next: GameState = {
    ...withDragon.state,
    troops,
    wounded: hurt.state.wounded,
    resources: addResources(addResources(state.resources, ally.loot), plunder, -1),
    reports: [report, ...state.reports].slice(0, MAX_REPORTS),
    // Après un pillage, les monstres sont repus : le prochain raid attendra.
    nextRaidAt:
      outcome === 'defeat' ? Math.max(state.nextRaidAt ?? 0, at + RAID_RESPITE_SECONDS * SECOND) : state.nextRaidAt,
  }
  next = updateBattle(next, { ...battle, allies: battle.allies.filter((a) => a.ref !== CITY_REF) })
  if (outcome === 'victory') return next
  for (const other of battle.allies) if (other.ref !== CITY_REF) next = leave(next, battle.id, other.ref, at, 'draw')
  for (const raid of battle.foes) if (raid.band !== null) next = removeBand(next, raid.band, at)
  return removeBattle(next, battle.id)
}

// --- Les gisements de ressources ---

/** Ce que contient un gisement neuf, selon sa ressource et son niveau. */
export function nodeAmount(resource: ResourceId, level: number): number {
  return Math.round(NODE_KINDS[resource].amount * NODE_GROWTH ** (level - 1))
}

/** Un nouveau gisement apparaît sur un endroit libre, tiré au sort, avec une ressource tirée au sort. */
function spawnNode(state: GameState, at: number): GameState {
  const free = reachableFromCity(state, NODE_SPOTS).filter((spot) => !state.nodes.some((node) => distance(node.position, spot) < 1))
  let next = state
  if (free.length > 0 && state.nodes.length < MAX_NODES) {
    const { values, seed } = draws(state.seed, 2)
    const position = free[Math.floor(values[0] * free.length)]
    const resource = RESOURCE_IDS[Math.floor(values[1] * RESOURCE_IDS.length)]
    const level = levelAt(position)
    const node: ResourceNode = {
      id: state.nextId,
      resource,
      level,
      position: { ...position },
      remaining: nodeAmount(resource, level),
    }
    next = { ...state, nodes: [...state.nodes, node], seed, nextId: state.nextId + 1 }
  }
  return { ...next, nextNodeAt: next.nodes.length < MAX_NODES ? at + NODE_SPAWN_SECONDS * SECOND : null }
}

function updateNode(state: GameState, node: ResourceNode): GameState {
  return { ...state, nodes: state.nodes.map((n) => (n.id === node.id ? node : n)) }
}

/** Un gisement épuisé disparaît, et un autre viendra le remplacer. */
function removeNode(state: GameState, id: number, at: number): GameState {
  return {
    ...state,
    nodes: state.nodes.filter((node) => node.id !== id),
    nextNodeAt: state.nextNodeAt ?? at + NODE_SPAWN_SECONDS * SECOND,
  }
}

// --- La carte : distances et chemins en ligne droite ---

export function distance(a: Point, b: Point): number {
  // Math.sqrt donne exactement le même résultat sur tous les navigateurs (ce n'est pas le cas de Math.hypot).
  const dx = a.x - b.x
  const dy = a.y - b.y
  return Math.sqrt(dx * dx + dy * dy)
}

/** Le point situé à la fraction `t` (de 0 à 1) du chemin de `from` à `to`. */
function along(from: Point, to: Point, t: number): Point {
  return { x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t }
}

/** La distance entre un point et le segment qui va de `a` à `b`. */
function distanceToSegment(point: Point, a: Point, b: Point): number {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const length2 = dx * dx + dy * dy
  const t = length2 === 0 ? 0 : Math.min(1, Math.max(0, ((point.x - a.x) * dx + (point.y - a.y) * dy) / length2))
  return distance(point, along(a, b, t))
}

// --- Renvoi de troupes ---

export function checkDismiss(state: GameState, troops: Army): Check {
  if (siegeOf(state)) return { ok: false, reason: BESIEGED }
  return checkSelection(state, troops)
}

/** Renvoie des troupes chez elles : elles quittent l'armée et ne coûtent plus d'entretien. */
export function dismissTroops(state: GameState, troops: Army, now: number): GameState {
  const current = advance(state, now)
  const check = checkDismiss(current, troops)
  if (!check.ok) throw new Error(check.reason)

  const home = { ...current.troops }
  for (const id of UNIT_IDS) home[id] -= troops[id]
  return { ...current, troops: home }
}

// --- Le temps qui passe ---

interface PendingEvent {
  at: number
  apply: (state: GameState) => GameState
}

/**
 * Le prochain événement prévu : fin de chantier, de recherche, d'entraînement ou d'un sort,
 * apparition d'une bande ou d'un gisement, départ d'un raid ou son arrivée à la cité.
 */
function nextEvent(state: GameState): PendingEvent | null {
  const { constructions, research, spells, trainings, nextBandAt, nextNodeAt, nextRaidAt } = state
  const events: PendingEvent[] = []
  for (const active of spells) {
    events.push({
      at: active.endsAt,
      apply: (s) => ({ ...s, spells: s.spells.filter((other) => other.spell !== active.spell) }),
    })
  }
  for (const construction of constructions) {
    events.push({ at: construction.endsAt, apply: (s) => finishConstruction(s, construction) })
  }
  if (research) {
    events.push({
      at: research.endsAt,
      apply: (s) => ({ ...s, techs: { ...s.techs, [research.tech]: research.targetLevel }, research: null }),
    })
  }
  for (const training of trainings) {
    events.push({
      at: training.endsAt,
      apply: (s) => ({
        ...s,
        troops: { ...s.troops, [training.unit]: s.troops[training.unit] + training.count },
        trainings: s.trainings.filter((t) => t.unit !== training.unit),
      }),
    })
  }
  const healing = state.healing
  if (healing) {
    events.push({ at: healing.endsAt, apply: (s) => ({ ...s, troops: addArmies(s.troops, healing.troops), healing: null }) })
  }
  if (nextBandAt !== null) events.push({ at: nextBandAt, apply: (s) => spawnBand(s, nextBandAt) })
  if (nextNodeAt !== null) events.push({ at: nextNodeAt, apply: (s) => spawnNode(s, nextNodeAt) })
  if (nextRaidAt !== null) events.push({ at: nextRaidAt, apply: (s) => spawnRaid(s, nextRaidAt) })
  const resetAt = state.encampment.resetAt
  if (resetAt !== null) events.push({ at: resetAt, apply: (s) => resetEncampment(s, resetAt) })
  const hatchAt = state.dragon?.stage === 'hatching' ? state.dragon.hatchAt : null
  if (hatchAt !== null) {
    events.push({ at: hatchAt, apply: (s) => ({ ...s, dragon: { stage: 'grown', hatchAt: null, xp: 0, restUntil: null } }) })
  }
  for (const band of state.bands) {
    const arrival = raidArrival(band)
    if (arrival !== null) events.push({ at: arrival, apply: (s) => startSiege(s, band.id, arrival) })
  }
  return events.reduce<PendingEvent | null>((first, e) => (!first || e.at < first.at ? e : first), null)
}

/**
 * Un chantier se termine. Quand le Château atteint RAID_CASTLE_LEVEL, la cité est assez riche
 * pour attirer les monstres : un premier raid se prépare.
 */
function finishConstruction(state: GameState, construction: Construction): GameState {
  const next: GameState = {
    ...state,
    levels: { ...state.levels, [construction.building]: construction.targetLevel },
    constructions: state.constructions.filter((c) => c.building !== construction.building),
  }
  const attracts = construction.building === 'castle' && construction.targetLevel >= RAID_CASTLE_LEVEL
  return attracts && next.nextRaidAt === null
    ? { ...next, nextRaidAt: construction.endsAt + RAID_FIRST_SECONDS * SECOND }
    : next
}

/** Le prochain pas du monde (toujours à une seconde ronde), ou null si rien ne peut s'y passer. */
function nextTick(state: GameState): number | null {
  if (worldIsQuiet(state)) return null
  return Math.max(state.tickedAt + TICK, Math.ceil(state.updatedAt / TICK) * TICK)
}

/**
 * Fait avancer la partie jusqu'à l'instant `now` : les ressources s'accumulent, chaque événement
 * prévu (chantier, recherche, entraînement, apparition d'une bande ou d'un gisement, raid) arrive
 * à son heure, et tant que des armées sont dehors ou que la cité est assiégée, le monde avance
 * seconde par seconde (marches, batailles, récoltes, patrouilles). Tout cela même si personne ne regardait : c'est ce qui
 * permet au royaume de vivre hors connexion. Les secondes du monde tombent toujours aux mêmes
 * heures : avancer d'un coup ou seconde par seconde donne exactement le même résultat.
 */
export function advance(state: GameState, now: number): GameState {
  if (now <= state.updatedAt) return state
  let current = state
  let sameInstant = 0
  for (;;) {
    const event = nextEvent(current)
    const tick = nextTick(current)
    const at = Math.min(event?.at ?? Infinity, tick ?? Infinity)
    // Une heure qui n'est pas un nombre (une partie abîmée) ferait tourner la boucle sans fin.
    if (Number.isNaN(at)) throw new Error('Une heure de la partie n’est pas un nombre')
    if (at > now) break
    const before = current.updatedAt
    // On produit avec l'état actuel jusqu'à l'événement (ou le pas du monde), puis on l'applique.
    current = accrue(current, at)
    current = event && event.at === at ? event.apply(current) : worldTick(current, at)
    // Garde-fou : une erreur dans les règles ne doit jamais faire tourner le jeu en boucle.
    sameInstant = at === before ? sameInstant + 1 : 0
    if (sameInstant > 10_000) throw new Error('Trop d’événements au même instant')
  }
  return accrue(current, now)
}

/**
 * Ajoute la production gagnée (moins l'entretien) entre `state.updatedAt` et `until`. Une réserve pleine
 * ne grandit plus : la production s'arrête à la place des réserves (storageCapacity), sans rien retirer
 * de ce qui la dépasse déjà (un butin, une récompense). L'entretien, lui, continue de la vider.
 */
function accrue(state: GameState, until: number): GameState {
  const hours = Math.max(0, until - state.updatedAt) / HOUR
  const rates = netPerHour(state)
  const room = storageCapacity(state)
  const resources = { ...state.resources }
  for (const id of RESOURCE_IDS) {
    const reached = resources[id] + rates[id] * hours
    // Les réserves ne descendent jamais sous zéro. Quand la nourriture manque, les troupes ont faim (isStarving).
    resources[id] = rates[id] > 0 ? Math.max(resources[id], Math.min(room, reached)) : Math.max(0, reached)
  }
  return { ...state, resources, updatedAt: Math.max(state.updatedAt, until) }
}
