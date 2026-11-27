// Les règles du jeu, en TypeScript pur : aucune dépendance à Vue ni au navigateur.
// Chaque fonction reçoit l'état de la partie (et l'heure) et renvoie un résultat sans rien modifier.
// Le navigateur et le serveur utilisent exactement ces mêmes règles.

import { counts, fightRound, roundCap, total, type Stack } from './battle.ts'
import { clear, findRoute, insideAny, routeLength, walk, type Polygon } from './terrain.ts'
import {
  BAND_AGGRO_PER_LEVEL,
  BAND_AGGRO_RADIUS,
  CAMP_RESPAWN_SECONDS,
  ENCAMPMENT,
  ENCAMPMENT_BANDS,
  ENCAMPMENT_GATE,
  ENCAMPMENT_GATE_FRONT,
  GATE_REACH,
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
  HEROES,
  HERO_BASE_XP,
  HERO_MAX_LEVEL,
  HERO_XP_GROWTH,
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
  SIEGE_HEALED_SHARE,
  SIEGE_WAIT_SECONDS,
  SKILL_MAX_LEVEL,
  SPELLS,
  START_BANDS,
  START_LEVELS,
  START_NODES,
  START_RESOURCES,
  STARVATION_ATTACK_MALUS,
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
 * (`raid` : cette bande était un raid, en marche vers la cité).
 */
export type Foe =
  | { type: 'camp'; camp: CampId }
  | { type: 'band'; kind: BandKindId; level: number; raid?: boolean }

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
  /** Depuis quand elle marche ; null quand elle s'est arrêtée pour se battre. */
  since: number | null
  /** 1 ou -1 : le sens de sa ronde. */
  direction: number
  /** Un raid : il ne fait pas de ronde, il marche sur la cité. */
  raid: boolean
  /** Une bande du grand campement : elle revient à chaque repeuplement, et n'occupe aucun repaire de la carte. */
  encampment: boolean
  /** Un chef immobile : il garde sa place, sans faire de ronde. */
  still: boolean
}

