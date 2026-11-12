// Les ordres du joueur, sous une forme simple qui peut voyager jusqu'au serveur.
// Le navigateur et le serveur les appliquent avec exactement les mêmes règles.

import {
  BUILDINGS,
  CAMPS,
  TECHS,
  UNIT_IDS,
  type Army,
  type BuildingId,
  type CampId,
  type TechId,
  type UnitId,
} from './config.ts'
import {
  advance,
  checkDismiss,
  checkExpedition,
  checkResearch,
  checkTraining,
  checkUpgrade,
  dismissTroops,
  emptyArmy,
  startExpedition,
  startResearch,
  startTraining,
  startUpgrade,
  type Check,
  type GameState,
} from './rules.ts'

export type Action =
  | { type: 'upgrade'; building: BuildingId }
  | { type: 'research'; tech: TechId }
  | { type: 'train'; unit: UnitId; count: number }
  | { type: 'attack'; camp: CampId; troops: Army }
  | { type: 'dismiss'; troops: Army }

/** La partie après un ordre, et la raison du refus si l'ordre était impossible. */
export type ActionResult = { ok: true; state: GameState } | { ok: false; reason: string; state: GameState }

/** L'ordre est-il possible dans cet état de la partie ? Sinon, pourquoi ? */
export function checkAction(state: GameState, action: Action): Check {
  switch (action.type) {
    case 'upgrade':
      return checkUpgrade(state, action.building)
    case 'research':
      return checkResearch(state, action.tech)
    case 'train':
      return checkTraining(state, action.unit, action.count)
    case 'attack':
      return checkExpedition(state, action.camp, action.troops)
    case 'dismiss':
      return checkDismiss(state, action.troops)
  }
}

/** Fait avancer la partie jusqu'à `now`, puis applique l'ordre s'il est possible à cet instant. */
export function performAction(state: GameState, action: Action, now: number): ActionResult {
  const current = advance(state, now)
  const check = checkAction(current, action)
  if (!check.ok) return { ok: false, reason: check.reason, state: current }
  return { ok: true, state: run(current, action, now) }
}

function run(state: GameState, action: Action, now: number): GameState {
  switch (action.type) {
    case 'upgrade':
      return startUpgrade(state, action.building, now)
    case 'research':
      return startResearch(state, action.tech, now)
    case 'train':
      return startTraining(state, action.unit, action.count, now)
    case 'attack':
      return startExpedition(state, action.camp, action.troops, now)
    case 'dismiss':
      return dismissTroops(state, action.troops, now)
  }
}

// --- Vérifier un ordre venu de l'extérieur ---

const BUILDING_IDS = BUILDINGS.map((building) => building.id)
const TECH_IDS = TECHS.map((tech) => tech.id)
const CAMP_IDS = CAMPS.map((camp) => camp.id)
/** Bien plus que ce qu'une armée peut compter : écarte seulement les nombres absurdes. */
const MAX_COUNT = 1_000_000_000

/**
 * Le serveur ne fait pas confiance aux ordres qu'il reçoit : n'importe qui peut lui envoyer
 * n'importe quoi. Renvoie l'ordre s'il est bien formé (des noms qui existent, des nombres
 * entiers), ou null sinon. Les règles vérifient ensuite s'il est possible.
 */
export function parseAction(input: unknown): Action | null {
  if (!isRecord(input)) return null
  switch (input.type) {
    case 'upgrade':
      return isOneOf(input.building, BUILDING_IDS) ? { type: 'upgrade', building: input.building } : null
    case 'research':
      return isOneOf(input.tech, TECH_IDS) ? { type: 'research', tech: input.tech } : null
    case 'train':
      return isOneOf(input.unit, UNIT_IDS) && isCount(input.count)
        ? { type: 'train', unit: input.unit, count: input.count }
        : null
    case 'attack': {
      const troops = parseArmy(input.troops)
      return isOneOf(input.camp, CAMP_IDS) && troops ? { type: 'attack', camp: input.camp, troops } : null
    }
    case 'dismiss': {
      const troops = parseArmy(input.troops)
      return troops ? { type: 'dismiss', troops } : null
    }
    default:
      return null
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isOneOf<T extends string>(value: unknown, allowed: readonly T[]): value is T {
  return typeof value === 'string' && (allowed as readonly string[]).includes(value)
}

function isCount(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= MAX_COUNT
}

/** Une armée : un nombre entier par type de troupe (0 s'il manque), et rien d'autre. */
function parseArmy(value: unknown): Army | null {
  if (!isRecord(value)) return null
  if (Object.keys(value).some((key) => !isOneOf(key, UNIT_IDS))) return null
  const army = emptyArmy()
  for (const id of UNIT_IDS) {
    const count = value[id] ?? 0
    if (!isCount(count)) return null
    army[id] = count
  }
  return army
}
