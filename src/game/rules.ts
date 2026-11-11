// Les règles du jeu, en TypeScript pur : aucune dépendance à Vue ni au navigateur.
// Chaque fonction reçoit l'état de la partie (et l'heure) et renvoie un résultat sans rien modifier.
// Plus tard, le serveur utilisera exactement ces mêmes règles.

import {
  BUILDINGS,
  COST_GROWTH,
  DURATION_GROWTH,
  MAX_LEVEL,
  PRODUCTION_GROWTH,
  RACES,
  RESOURCE_IDS,
  START_LEVELS,
  START_RESOURCES,
  type BuildingDef,
  type BuildingId,
  type RaceDef,
  type RaceId,
  type Resources,
} from './config'

/** Un chantier en cours : quel bâtiment, vers quel niveau, et quand il se termine. */
export interface Construction {
  building: BuildingId
  targetLevel: number
  startedAt: number
  endsAt: number
}

/** Tout ce qu'il faut savoir sur une partie. Les heures sont en millisecondes (comme Date.now()). */
export interface GameState {
  race: RaceId
  resources: Resources
  levels: Record<BuildingId, number>
  construction: Construction | null
  /** Instant jusqu'auquel les ressources ont été calculées. */
  updatedAt: number
}

export type UpgradeCheck = { ok: true } | { ok: false; reason: string }

const HOUR = 60 * 60 * 1000

export function newGame(race: RaceId, now: number): GameState {
  return {
    race,
    resources: { ...START_RESOURCES },
    levels: { ...START_LEVELS },
    construction: null,
    updatedAt: now,
  }
}

export function emptyResources(): Resources {
  return Object.fromEntries(RESOURCE_IDS.map((id) => [id, 0])) as Resources
}

export function getBuilding(id: BuildingId): BuildingDef {
  const building = BUILDINGS.find((b) => b.id === id)
  if (!building) throw new Error(`Bâtiment inconnu : ${id}`)
  return building
}

export function getRace(id: RaceId): RaceDef {
  const race = RACES.find((r) => r.id === id)
  if (!race) throw new Error(`Race inconnue : ${id}`)
  return race
}

/** Production par heure d'un bâtiment à un niveau donné, bonus de race compris. */
export function buildingOutput(state: GameState, building: BuildingDef, level: number): number {
  if (!building.produces || !building.baseProductionPerHour || level <= 0) return 0
  const raceBonus = getRace(state.race).productionBonus[building.produces] ?? 0
  return building.baseProductionPerHour * PRODUCTION_GROWTH ** (level - 1) * (1 + raceBonus)
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

/** Coût pour amener un bâtiment au niveau `level`. */
export function upgradeCost(building: BuildingDef, level: number): Partial<Resources> {
  const cost: Partial<Resources> = {}
  for (const id of RESOURCE_IDS) {
    const base = building.baseCost[id]
    if (base) cost[id] = Math.round(base * COST_GROWTH ** (level - 1))
  }
  return cost
}

/** Durée (en millisecondes) pour amener un bâtiment au niveau `level`, bonus de race compris. */
export function upgradeDuration(state: GameState, building: BuildingDef, level: number): number {
  const seconds = building.baseDurationSeconds * DURATION_GROWTH ** (level - 1)
  return Math.round(seconds * (1 - getRace(state.race).constructionSpeedBonus) * 1000)
}

export function canAfford(resources: Resources, cost: Partial<Resources>): boolean {
  return RESOURCE_IDS.every((id) => resources[id] >= (cost[id] ?? 0))
}

/** Peut-on lancer l'amélioration de ce bâtiment ? Sinon, pourquoi ? */
export function checkUpgrade(state: GameState, buildingId: BuildingId): UpgradeCheck {
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
  const cost = upgradeCost(building, targetLevel)
  const resources = { ...current.resources }
  for (const id of RESOURCE_IDS) resources[id] -= cost[id] ?? 0

  return {
    ...current,
    resources,
    construction: {
      building: buildingId,
      targetLevel,
      startedAt: now,
      endsAt: now + upgradeDuration(current, building, targetLevel),
    },
  }
}

/**
 * Fait avancer la partie jusqu'à l'instant `now` : les ressources s'accumulent
 * et le chantier se termine à l'heure prévue, même si personne ne regardait.
 * C'est ce qui permet au royaume de continuer à produire hors connexion.
 */
export function advance(state: GameState, now: number): GameState {
  if (now <= state.updatedAt) return state

  let current = state
  const works = current.construction
  if (works && works.endsAt <= now) {
    // On produit au niveau actuel jusqu'à la fin du chantier…
    current = accrue(current, works.endsAt)
    // …puis le bâtiment passe au niveau supérieur.
    current = {
      ...current,
      levels: { ...current.levels, [works.building]: works.targetLevel },
      construction: null,
    }
  }
  // Le reste du temps, on produit au nouveau niveau.
  return accrue(current, now)
}

/** Ajoute la production gagnée entre `state.updatedAt` et `until`. */
function accrue(state: GameState, until: number): GameState {
  const hours = Math.max(0, until - state.updatedAt) / HOUR
  const rates = productionPerHour(state)
  const resources = { ...state.resources }
  for (const id of RESOURCE_IDS) resources[id] += rates[id] * hours
  return { ...state, resources, updatedAt: Math.max(state.updatedAt, until) }
}