/** Le grand campement : quand il se repeuplera (null : pas de campement, pour les tests), et sa porte. */
export interface EncampmentState {
  resetAt: number | null
  gateOpen: boolean
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

/** Une manche du combat, telle que la raconte le journal. */
export interface BattleRound {
  /** Dégâts infligés par ton armée, puis par les monstres. */
  dealt: number
  taken: number
  /** Pertes de la manche, de chaque côté. */
  lost: Army
  enemyLost: Monsters
  /** Pendant un siège : les gardes des Remparts tombés dans la manche. */
  guardsLost?: number
  /** Le dragon est tombé pendant cette manche : blessé, il quitte le combat. */
  dragonFell?: true
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

/** Une bataille en cours : une manche toutes les BATTLE_ROUND_SECONDS, jusqu'à ce qu'un camp tombe. */
export interface Battle {
  id: number
  /** L'armée qui se bat, ou null pour un siège : ce sont alors les troupes de la cité qui se battent. */
  army: number | null
  /** La bande combattue, ou null pour un camp. */
  band: number | null
  foe: Foe
  /** Une bande a attaqué l'armée qui entrait dans sa zone d'aggro. */
  ambush: boolean
  startedAt: number
  /** Les troupes et les monstres au début de la bataille. */
  sent: Army
  enemies: Monsters
  /** Les points de vie qui restent à chaque groupe : un combattant blessé continue de se battre. */
  armyHealth: Army
  foeHealth: Monsters
  /** L'effet des Armures et du héros au début de la bataille : il fixe la vie de chaque troupe. */
  healthFactor: number
  /** L'armée avait faim en début de bataille. */
  starving: boolean
  rounds: BattleRound[]
  /** Un raid assiège la cité ; null pour une bataille dehors. */
  siege: Siege | null
  /** Le dragon se bat avec les troupes ; null s'il n'est pas là. */
  dragon: BattleDragon | null
}

/** Comment une bataille s'est terminée, pour ton armée. */
export type Outcome = 'victory' | 'defeat' | 'retreat' | 'draw'

/** Ce qu'un siège a coûté à la cité, pour le rapport. */
export interface SiegeReport {
  /** Les gardes des Remparts au début du siège, et ceux qui sont tombés (ils sont remplacés ensuite). */
  guards: number
  guardsLost: number
  /** Les troupes tombées pendant le siège puis soignées dans la cité : elles ne sont pas perdues. */
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
  foe: Foe
  ambush: boolean
  outcome: Outcome
  sent: Army
  lost: Army
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
  /** Troupes présentes dans la cité. Celles qui sont sorties sont dans `armies`. */
  troops: Army
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
    troops: emptyArmy(),
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
    encampment: { resetAt: null, gateOpen: false },
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

/** Peut-on payer ? Sinon, ce qui manque : « Il manque 65 de mana et 120 de pierre ». */
export function checkCost(resources: Resources, cost: Partial<Resources>): Check {
  const missing = RESOURCE_IDS.filter((id) => resources[id] < (cost[id] ?? 0)).map((id) => {
    const name = RESOURCES[id].name.toLowerCase()
    const of = /^[aeiouh]/.test(name) ? 'd’' : 'de '
    return `${Math.ceil((cost[id] ?? 0) - resources[id])} ${of}${name}`
  })
  if (missing.length === 0) return { ok: true }
  const list = missing.length === 1 ? missing[0] : `${missing.slice(0, -1).join(', ')} et ${missing[missing.length - 1]}`
  return { ok: false, reason: `Il manque ${list}` }
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
  return checkCost(state.resources, upgradeCost(building, level + 1))
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
  return checkCost(state.resources, researchCost(tech, level + 1))
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
    total += effect.amount
  }
  return total
}

export function checkCast(state: GameState, spellId: SpellId): Check {
  const spell = getSpell(spellId)
  const tower = state.levels.mageTower
  if (tower === 0) return { ok: false, reason: 'Construis d’abord la Tour des mages' }
  if (tower < spell.towerLevel) return { ok: false, reason: `Nécessite la Tour des mages niveau ${spell.towerLevel}` }
  if (state.spells.some((active) => active.spell === spellId)) return { ok: false, reason: 'Ce sort agit déjà' }
  return checkCost(state.resources, spell.cost)
}

/** Lance un sort : il coûte du mana, et agit tout de suite, pour sa durée. */
export function castSpell(state: GameState, spellId: SpellId, now: number): GameState {
  const current = advance(state, now)
  const check = checkCast(current, spellId)
  if (!check.ok) throw new Error(check.reason)
  const spell = getSpell(spellId)
  return {
    ...current,
    resources: addResources(current.resources, spell.cost, -1),
    spells: [...current.spells, { spell: spellId, endsAt: now + spell.durationSeconds * SECOND }],
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
  return checkCost(state.resources, DRAGON_HATCH_COST)
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
  battle: Battle,
  xp: number,
  at: number,
  outcome: Outcome,
): { state: GameState; gain: DragonGain | null } {
  const dragon = state.dragon
  if (!battle.dragon || !dragon) return { state, gain: null }
  const before = dragonLevel(state)
  // Tombé au combat, ou resté seul quand toute son escorte est tombée : il regagne son aire et s'y repose.
  const wounded = battle.dragon.health <= 1e-9 || (battle.siege === null && outcome === 'defeat')
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
  return checkCost(state.resources, hero.cost)
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
    hero,
    dragon,
    key: false,
  }
  return { ...current, troops: home, armies: [...current.armies, army], nextId: current.nextId + 1 }
}

export function checkOrder(state: GameState, armyId: number, target: Target): Check {
  if (!getArmy(state, armyId)) return { ok: false, reason: 'Cette armée n’est plus dehors' }
  // Sinon, elle battrait en retraite pour aussitôt reprendre le même combat, ses blessés remis sur pied.
  const battle = state.battles.find((b) => b.army === armyId)
  if (battle && fightsAgainst(battle, target)) return { ok: false, reason: 'Ton armée combat déjà cette cible' }
  return checkTarget(state, target, armyId)
}

/** La bataille se livre-t-elle contre cette cible ? */
function fightsAgainst(battle: Battle, target: Target): boolean {
  if (target.type === 'band') return battle.band === target.band
  return target.type === 'camp' && battle.band === null && battle.foe.type === 'camp' && battle.foe.camp === target.camp
}

/** Un nouvel ordre pour une armée dehors. Si elle se bat, elle bat d'abord en retraite. */
export function orderArmy(state: GameState, armyId: number, target: Target, now: number): GameState {
  const current = advance(state, now)
  const check = checkOrder(current, armyId, target)
  if (!check.ok) throw new Error(check.reason)

  const battle = current.battles.find((b) => b.army === armyId)
  const next = battle ? endBattle(current, battle, now, 'retreat') : current
  const army = getArmy(next, armyId)
  if (!army) return next
  return updateArmy(next, { ...army, order: { ...target }, status: 'marching' })
}

/**
 * Les bandes qui patrouillent près du chemin de `from` à `to` : l'armée risque d'y être attaquée.
 * Un raid compte quand il se trouve en ce moment près de ce chemin.
 */
export function bandsNearPath(state: GameState, from: Point, to: Point, except?: Target): Band[] {
  const center = (band: Band) => (band.raid ? bandPosition(band, state.updatedAt) : band.home)
  const route = routeBetween(state, from, to) ?? [from, to]
  const near = (band: Band) =>
    route.some((point, i) => i > 0 && distanceToSegment(center(band), route[i - 1], point) <= PATROL_RADIUS + aggroRadius(band.level))
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

/** Tout le butin que laisse un adversaire vaincu : un camp, une bande ou un raid. */
export function foeLoot(foe: Foe): Partial<Resources> {
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
 * Un pas du monde, à l'instant `at` : d'abord les batailles (une manche quand c'est l'heure),
 * puis les armées (elles marchent, récoltent ou arrivent), enfin les zones d'aggro des bandes.
 */
function worldTick(state: GameState, at: number): GameState {
  let next: GameState = { ...state, tickedAt: at }
  for (const battle of state.battles) {
    if (at >= battle.startedAt + (battle.rounds.length + 1) * ROUND) next = playRound(next, battle.id, at)
  }
  for (const army of state.armies) next = stepArmy(next, army.id, at)
  return checkAggro(openGate(next), at)
}

/**
 * Rien ne peut arriver dehors : aucune bataille, et chaque armée attend sur place, hors de portée
 * des bandes. Le monde n'a alors pas besoin d'avancer seconde par seconde. (Un raid arrive à la cité
 * à une heure connue d'avance : sans armée dehors pour le croiser, il n'a pas besoin de ces pas.)
 */
function worldIsQuiet(state: GameState): boolean {
  if (state.battles.length > 0) return false
  if (state.armies.length === 0) return true
  // Un raid en marche peut croiser une armée, même immobile.
  if (state.bands.some((band) => band.raid)) return false
  return state.armies.every(
    (army) =>
      army.status === 'idle' &&
      state.bands.every(
        (band) =>
          army.fought.includes(band.id) ||
          (band.still ? distance(band.home, army.position) : patrolDistance(band.home, army.position)) >
            aggroRadius(band.level),
      ),
  )
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

  // Une bande visée : l'armée l'attaque dès qu'elle est à portée (et pas derrière une montagne), ou attend
  // qu'elle ait fini un autre combat.
  if (order.type === 'band') {
    const band = getBand(state, order.band)
    if (band && distance(army.position, destination) <= aggroRadius(band.level) && inSight(state, army.position, destination)) {
      return band.since === null ? state : startBattle(state, army, band, at, false)
    }
  }
  // L'armée suit son chemin, en contournant les montagnes. Si plus rien n'y mène, elle s'arrête là.
  const route = routeBetween(state, army.position, destination)
  if (!route) return updateArmy(state, { ...army, order: null, status: 'idle' })
  const step = marchSpeed(state, army.hero) * WORLD_TICK_SECONDS
  if (routeLength(route) > step) return updateArmy(state, { ...army, position: walk(route, step) })
  return arrive(updateArmy(state, { ...army, position: { ...destination } }), army.id, at)
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
      // Une autre armée l'a vidé entre-temps : il n'y a plus personne à combattre.
      if (campEmptyUntil(state, camp.id, at) !== null) return updateArmy(state, { ...army, order: null, status: 'idle' })
      return startBattle(state, army, null, at, false, { type: 'camp', camp: camp.id }, camp.defenders)
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

/** Une bande attaque toute armée qui entre dans sa zone d'aggro, sauf celles qu'elle a déjà combattues. */
function checkAggro(state: GameState, at: number): GameState {
  let next = state
  for (const { id } of state.armies) {
    const army = getArmy(next, id)
    if (!army || army.status === 'fighting') continue
    for (const band of next.bands) {
      if (band.since === null || army.fought.includes(band.id)) continue
      const position = bandPosition(band, at)
      if (distance(army.position, position) > aggroRadius(band.level) || !inSight(next, position, army.position)) continue
      const targeted = army.order?.type === 'band' && army.order.band === band.id
      next = startBattle(next, army, band, at, !targeted)
      break
    }
  }
  return next
}

// --- Les batailles, manche par manche ---

/**
 * Une bataille commence : contre une bande (qui s'arrête de patrouiller), ou contre les défenseurs
 * d'un camp. Les Armures et le héros de l'armée donnent plus de vie aux troupes, pour toute la bataille.
 */
function startBattle(
  state: GameState,
  army: FieldArmy,
  band: Band | null,
  at: number,
  ambush: boolean,
  campFoe?: Foe,
  campDefenders?: Monsters,
): GameState {
  const foe: Foe = band ? bandFoe(band) : campFoe!
  const monsters = standing(band ? band.monsters : (campDefenders ?? {}))
  const healthFactor =
    (1 + techBonus(state, 'health') + heroBonus(state, army.hero, 'health') + spellBonus(state, 'health')) *
    trialBoost(state)
  const armyHealth = emptyArmy()
  for (const id of UNIT_IDS) armyHealth[id] = army.troops[id] * getUnit(id).health * healthFactor
  const foeHealth = monsterHealth(monsters)
  const battle: Battle = {
    id: state.nextId,
    army: army.id,
    band: band?.id ?? null,
    foe,
    ambush,
    startedAt: at,
    sent: { ...army.troops },
    enemies: monsters,
    armyHealth,
    foeHealth,
    healthFactor,
    starving: isStarving(state),
    rounds: [],
    siege: null,
    dragon: army.dragon && state.dragon ? battleDragon(state, healthFactor) : null,
  }
  let next: GameState = { ...state, battles: [...state.battles, battle], nextId: state.nextId + 1 }
  next = updateArmy(next, { ...army, status: 'fighting' })
  if (band) next = updateBand(next, { ...band, phase: bandPhase(band, at), since: null })
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

/** L'armée qui livre cette bataille (aucune pour un siège : la cité se défend elle-même). */
function battleArmy(state: GameState, battle: Battle): FieldArmy | undefined {
  return battle.army === null ? undefined : getArmy(state, battle.army)
}

/**
 * Les groupes de la bataille, avec leurs forces du moment : la Forge, les compétences du héros
 * et la faim comptent à chaque manche. Pendant un siège, les gardes des Remparts forment un
 * groupe de plus, après les troupes.
 */
function battleStacks(state: GameState, battle: Battle): { attackers: Stack[]; defenders: Stack[]; monsterIds: MonsterId[] } {
  const hero = battleArmy(state, battle)?.hero ?? null
  const hunger = (isStarving(state) ? 1 - STARVATION_ATTACK_MALUS : 1) * trialBoost(state)
  const attackBonus = techBonus(state, 'attack') + heroBonus(state, hero, 'attack') + spellBonus(state, 'attack')
  const attackers: Stack[] = UNIT_IDS.map((id) => {
    const unit = getUnit(id)
    const factor = (1 + attackBonus + heroBonus(state, hero, 'familyAttack', unit.family)) * hunger
    return { family: unit.family, attack: unit.attack * factor, health: unit.health * battle.healthFactor, count: 0 }
  })
  if (battle.siege) attackers.push({ ...WALL_GUARD, count: 0 })
  // Le dragon : le tout dernier groupe. Les bonus d'attaque de son camp, et la faim, comptent pour lui aussi.
  if (battle.dragon) {
    const attack = battle.dragon.attack * (1 + attackBonus) * hunger
    attackers.push({ family: DRAGON_FAMILY, attack, health: battle.dragon.start, count: 0 })
  }
  const monsterIds = Object.keys(battle.enemies) as MonsterId[]
  const defenders: Stack[] = monsterIds.map((id) => {
    const monster = getMonster(id)
    return { family: monster.family, attack: monster.attack, health: monster.health, count: 0 }
  })
  return { attackers, defenders, monsterIds }
}

/**
 * La vie de chaque camp d'une bataille, au début et maintenant : d'un côté les troupes (avec les
 * gardes des Remparts pendant un siège), de l'autre les monstres.
 */
export function battleHealth(battle: Battle): { army: { start: number; now: number }; foe: { start: number; now: number } } {
  const army = battle.siege
    ? { start: battle.siege.guards * WALL_GUARD.health, now: battle.siege.guardHealth }
    : { start: 0, now: 0 }
  if (battle.dragon) {
    army.start += battle.dragon.start
    army.now += battle.dragon.health
  }
  for (const id of UNIT_IDS) {
    army.start += battle.sent[id] * getUnit(id).health * battle.healthFactor
    army.now += battle.armyHealth[id]
  }
  const foe = { start: 0, now: 0 }
  for (const [id, count] of Object.entries(battle.enemies) as [MonsterId, number][]) {
    foe.start += count * getMonster(id).health
    foe.now += battle.foeHealth[id] ?? 0
  }
  return { army, foe }
}

/**
 * Ce que chaque camp peut perdre au plus en une manche : une part de sa vie au début de la bataille
 * (les troupes et les gardes d'un côté, les monstres de l'autre). La bataille dure ainsi un moment.
 */
function battleCaps(battle: Battle): { attackers: number; defenders: number } {
  const health = battleHealth(battle)
  return { attackers: roundCap(health.army.start), defenders: roundCap(health.foe.start) }
}

/** Les troupes, les monstres et (pendant un siège) les gardes des Remparts encore debout dans une bataille. */
export function battleSurvivors(battle: Battle): { troops: Army; monsters: Monsters; guards: number; dragon: boolean } {
  const troops = emptyArmy()
  for (const id of UNIT_IDS) {
    troops[id] = Math.max(0, Math.ceil(battle.armyHealth[id] / (getUnit(id).health * battle.healthFactor) - 1e-9))
  }
  const monsters: Monsters = {}
  for (const id of Object.keys(battle.enemies) as MonsterId[]) {
    monsters[id] = Math.max(0, Math.ceil((battle.foeHealth[id] ?? 0) / getMonster(id).health - 1e-9))
  }
  const guards = battle.siege ? Math.max(0, Math.ceil(battle.siege.guardHealth / WALL_GUARD.health - 1e-9)) : 0
  const dragon = battle.dragon !== null && battle.dragon.health > 1e-9
  return { troops, monsters, guards, dragon }
}

/** Une manche : les deux camps frappent en même temps. La bataille s'arrête quand un camp tombe. */
function playRound(state: GameState, battleId: number, at: number): GameState {
  const battle = state.battles.find((b) => b.id === battleId)
  if (!battle) return state
  const { attackers, defenders, monsterIds } = battleStacks(state, battle)
  const armyHealth = UNIT_IDS.map((id) => battle.armyHealth[id])
  // Les gardes des Remparts : un groupe de plus, après les troupes ; puis le dragon.
  const guardIndex = UNIT_IDS.length
  if (battle.siege) armyHealth.push(battle.siege.guardHealth)
  const dragonIndex = armyHealth.length
  if (battle.dragon) armyHealth.push(battle.dragon.health)
  const foeHealth = monsterIds.map((id) => battle.foeHealth[id] ?? 0)
  const before = { attackers: counts(attackers, armyHealth), defenders: counts(defenders, foeHealth) }
  const round = fightRound(attackers, defenders, armyHealth, foeHealth, battleCaps(battle))

  const nextArmyHealth = emptyArmy()
  const lost = emptyArmy()
  UNIT_IDS.forEach((id, i) => {
    nextArmyHealth[id] = round.attackerHealth[i]
    lost[id] = before.attackers[i] - round.log.attackers[i]
  })
  const nextFoeHealth: Monsters = {}
  const enemyLost: Monsters = {}
  monsterIds.forEach((id, i) => {
    nextFoeHealth[id] = round.defenderHealth[i]
    enemyLost[id] = before.defenders[i] - round.log.defenders[i]
  })
  const played: BattleRound = {
    dealt: Math.round(round.log.damageByAttackers),
    taken: Math.round(round.log.damageByDefenders),
    lost,
    enemyLost,
  }
  if (battle.siege) played.guardsLost = before.attackers[guardIndex] - round.log.attackers[guardIndex]
  if (battle.dragon && before.attackers[dragonIndex] > 0 && round.log.attackers[dragonIndex] === 0) {
    played.dragonFell = true
  }
  const updated: Battle = {
    ...battle,
    armyHealth: nextArmyHealth,
    foeHealth: nextFoeHealth,
    rounds: [...battle.rounds, played],
    siege: battle.siege && { ...battle.siege, guardHealth: round.attackerHealth[guardIndex] },
    dragon: battle.dragon && { ...battle.dragon, health: round.attackerHealth[dragonIndex] },
  }
  const next = { ...state, battles: state.battles.map((b) => (b.id === battleId ? updated : b)) }
  // Plus aucun monstre debout : c'est une victoire, même si les derniers défenseurs tombent dans la
  // même manche. Dehors, le dragon ne se bat jamais seul : quand toute son escorte est tombée, la
  // bataille est perdue, et il regagne son aire. À la cité, lui et les gardes défendent jusqu'au bout.
  const standing = battle.siege ? round.log.attackers : round.log.attackers.slice(0, UNIT_IDS.length)
  if (total(round.log.defenders) === 0) return endBattle(next, updated, at, 'victory')
  if (total(standing) === 0) return endBattle(next, updated, at, 'defeat')
  if (updated.rounds.length >= MAX_BATTLE_ROUNDS) return endBattle(next, updated, at, 'draw')
  return next
}

/**
 * La bataille se termine : on écrit le rapport. Une bande vaincue disparaît ; sinon elle garde ses
 * survivants et reprend sa ronde (ou, pour un raid, sa marche vers la cité). Une armée anéantie
 * disparaît. Attaquée en chemin, une armée qui survit reprend sa route (sa récolte, son retour…) ;
 * sinon elle reste sur place, avec le butin d'une victoire, en attendant un ordre.
 */
function endBattle(state: GameState, battle: Battle, at: number, outcome: Outcome): GameState {
  if (battle.siege) return endSiege(state, battle, battle.siege, at, outcome)
  const { troops: survivors, monsters: monstersLeft } = battleSurvivors(battle)
  const lost = emptyArmy()
  for (const id of UNIT_IDS) lost[id] = battle.sent[id] - survivors[id]
  const enemyLost: Monsters = {}
  for (const id of Object.keys(battle.enemies) as MonsterId[]) {
    enemyLost[id] = (battle.enemies[id] ?? 0) - (monstersLeft[id] ?? 0)
  }
  const foe = battle.foe
  const raid = foe.type === 'band' && foe.raid === true
  // Le butin d'une victoire part avec l'armée, dans la limite de ce que portent ses survivants (en plus de
  // ce qu'elle porte déjà) : le reste demeure sur place. Sans survivant, personne ne l'emporte.
  const carrier = battleArmy(state, battle)
  const room = carrier ? carryCapacity(state, survivors, carrier.hero) - loadSize(carrier.load) : 0
  const loot = outcome === 'victory' ? fitLoad(foeLoot(foe), room) : {}
  let next: GameState = { ...state, battles: state.battles.filter((b) => b.id !== battle.id) }
  if (outcome === 'victory') {
    const stats = next.stats
    const camps = { ...stats.campsDefeated }
    if (foe.type === 'camp') camps[foe.camp] = (camps[foe.camp] ?? 0) + 1
    // Un camp vaincu reste vide un moment.
    const cleared = foe.type === 'camp' ? { ...next.campsCleared, [foe.camp]: at + CAMP_RESPAWN_SECONDS * SECOND } : next.campsCleared
    next = {
      ...next,
      campsCleared: cleared,
      stats: {
        ...stats,
        victories: stats.victories + 1,
        bandsDefeated: stats.bandsDefeated + (battle.band === null ? 0 : 1),
        // Un raid arrêté en chemin n'atteindra jamais la cité : il est repoussé.
        raidsRepelled: stats.raidsRepelled + (raid ? 1 : 0),
        campsDefeated: camps,
      },
    }
  }

  // Le héros et le dragon de l'armée gagnent de l'expérience pour chaque monstre vaincu, quelle que soit l'issue.
  const xp = battleXp(enemyLost)
  const withDragon = dragonAfterBattle(next, battle, xp, at, outcome)
  next = withDragon.state
  const heroId = battleArmy(state, battle)?.hero ?? null
  const hero = heroId === null ? undefined : getHero(state, heroId)
  let heroGain: HeroGain | null = null
  if (hero) {
    const after = gainXp(hero, xp)
    next = updateHero(next, after)
    heroGain = { hero: hero.id, xp, level: after.level, levelsGained: after.level - hero.level }
  }

  const report: BattleReport = {
    at,
    startedAt: battle.startedAt,
    army: battle.army,
    foe,
    ambush: battle.ambush,
    outcome,
    sent: { ...battle.sent },
    lost,
    enemies: { ...battle.enemies },
    enemyLost,
    loot,
    starving: battle.starving,
    rounds: battle.rounds,
    hero: heroGain,
    siege: null,
    dragon: withDragon.gain,
  }
  next = { ...next, reports: [report, ...next.reports].slice(0, MAX_REPORTS) }

  const band = battle.band === null ? undefined : getBand(next, battle.band)
  if (band) {
    next = outcome === 'victory' ? removeBand(next, band.id, at) : updateBand(next, { ...band, monsters: monstersLeft, since: at })
  }
  const army = battleArmy(next, battle)
  // Vaincu, le gardien de la clef la laisse à l'armée qui l'a battu.
  const wonKey = outcome === 'victory' && foe.type === 'band' && foe.kind === 'keeper'
  if (!army) return wonKey ? returnKey(next, at) : next
  if (armySize(survivors) === 0) {
    // Personne pour porter la clef : elle retourne à son gardien.
    const gone = removeArmy(next, army.id)
    return army.key || wonKey ? returnKey(gone, at) : gone
  }
  const fought = battle.band === null || army.fought.includes(battle.band) ? army.fought : [...army.fought, battle.band]
  // Blessé, le dragon quitte l'armée pour regagner son aire.
  const dragon = army.dragon && !withDragon.gain?.wounded
  const after: FieldArmy = { ...army, troops: survivors, load: mergeLoot(army.load, loot), fought, dragon, key: army.key || wonKey }
  const resume = battle.ambush && army.order !== null
  return updateArmy(next, resume ? { ...after, status: 'marching' } : { ...after, status: 'idle', order: null })
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
 * cité), sauf pendant un combat.
 */
export function bandPosition(band: Band, at: number): Point {
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
    const radius = aggroRadius(Math.min(MAX_BAND_LEVEL, levelAt(spot) + 1))
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
 * Le grand campement se repeuple : ses patrouilles et ses chefs reviennent au complet, sa porte se
 * referme, et la clef retourne à son gardien. Une bande du campement en pleine bataille la finit
 * d'abord (sa place reste vide jusqu'au repeuplement suivant).
 */
function resetEncampment(state: GameState, at: number): GameState {
  const fighting = state.bands.filter((band) => band.encampment && band.since === null)
  let next: GameState = {
    ...state,
    bands: state.bands.filter((band) => !band.encampment || band.since === null),
    armies: state.armies.map((army) => (army.key ? { ...army, key: false } : army)),
    encampment: { resetAt: at + CAMP_RESPAWN_SECONDS * SECOND, gateOpen: false },
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
  return state.battles.find((battle) => battle.siege !== null)
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
 * tirée parmi celles de son niveau. Il ne part jamais d'assez près d'une armée pour l'attaquer aussitôt.
 */
function spawnRaid(state: GameState, at: number): GameState {
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
 * Le raid arrive aux portes : le siège commence. Les troupes présentes dans la cité se battent,
 * mieux protégées grâce aux Remparts, avec les gardes qui y veillent. Une cité sans défenseur
 * est pillée sans combat.
 */
function startSiege(state: GameState, bandId: number, at: number): GameState {
  const band = getBand(state, bandId)
  if (!band) return state
  const atGates = { ...band, phase: raidLength(band) }
  // Un seul siège à la fois : ce raid attend son tour aux portes.
  if (siegeOf(state)) return updateBand(state, { ...atGates, since: at + SIEGE_WAIT_SECONDS * SECOND })

  const guards = wallGuards(state)
  const healthFactor =
    (1 + techBonus(state, 'health') + spellBonus(state, 'health') + WALL_HEALTH_PER_LEVEL * state.levels.walls) *
    trialBoost(state)
  const armyHealth = emptyArmy()
  for (const id of UNIT_IDS) armyHealth[id] = state.troops[id] * getUnit(id).health * healthFactor
  const monsters = standing(band.monsters)
  const siege: Siege = { guards, guardHealth: guards * WALL_GUARD.health }
  const battle: Battle = {
    id: state.nextId,
    army: null,
    band: band.id,
    foe: bandFoe(band),
    ambush: false,
    startedAt: at,
    sent: { ...state.troops },
    enemies: monsters,
    armyHealth,
    foeHealth: monsterHealth(monsters),
    healthFactor,
    starving: isStarving(state),
    rounds: [],
    siege,
    // Le dragon, s'il est dans son aire, défend la cité.
    dragon: dragonAtHome(state, at) ? battleDragon(state, healthFactor) : null,
  }
  const next = updateBand(
    { ...state, battles: [...state.battles, battle], nextId: state.nextId + 1 },
    { ...atGates, since: null },
  )
  const nobody = armySize(state.troops) === 0 && guards === 0 && battle.dragon === null
  return nobody ? endSiege(next, battle, siege, at, 'defeat') : next
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
 * Le siège se termine, et le raid s'en va dans tous les cas. Repoussé, il laisse son butin dans
 * les réserves. Vainqueur, il pille la cité, puis les monstres la laissent tranquille un moment.
 * Une part des troupes tombées est soignée : elle retrouve la garnison.
 */
function endSiege(state: GameState, battle: Battle, siege: Siege, at: number, outcome: Outcome): GameState {
  const { troops: survivors, monsters: monstersLeft, guards: guardsLeft } = battleSurvivors(battle)
  const lost = emptyArmy()
  const healed = emptyArmy()
  const troops = { ...state.troops }
  for (const id of UNIT_IDS) {
    const fallen = battle.sent[id] - survivors[id]
    healed[id] = Math.ceil(fallen * SIEGE_HEALED_SHARE)
    lost[id] = fallen - healed[id]
    troops[id] = Math.max(0, troops[id] - lost[id])
  }
  const enemyLost: Monsters = {}
  for (const id of Object.keys(battle.enemies) as MonsterId[]) {
    enemyLost[id] = (battle.enemies[id] ?? 0) - (monstersLeft[id] ?? 0)
  }
  const foe = battle.foe
  const loot = outcome === 'victory' && foe.type === 'band' ? raidLoot(foe.kind, foe.level) : {}
  const plunder = outcome === 'defeat' ? plunderOf(state, monstersLeft) : {}
  const withDragon = dragonAfterBattle(state, battle, battleXp(enemyLost), at, outcome)
  const stats = state.stats
  const report: BattleReport = {
    at,
    startedAt: battle.startedAt,
    army: null,
    foe,
    ambush: false,
    outcome,
    sent: { ...battle.sent },
    lost,
    enemies: { ...battle.enemies },
    enemyLost,
    loot,
    starving: battle.starving,
    rounds: battle.rounds,
    hero: null,
    siege: { guards: siege.guards, guardsLost: siege.guards - guardsLeft, healed, plunder },
    dragon: withDragon.gain,
  }
  const next: GameState = {
    ...withDragon.state,
    troops,
    resources: addResources(addResources(state.resources, loot), plunder, -1),
    battles: state.battles.filter((b) => b.id !== battle.id),
    reports: [report, ...state.reports].slice(0, MAX_REPORTS),
    stats:
      outcome === 'victory'
        ? {
            ...stats,
            victories: stats.victories + 1,
            bandsDefeated: stats.bandsDefeated + 1,
            raidsRepelled: stats.raidsRepelled + 1,
          }
        : stats,
    // Après un pillage, les monstres sont repus : le prochain raid attendra.
    nextRaidAt:
      outcome === 'defeat' ? Math.max(state.nextRaidAt ?? 0, at + RAID_RESPITE_SECONDS * SECOND) : state.nextRaidAt,
  }
  return battle.band === null ? next : removeBand(next, battle.band, at)
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

/** Ajoute la production gagnée (moins l'entretien) entre `state.updatedAt` et `until`. */
function accrue(state: GameState, until: number): GameState {
  const hours = Math.max(0, until - state.updatedAt) / HOUR
  const rates = netPerHour(state)
  const resources = { ...state.resources }
  // Les réserves ne descendent jamais sous zéro. Quand la nourriture manque, les troupes ont faim (isStarving).
  for (const id of RESOURCE_IDS) resources[id] = Math.max(0, resources[id] + rates[id] * hours)
  return { ...state, resources, updatedAt: Math.max(state.updatedAt, until) }
}
