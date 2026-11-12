// Les règles du jeu, en TypeScript pur : aucune dépendance à Vue ni au navigateur.
// Chaque fonction reçoit l'état de la partie (et l'heure) et renvoie un résultat sans rien modifier.
// Plus tard, le serveur utilisera exactement ces mêmes règles.

import { fight, type Stack } from './battle.ts'
import {
  BARRACKS_SPEED_PER_LEVEL,
  BUILDINGS,
  CAMPS,
  COST_GROWTH,
  DURATION_GROWTH,
  MAX_LEVEL,
  MAX_REPORTS,
  MONSTERS,
  PRODUCTION_GROWTH,
  RACES,
  RESOURCE_IDS,
  START_LEVELS,
  START_RESOURCES,
  STARVATION_ATTACK_MALUS,
  TECHS,
  TRAINING_BATCH_PER_LEVEL,
  UNITS,
  UNIT_IDS,
  type Army,
  type BuildingDef,
  type BuildingId,
  type CampDef,
  type CampId,
  type MonsterDef,
  type MonsterId,
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

/** Une armée partie attaquer un camp de monstres. */
export interface Expedition {
  camp: CampId
  troops: Army
  departedAt: number
  arrivesAt: number
  returnsAt: number
  /** Rempli à l'arrivée, une fois la bataille livrée : ce qui reviendra à la cité. */
  result: { survivors: Army; loot: Partial<Resources> } | null
}

/** Une manche du combat, telle que la raconte le journal. */
export interface BattleRound {
  /** Dégâts infligés par ton armée, puis par les monstres. */
  dealt: number
  taken: number
  /** Pertes de la manche, de chaque côté. */
  lost: Army
  enemyLost: Partial<Record<MonsterId, number>>
}

export interface BattleReport {
  at: number
  camp: CampId
  victory: boolean
  sent: Army
  lost: Army
  /** Les monstres présents au début de la bataille. */
  enemies: Partial<Record<MonsterId, number>>
  enemyLost: Partial<Record<MonsterId, number>>
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
  /** Armées en campagne : au plus une par camp, et pas plus que maxExpeditions(). */
  expeditions: Expedition[]
  /** Derniers rapports de bataille, du plus récent au plus ancien. */
  reports: BattleReport[]
  /** Instant jusqu'auquel les ressources ont été calculées. */
  updatedAt: number
}

/** Une action est-elle possible ? Sinon, pourquoi ? */
export type Check = { ok: true } | { ok: false; reason: string }

const SECOND = 1000
const HOUR = 60 * 60 * SECOND

export function newGame(race: RaceId, now: number): GameState {
  return {
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
    updatedAt: now,
  }
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

/** Les troupes d'une armée en campagne : celles parties, ou les survivantes sur le chemin du retour. */
function expeditionTroops(expedition: Expedition): Army {
  return expedition.result?.survivors ?? expedition.troops
}

/** Toutes les troupes du joueur : celles de la cité et celles qui sont en campagne. */
export function allTroops(state: GameState): Army {
  const all = { ...state.troops }
  for (const expedition of state.expeditions) {
    const away = expeditionTroops(expedition)
    for (const id of UNIT_IDS) all[id] += away[id]
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

// --- Expéditions contre les monstres ---

/** Nombre d'armées qui peuvent être en campagne en même temps : 1, plus le Commandement. */
export function maxExpeditions(state: GameState): number {
  return 1 + techBonus(state, 'armies')
}

/** Durée (en millisecondes) de la marche vers un camp (le retour dure autant), Marche forcée comprise. */
export function marchDuration(state: GameState, camp: CampDef): number {
  return Math.round(camp.marchSeconds * (1 - techBonus(state, 'marchSpeed')) * SECOND)
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

/** Peut-on envoyer une armée vers ce camp, quelles que soient les troupes choisies ? */
export function checkExpeditionSlot(state: GameState, campId: CampId): Check {
  getCamp(campId)
  if (state.expeditions.some((e) => e.camp === campId)) {
    return { ok: false, reason: 'Une armée est déjà en route vers ce camp' }
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

export function checkExpedition(state: GameState, campId: CampId, troops: Army): Check {
  const slot = checkExpeditionSlot(state, campId)
  return slot.ok ? checkSelection(state, troops) : slot
}

/** Envoie une armée vers un camp : elle quitte la cité tout de suite. */
export function startExpedition(state: GameState, campId: CampId, troops: Army, now: number): GameState {
  const current = advance(state, now)
  const check = checkExpedition(current, campId, troops)
  if (!check.ok) throw new Error(check.reason)

  const march = marchDuration(current, getCamp(campId))
  const home = { ...current.troops }
  for (const id of UNIT_IDS) home[id] -= troops[id]
  const expedition: Expedition = {
    camp: campId,
    troops: { ...troops },
    departedAt: now,
    arrivesAt: now + march,
    returnsAt: now + 2 * march,
    result: null,
  }
  return { ...current, troops: home, expeditions: [...current.expeditions, expedition] }
}

/** L'armée arrive au camp : la bataille a lieu, et on écrit le rapport. */
function resolveArrival(state: GameState, expedition: Expedition): GameState {
  const camp = getCamp(expedition.camp)
  const defenders = Object.entries(camp.defenders) as [MonsterId, number][]
  // Les recherches renforcent l'armée ; une armée affamée se bat moins bien.
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
  const enemyLost: Partial<Record<MonsterId, number>> = {}
  defenders.forEach(([id, count], i) => {
    enemyLost[id] = count - outcome.defenders[i]
  })

  // Le journal : les pertes de chaque manche, par différence avec la manche précédente.
  let before = { attackers: UNIT_IDS.map((id) => expedition.troops[id]), defenders: defenders.map(([, n]) => n) }
  const rounds: BattleRound[] = outcome.log.map((entry) => {
    const roundLost = emptyArmy()
    UNIT_IDS.forEach((id, i) => {
      roundLost[id] = before.attackers[i] - entry.attackers[i]
    })
    const roundEnemyLost: Partial<Record<MonsterId, number>> = {}
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
  const loot = victory ? { ...camp.loot } : {}
  const report: BattleReport = {
    at: expedition.arrivesAt,
    camp: camp.id,
    victory,
    sent: { ...expedition.troops },
    lost,
    enemies: { ...camp.defenders },
    enemyLost,
    loot,
    starving,
    rounds,
  }
  const reports = [report, ...state.reports].slice(0, MAX_REPORTS)

  // Une armée entièrement détruite ne rentre pas : l'expédition s'arrête là.
  const expeditions =
    armySize(survivors) === 0
      ? state.expeditions.filter((e) => e.camp !== expedition.camp)
      : state.expeditions.map((e) => (e.camp === expedition.camp ? { ...e, result: { survivors, loot } } : e))
  return { ...state, reports, expeditions }
}

/** L'armée rentre : les survivants retrouvent la cité, avec le butin. */
function resolveReturn(state: GameState, expedition: Expedition): GameState {
  const result = expedition.result
  if (!result) return state
  const troops = { ...state.troops }
  for (const id of UNIT_IDS) troops[id] += result.survivors[id]
  return {
    ...state,
    troops,
    resources: addResources(state.resources, result.loot),
    expeditions: state.expeditions.filter((e) => e.camp !== expedition.camp),
  }
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
 * Le prochain événement prévu : fin de chantier, de recherche ou d'entraînement,
 * arrivée ou retour d'une armée.
 */
function nextEvent(state: GameState): PendingEvent | null {
  const { construction, research, trainings, expeditions } = state
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
  for (const expedition of expeditions) {
    if (expedition.result) events.push({ at: expedition.returnsAt, apply: (s) => resolveReturn(s, expedition) })
    else events.push({ at: expedition.arrivesAt, apply: (s) => resolveArrival(s, expedition) })
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
  for (let event = nextEvent(current); event && event.at <= now; event = nextEvent(current)) {
    // On produit avec l'état actuel jusqu'à l'événement, puis on l'applique.
    current = event.apply(accrue(current, event.at))
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
