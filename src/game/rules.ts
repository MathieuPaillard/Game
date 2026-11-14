// Les règles du jeu, en TypeScript pur : aucune dépendance à Vue ni au navigateur.
// Chaque fonction reçoit l'état de la partie (et l'heure) et renvoie un résultat sans rien modifier.
// Plus tard, le serveur utilisera exactement ces mêmes règles.

import { fight, type Stack } from './battle.ts'
import {
  BAND_AGGRO_PER_LEVEL,
  BAND_AGGRO_RADIUS,
  BAND_GROWTH,
  BAND_KINDS,
  BAND_LEVEL_RING,
  BAND_LEVEL_START,
  BAND_LEVEL_UP_CHANCE,
  BAND_LOOT_GROWTH,
  BAND_SPAWN_SECONDS,
  BAND_SPOTS,
  BARRACKS_SPEED_PER_LEVEL,
  BUILDINGS,
  CAMPS,
  COST_GROWTH,
  DURATION_GROWTH,
  MARCH_SPEED,
  MAX_BAND_LEVEL,
  MAX_BANDS,
  MAX_LEVEL,
  MAX_REPORTS,
  MONSTERS,
  PRODUCTION_GROWTH,
  RACES,
  RESOURCE_IDS,
  START_BANDS,
  START_LEVELS,
  START_RESOURCES,
  STARVATION_ATTACK_MALUS,
  TECHS,
  TRAINING_BATCH_PER_LEVEL,
  UNITS,
  UNIT_IDS,
  WORLD,
  type Army,
  type BandKindDef,
  type BandKindId,
  type BuildingDef,
  type BuildingId,
  type CampDef,
  type CampId,
  type MonsterDef,
  type MonsterId,
  type Point,
  type RaceDef,
  type RaceId,
  type ResourceId,
  type Resources,
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

/** Des monstres : un nombre pour chaque sorte. */
export type Monsters = Partial<Record<MonsterId, number>>

/** Ce qu'une armée peut attaquer : un camp, ou une bande de monstres (par son numéro). */
export type Target = { type: 'camp'; camp: CampId } | { type: 'band'; band: number }

/** Contre qui une bataille a lieu, pour les rapports : un camp, ou une sorte de bande et son niveau. */
export type Foe = { type: 'camp'; camp: CampId } | { type: 'band'; kind: BandKindId; level: number }

/** Une bande de monstres installée sur la carte des alentours. */
export interface Band {
  id: number
  kind: BandKindId
  level: number
  position: Point
  /** Les monstres encore debout : une bande garde ses pertes d'une bataille à l'autre. */
  monsters: Monsters
}

/**
 * Une armée en campagne. Elle marche en ligne droite de la cité jusqu'à `destination`, puis revient.
 * En chemin, elle peut tomber dans la zone d'aggro d'une bande, qui l'attaque.
 */
export interface Expedition {
  id: number
  target: Target
  /** La cible, telle qu'elle était au départ (pour l'afficher, même si la bande a disparu depuis). */
  foe: Foe
  /** Où l'armée se rend : sa cible, ou l'endroit où elle a dû faire demi-tour. */
  destination: Point
  /** Les troupes encore debout dans cette armée. */
  troops: Army
  /** Le butin gagné en chemin, déposé à la cité au retour. */
  loot: Partial<Resources>
  departedAt: number
  arrivesAt: number
  returnsAt: number
  /** L'armée a fait demi-tour : elle rentre à la cité. */
  returning: boolean
  /** Les bandes que cette armée a déjà combattues : elles ne l'attaquent plus. */
  fought: number[]
}

/** Une manche du combat, telle que la raconte le journal. */
export interface BattleRound {
  /** Dégâts infligés par ton armée, puis par les monstres. */
  dealt: number
  taken: number
  /** Pertes de la manche, de chaque côté. */
  lost: Army
  enemyLost: Monsters
}

export interface BattleReport {
  at: number
  /** Le numéro de l'armée qui s'est battue. */
  army: number
  foe: Foe
  /** Une bande a attaqué l'armée en chemin, dans sa zone d'aggro. */
  ambush: boolean
  victory: boolean
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
}

/** Tout ce qu'il faut savoir sur une partie. Les heures sont en millisecondes (comme Date.now()). */
export interface GameState {
  race: RaceId
  resources: Resources
  levels: Record<BuildingId, number>
  construction: Construction | null
  /** Niveau atteint dans chaque recherche. */
  techs: Record<TechId, number>
  research: Research | null
  /** Troupes présentes dans la cité. Celles qui sont en campagne sont dans `expeditions`. */
  troops: Army
  /** Entraînements en cours à la Caserne : au plus un par type de troupe. */
  trainings: Training[]
  /** Armées en campagne : au plus une par cible, et pas plus que maxExpeditions(). */
  expeditions: Expedition[]
  /** Derniers rapports de bataille, du plus récent au plus ancien. */
  reports: BattleReport[]
  /** Les bandes de monstres installées sur la carte des alentours. */
  bands: Band[]
  /** Quand la prochaine bande apparaîtra, ou null si la carte est pleine. */
  nextBandAt: number | null
  /** La graine du hasard (voir random) : les bandes sont tirées au sort, de façon reproductible. */
  seed: number
  /** Le prochain numéro libre, pour les bandes et les armées. */
  nextId: number
  /** Instant jusqu'auquel les ressources ont été calculées. */
  updatedAt: number
}

/** Une action est-elle possible ? Sinon, pourquoi ? */
export type Check = { ok: true } | { ok: false; reason: string }

const SECOND = 1000
const HOUR = 60 * 60 * SECOND

/** Une nouvelle partie. La graine du hasard vient par défaut de l'heure de création. */
export function newGame(race: RaceId, now: number, seed = now): GameState {
  let state: GameState = {
    race,
    resources: { ...START_RESOURCES },
    levels: { ...START_LEVELS },
    construction: null,
    techs: emptyTechs(),
    research: null,
    troops: emptyArmy(),
    trainings: [],
    expeditions: [],
    reports: [],
    bands: [],
    nextBandAt: null,
    seed: seed | 0,
    nextId: 1,
    updatedAt: now,
  }
  // Quelques bandes rôdent déjà autour de la cité.
  for (let i = 0; i < START_BANDS; i++) state = spawnBand(state, now)
  return state
}

export function emptyResources(): Resources {
  return Object.fromEntries(RESOURCE_IDS.map((id) => [id, 0])) as Resources
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

// --- Ressources et production ---

export function canAfford(resources: Resources, cost: Partial<Resources>): boolean {
  return RESOURCE_IDS.every((id) => resources[id] >= (cost[id] ?? 0))
}

/** Ajoute (ou retire, avec sign = -1) des ressources. */
function addResources(resources: Resources, delta: Partial<Resources>, sign = 1): Resources {
  const result = { ...resources }
  for (const id of RESOURCE_IDS) result[id] += sign * (delta[id] ?? 0)
  return result
}

/** Production par heure d'un bâtiment à un niveau donné, bonus de race et de recherches compris. */
export function buildingOutput(state: GameState, building: BuildingDef, level: number): number {
  if (!building.produces || !building.baseProductionPerHour || level <= 0) return 0
  const raceBonus = getRace(state.race).productionBonus[building.produces] ?? 0
  const researchBonus = techBonus(state, 'production', building.produces)
  return building.baseProductionPerHour * PRODUCTION_GROWTH ** (level - 1) * (1 + raceBonus + researchBonus)
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

/** Toutes les troupes du joueur : celles de la cité et celles qui sont en campagne. */
export function allTroops(state: GameState): Army {
  const all = { ...state.troops }
  for (const expedition of state.expeditions) {
    for (const id of UNIT_IDS) all[id] += expedition.troops[id]
  }
  return all
}

function armyUpkeep(army: Army): number {
  return UNIT_IDS.reduce((sum, id) => sum + army[id] * getUnit(id).upkeepPerHour, 0)
}

/** Nourriture mangée chaque heure par les troupes, dans la cité comme en campagne. */
export function upkeepPerHour(state: GameState): number {
  return armyUpkeep(allTroops(state))
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
  if (state.construction) return { ok: false, reason: 'Un chantier est déjà en cours' }
  if (!canAfford(state.resources, upgradeCost(building, level + 1))) {
    return { ok: false, reason: 'Ressources insuffisantes' }
  }
  return { ok: true }
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
    construction: {
      building: buildingId,
      targetLevel,
      startedAt: now,
      endsAt: now + upgradeDuration(current, building, targetLevel),
    },
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
  if (!canAfford(state.resources, researchCost(tech, level + 1))) {
    return { ok: false, reason: 'Ressources insuffisantes' }
  }
  return { ok: true }
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
  if (!canAfford(state.resources, trainingCost(unit, count))) {
    return { ok: false, reason: 'Ressources insuffisantes' }
  }
  return { ok: true }
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

// --- Expéditions : les armées en campagne ---

/** Nombre d'armées qui peuvent être en campagne en même temps : 1, plus le Commandement. */
export function maxExpeditions(state: GameState): number {
  return 1 + techBonus(state, 'armies')
}

/** Durée (en millisecondes) de la marche de la cité jusqu'à `destination` (le retour dure autant), Marche forcée comprise. */
export function marchDuration(state: GameState, destination: Point): number {
  const seconds = distance(WORLD.city, destination) / MARCH_SPEED
  return Math.round(seconds * (1 - techBonus(state, 'marchSpeed')) * SECOND)
}

/** La place d'une cible sur la carte, ou null si c'est une bande qui n'est plus là. */
export function targetPosition(state: GameState, target: Target): Point | null {
  if (target.type === 'camp') return getCamp(target.camp).position
  return getBand(state, target.band)?.position ?? null
}

/** Ces deux cibles sont-elles la même ? */
export function sameTarget(a: Target, b: Target): boolean {
  return a.type === 'camp' ? b.type === 'camp' && a.camp === b.camp : b.type === 'band' && a.band === b.band
}

/** Le camp ciblé, ou la sorte et le niveau de la bande ciblée (null si elle n'est plus là). */
function foeOf(state: GameState, target: Target): Foe | null {
  if (target.type === 'camp') return { type: 'camp', camp: target.camp }
  const band = getBand(state, target.band)
  return band ? { type: 'band', kind: band.kind, level: band.level } : null
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

/** Peut-on envoyer une armée vers cette cible, quelles que soient les troupes choisies ? */
export function checkExpeditionSlot(state: GameState, target: Target): Check {
  if (target.type === 'camp') getCamp(target.camp)
  else if (!getBand(state, target.band)) return { ok: false, reason: 'Cette bande n’est plus là' }
  if (state.expeditions.some((e) => sameTarget(e.target, target))) {
    return { ok: false, reason: `Une armée est déjà en route vers ${target.type === 'camp' ? 'ce camp' : 'cette bande'}` }
  }
  const max = maxExpeditions(state)
  if (state.expeditions.length >= max) {
    return {
      ok: false,
      reason: max === 1 ? 'Une armée est déjà en campagne' : `Tes ${max} armées sont déjà en campagne`,
    }
  }
  return { ok: true }
}

export function checkExpedition(state: GameState, target: Target, troops: Army): Check {
  const slot = checkExpeditionSlot(state, target)
  return slot.ok ? checkSelection(state, troops) : slot
}

/** Envoie une armée vers une cible : elle quitte la cité tout de suite, et marche en ligne droite. */
export function startExpedition(state: GameState, target: Target, troops: Army, now: number): GameState {
  const current = advance(state, now)
  const check = checkExpedition(current, target, troops)
  if (!check.ok) throw new Error(check.reason)

  const destination = targetPosition(current, target)
  const foe = foeOf(current, target)
  if (!destination || !foe) throw new Error('Cible introuvable')
  const march = marchDuration(current, destination)
  const home = { ...current.troops }
  for (const id of UNIT_IDS) home[id] -= troops[id]
  const expedition: Expedition = {
    id: current.nextId,
    target: { ...target },
    foe,
    destination: { ...destination },
    troops: { ...troops },
    loot: {},
    departedAt: now,
    arrivesAt: now + march,
    returnsAt: now + 2 * march,
    returning: false,
    fought: [],
  }
  return { ...current, troops: home, expeditions: [...current.expeditions, expedition], nextId: current.nextId + 1 }
}

/** Où se trouve une armée à l'instant `at` : elle marche en ligne droite, à l'aller comme au retour. */
export function expeditionPosition(expedition: Expedition, at: number): Point {
  const leg = currentLeg(expedition)
  const t = leg.end > leg.start ? Math.min(1, Math.max(0, (at - leg.start) / (leg.end - leg.start))) : 1
  return along(leg.from, leg.to, t)
}

/** Le trajet en cours d'une armée : l'aller, ou le retour. */
function currentLeg(expedition: Expedition) {
  const { destination, departedAt, arrivesAt, returnsAt } = expedition
  return expedition.returning
    ? { from: destination, to: WORLD.city, start: arrivesAt, end: returnsAt }
    : { from: WORLD.city, to: destination, start: departedAt, end: arrivesAt }
}

interface BattleResult {
  report: BattleReport
  /** Les troupes de l'armée encore debout. */
  survivors: Army
  /** Les monstres encore debout. */
  monstersLeft: Monsters
}

/**
 * Une bataille entre une armée et des monstres, à l'instant `at`. Les recherches renforcent
 * l'armée ; une armée affamée se bat moins bien. `loot` est ce que rapporte la victoire.
 */
function battle(
  state: GameState,
  expedition: Expedition,
  foe: Foe,
  monsters: Monsters,
  loot: Partial<Resources>,
  at: number,
  ambush: boolean,
): BattleResult {
  const defenders = (Object.entries(monsters) as [MonsterId, number][]).filter(([, count]) => count > 0)
  const starving = isStarving(state)
  const attackFactor = (1 + techBonus(state, 'attack')) * (starving ? 1 - STARVATION_ATTACK_MALUS : 1)
  const healthFactor = 1 + techBonus(state, 'health')
  const attackerStacks: Stack[] = UNIT_IDS.map((id) => {
    const unit = getUnit(id)
    return {
      family: id,
      attack: unit.attack * attackFactor,
      health: unit.health * healthFactor,
      count: expedition.troops[id],
    }
  })
  const defenderStacks: Stack[] = defenders.map(([id, count]) => {
    const monster = getMonster(id)
    return { family: monster.family, attack: monster.attack, health: monster.health, count }
  })
  const outcome = fight(attackerStacks, defenderStacks)

  const survivors = emptyArmy()
  const lost = emptyArmy()
  UNIT_IDS.forEach((id, i) => {
    survivors[id] = outcome.attackers[i]
    lost[id] = expedition.troops[id] - outcome.attackers[i]
  })
  const monstersLeft: Monsters = {}
  const enemyLost: Monsters = {}
  defenders.forEach(([id, count], i) => {
    monstersLeft[id] = outcome.defenders[i]
    enemyLost[id] = count - outcome.defenders[i]
  })

  // Le journal : les pertes de chaque manche, par différence avec la manche précédente.
  let before = { attackers: UNIT_IDS.map((id) => expedition.troops[id]), defenders: defenders.map(([, n]) => n) }
  const rounds: BattleRound[] = outcome.log.map((entry) => {
    const roundLost = emptyArmy()
    UNIT_IDS.forEach((id, i) => {
      roundLost[id] = before.attackers[i] - entry.attackers[i]
    })
    const roundEnemyLost: Monsters = {}
    defenders.forEach(([id], i) => {
      roundEnemyLost[id] = before.defenders[i] - entry.defenders[i]
    })
    before = entry
    return {
      dealt: Math.round(entry.damageByAttackers),
      taken: Math.round(entry.damageByDefenders),
      lost: roundLost,
      enemyLost: roundEnemyLost,
    }
  })

  const victory = outcome.winner === 'attacker'
  const report: BattleReport = {
    at,
    army: expedition.id,
    foe,
    ambush,
    victory,
    sent: { ...expedition.troops },
    lost,
    enemies: Object.fromEntries(defenders),
    enemyLost,
    loot: victory ? { ...loot } : {},
    starving,
    rounds,
  }
  return { report, survivors, monstersLeft }
}

function withReport(state: GameState, report: BattleReport): GameState {
  return { ...state, reports: [report, ...state.reports].slice(0, MAX_REPORTS) }
}

function updateExpedition(state: GameState, expedition: Expedition): GameState {
  return { ...state, expeditions: state.expeditions.map((e) => (e.id === expedition.id ? expedition : e)) }
}

function removeExpedition(state: GameState, id: number): GameState {
  return { ...state, expeditions: state.expeditions.filter((e) => e.id !== id) }
}

function mergeLoot(a: Partial<Resources>, b: Partial<Resources>): Partial<Resources> {
  const total: Partial<Resources> = { ...a }
  for (const id of RESOURCE_IDS) if (b[id]) total[id] = (total[id] ?? 0) + (b[id] ?? 0)
  return total
}

/** L'armée arrive à sa cible : la bataille a lieu, puis les survivants rentrent avec le butin. */
function resolveArrival(state: GameState, id: number): GameState {
  const expedition = state.expeditions.find((e) => e.id === id)
  if (!expedition) return state
  const at = expedition.arrivesAt
  const target = expedition.target
  let next = state
  let result: BattleResult
  if (target.type === 'camp') {
    const camp = getCamp(target.camp)
    result = battle(state, expedition, expedition.foe, camp.defenders, camp.loot, at, false)
  } else {
    const band = getBand(state, target.band)
    // La bande a été vaincue entre-temps : l'armée trouve la place vide, et rentre.
    if (!band) return updateExpedition(state, { ...expedition, returning: true })
    result = battle(state, expedition, expedition.foe, band.monsters, bandLoot(band.kind, band.level), at, false)
    next = afterBandBattle(next, band.id, result.monstersLeft, at)
  }
  next = withReport(next, result.report)
  // Une armée entièrement détruite ne rentre pas : l'expédition s'arrête là.
  if (armySize(result.survivors) === 0) return removeExpedition(next, id)
  return updateExpedition(next, {
    ...expedition,
    troops: result.survivors,
    loot: mergeLoot(expedition.loot, result.report.loot),
    returning: true,
    fought: target.type === 'band' ? [...expedition.fought, target.band] : expedition.fought,
  })
}

/**
 * L'armée entre dans la zone d'aggro d'une bande : la bande l'attaque sur place.
 * Victorieuse, l'armée poursuit sa route. Sinon, elle est anéantie, ou elle fait demi-tour.
 */
function resolveAmbush(state: GameState, id: number, bandId: number, at: number): GameState {
  const expedition = state.expeditions.find((e) => e.id === id)
  const band = getBand(state, bandId)
  if (!expedition || !band) return state
  const foe: Foe = { type: 'band', kind: band.kind, level: band.level }
  const result = battle(state, expedition, foe, band.monsters, bandLoot(band.kind, band.level), at, true)
  const next = withReport(afterBandBattle(state, band.id, result.monstersLeft, at), result.report)
  if (armySize(result.survivors) === 0) return removeExpedition(next, id)

  const continued: Expedition = {
    ...expedition,
    troops: result.survivors,
    loot: mergeLoot(expedition.loot, result.report.loot),
    fought: [...expedition.fought, band.id],
  }
  // Repoussée à l'aller, l'armée fait demi-tour vers la cité, aussi vite qu'elle est venue.
  if (!result.report.victory && !expedition.returning) {
    return updateExpedition(next, {
      ...continued,
      destination: expeditionPosition(expedition, at),
      arrivesAt: at,
      returnsAt: at + (at - expedition.departedAt),
      returning: true,
    })
  }
  return updateExpedition(next, continued)
}

/** L'armée rentre : les survivants retrouvent la cité, avec le butin. */
function resolveReturn(state: GameState, id: number): GameState {
  const expedition = state.expeditions.find((e) => e.id === id)
  if (!expedition) return state
  const troops = { ...state.troops }
  for (const unit of UNIT_IDS) troops[unit] += expedition.troops[unit]
  return {
    ...removeExpedition(state, id),
    troops,
    resources: addResources(state.resources, expedition.loot),
  }
}

/** La prochaine embuscade sur le trajet en cours d'une armée : la première zone d'aggro où elle entrera. */
function nextAmbush(state: GameState, expedition: Expedition): { at: number; band: number } | null {
  const leg = currentLeg(expedition)
  let first: { at: number; band: number } | null = null
  for (const band of state.bands) {
    if (expedition.fought.includes(band.id)) continue
    // La bande visée, elle, se bat à l'arrivée de l'armée.
    const targeted = expedition.target.type === 'band' && expedition.target.band === band.id
    if (targeted && !expedition.returning) continue
    const entry = circleEntry(leg.from, leg.to, band.position, aggroRadius(band.level))
    if (entry === null) continue
    const at = Math.max(state.updatedAt, leg.start + entry * (leg.end - leg.start))
    if (!first || at < first.at) first = { at, band: band.id }
  }
  return first
}

/** Les bandes dont l'armée traversera la zone d'aggro en allant vers sa cible, dans l'ordre du trajet. */
export function bandsOnPath(state: GameState, target: Target): Band[] {
  const destination = targetPosition(state, target)
  if (!destination) return []
  return state.bands
    .filter((band) => !(target.type === 'band' && target.band === band.id))
    .map((band) => ({ band, entry: circleEntry(WORLD.city, destination, band.position, aggroRadius(band.level)) }))
    .filter((crossing): crossing is { band: Band; entry: number } => crossing.entry !== null)
    .sort((a, b) => a.entry - b.entry)
    .map((crossing) => crossing.band)
}

// --- Les bandes de monstres ---

/** Le niveau d'une bande installée à cet endroit, d'après sa distance à la cité (sans le niveau de plus tiré au sort). */
export function bandLevelAt(point: Point): number {
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

/**
 * Une nouvelle bande s'installe sur un endroit libre, tiré au sort. Son niveau dépend de sa distance
 * à la cité (parfois un de plus), et sa sorte est tirée parmi celles de ce niveau. Un endroit est
 * libre s'il n'a pas déjà sa bande, et si sa zone d'aggro ne touche le chemin d'aucune armée en
 * campagne : une bande ne surgit jamais sous le nez d'une armée.
 */
function spawnBand(state: GameState, at: number): GameState {
  const free = BAND_SPOTS.filter((spot) => {
    if (state.bands.some((band) => distance(band.position, spot) < 1)) return false
    const radius = aggroRadius(Math.min(MAX_BAND_LEVEL, bandLevelAt(spot) + 1))
    return state.expeditions.every((e) => distanceToSegment(spot, WORLD.city, e.destination) > radius)
  })
  let next = state
  if (free.length > 0 && state.bands.length < MAX_BANDS) {
    let seed = state.seed
    const draw = () => {
      const result = random(seed)
      seed = result.seed
      return result.value
    }
    const spot = free[Math.floor(draw() * free.length)]
    const level = Math.min(MAX_BAND_LEVEL, bandLevelAt(spot) + (draw() < BAND_LEVEL_UP_CHANCE ? 1 : 0))
    const kinds = BAND_KINDS.filter((kind) => kind.minLevel <= level)
    const kind = kinds[Math.floor(draw() * kinds.length)].id
    const band: Band = { id: state.nextId, kind, level, position: { ...spot }, monsters: bandMonsters(kind, level) }
    next = { ...state, bands: [...state.bands, band], seed, nextId: state.nextId + 1 }
  }
  // Tant qu'il reste de la place, une autre bande viendra plus tard.
  return { ...next, nextBandAt: next.bands.length < MAX_BANDS ? at + BAND_SPAWN_SECONDS * SECOND : null }
}

/** Une bande vaincue disparaît. Si la carte était pleine, une autre bande viendra prendre sa place. */
function removeBand(state: GameState, id: number, at: number): GameState {
  return {
    ...state,
    bands: state.bands.filter((band) => band.id !== id),
    nextBandAt: state.nextBandAt ?? at + BAND_SPAWN_SECONDS * SECOND,
  }
}

/** Après une bataille, une bande garde ses survivants ; vaincue, elle disparaît. */
function afterBandBattle(state: GameState, id: number, monstersLeft: Monsters, at: number): GameState {
  if (Object.values(monstersLeft).every((count) => !count)) return removeBand(state, id, at)
  return { ...state, bands: state.bands.map((band) => (band.id === id ? { ...band, monsters: monstersLeft } : band)) }
}

// --- La carte : distances et trajets en ligne droite ---

export function distance(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y)
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

/**
 * À quel moment du chemin de `from` à `to` entre-t-on dans le cercle (`center`, `radius`) ?
 * Renvoie la fraction du chemin (0 au départ, 1 à l'arrivée), ou null si le chemin ne le touche pas.
 */
function circleEntry(from: Point, to: Point, center: Point, radius: number): number | null {
  const dx = to.x - from.x
  const dy = to.y - from.y
  const fx = from.x - center.x
  const fy = from.y - center.y
  const c = fx * fx + fy * fy - radius * radius
  // Déjà dans le cercle au départ.
  if (c <= 0) return 0
  const a = dx * dx + dy * dy
  const b = 2 * (fx * dx + fy * dy)
  const discriminant = b * b - 4 * a * c
  if (a === 0 || discriminant < 0) return null
  const t = (-b - Math.sqrt(discriminant)) / (2 * a)
  return t >= 0 && t <= 1 ? t : null
}

// --- Renvoi de troupes ---

export function checkDismiss(state: GameState, troops: Army): Check {
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
 * Le prochain événement prévu : fin de chantier, de recherche ou d'entraînement, apparition d'une
 * bande, embuscade, arrivée ou retour d'une armée.
 */
function nextEvent(state: GameState): PendingEvent | null {
  const { construction, research, trainings, expeditions, nextBandAt } = state
  const events: PendingEvent[] = []
  if (construction) {
    events.push({
      at: construction.endsAt,
      apply: (s) => ({
        ...s,
        levels: { ...s.levels, [construction.building]: construction.targetLevel },
        construction: null,
      }),
    })
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
  for (const expedition of expeditions) {
    // Une embuscade en chemin passe avant l'arrivée ou le retour, même à la même heure.
    const ambush = nextAmbush(state, expedition)
    if (ambush) events.push({ at: ambush.at, apply: (s) => resolveAmbush(s, expedition.id, ambush.band, ambush.at) })
    if (expedition.returning) events.push({ at: expedition.returnsAt, apply: (s) => resolveReturn(s, expedition.id) })
    else events.push({ at: expedition.arrivesAt, apply: (s) => resolveArrival(s, expedition.id) })
  }
  return events.reduce<PendingEvent | null>((first, e) => (!first || e.at < first.at ? e : first), null)
}

/**
 * Fait avancer la partie jusqu'à l'instant `now` : les ressources s'accumulent, et chaque
 * événement prévu (chantier, recherche, entraînement, bataille, retour d'armée) arrive à son
 * heure, même si personne ne regardait. C'est ce qui permet au royaume de vivre hors connexion.
 */
export function advance(state: GameState, now: number): GameState {
  if (now <= state.updatedAt) return state
  let current = state
  let count = 0
  for (let event = nextEvent(current); event && event.at <= now; event = nextEvent(current)) {
    // On produit avec l'état actuel jusqu'à l'événement, puis on l'applique.
    current = event.apply(accrue(current, event.at))
    // Garde-fou : une erreur dans les règles ne doit jamais faire tourner le jeu en boucle.
    if (++count > 100_000) throw new Error('Trop d’événements à rejouer')
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
