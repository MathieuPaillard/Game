// Les ordres du joueur, sous une forme simple qui peut voyager jusqu'au serveur.
// Le navigateur et le serveur les appliquent avec exactement les mêmes règles.

import {
  BUILDINGS,
  CAMPS,
  HEROES,
  QUESTS,
  SPELLS,
  TECHS,
  UNIT_IDS,
  WORLD,
  type Army,
  type BuildingId,
  type HeroId,
  type SpellId,
  type TechId,
  type UnitId,
} from './config.ts'
import {
  advance,
  castSpell,
  checkCast,
  checkClaim,
  checkDismiss,
  checkHatch,
  checkHealing,
  checkMarch,
  checkOrder,
  checkRecruit,
  checkResearch,
  checkSkill,
  checkTraining,
  checkUpgrade,
  claimQuest,
  dismissTroops,
  emptyArmy,
  getHeroDef,
  hatchEgg,
  learnSkill,
  orderArmy,
  recruitHero,
  setTrial,
  startMarch,
  startHealing,
  startResearch,
  startTraining,
  startUpgrade,
  type Check,
  type GameState,
  type Target,
} from './rules.ts'

export type Action =
  | { type: 'upgrade'; building: BuildingId }
  | { type: 'research'; tech: TechId }
  | { type: 'train'; unit: UnitId; count: number }
  | { type: 'dismiss'; troops: Army }
  /** Soigner des blessés à l'hôpital. */
  | { type: 'heal'; troops: Army }
  /** Recruter un héros. */
  | { type: 'recruit'; hero: HeroId }
  /** Placer un point de compétence d'un héros. */
  | { type: 'skill'; hero: HeroId; skill: string }
  /** Recevoir la récompense d'un objectif atteint. */
  | { type: 'claim'; quest: string }
  /** Lancer un sort de la Tour des mages. */
  | { type: 'cast'; spell: SpellId }
  /** Couver l'œuf de dragon dans l'Aire du dragon. */
  | { type: 'hatch' }
  /** Une armée sort de la cité, avec un premier ordre, peut-être un héros à sa tête, et peut-être le dragon. */
  | MarchAction
  /** Un nouvel ordre pour une armée déjà dehors : aller ailleurs, attaquer, récolter, rentrer. */
  | { type: 'order'; army: number; target: Target }
  /** Activer ou couper le mode d'essai (parties sans compte : le serveur refuse cet ordre). */
  | { type: 'trial'; on: boolean }

/** Une armée sort de la cité. Sans héros ni dragon, ces champs sont absents. */
export interface MarchAction {
  type: 'march'
  target: Target
  troops: Army
  hero?: HeroId | null
  dragon?: boolean
}

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
    case 'dismiss':
      return checkDismiss(state, action.troops)
    case 'heal':
      return checkHealing(state, action.troops)
    case 'recruit':
      return checkRecruit(state, action.hero)
    case 'skill':
      return checkSkill(state, action.hero, action.skill)
    case 'claim':
      return checkClaim(state, action.quest)
    case 'cast':
      return checkCast(state, action.spell)
    case 'hatch':
      return checkHatch(state)
    case 'march':
      return checkMarch(state, action.target, action.troops, action.hero ?? null, action.dragon ?? false)
    case 'order':
      return checkOrder(state, action.army, action.target)
    case 'trial':
      return { ok: true }
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
    case 'dismiss':
      return dismissTroops(state, action.troops, now)
    case 'heal':
      return startHealing(state, action.troops, now)
    case 'recruit':
      return recruitHero(state, action.hero, now)
    case 'skill':
      return learnSkill(state, action.hero, action.skill, now)
    case 'claim':
      return claimQuest(state, action.quest, now)
    case 'cast':
      return castSpell(state, action.spell, now)
    case 'hatch':
      return hatchEgg(state, now)
    case 'march':
      return startMarch(state, action.target, action.troops, now, action.hero ?? null, action.dragon ?? false)
    case 'order':
      return orderArmy(state, action.army, action.target, now)
    case 'trial':
      return setTrial(state, action.on, now)
  }
}

// --- Vérifier un ordre venu de l'extérieur ---

const BUILDING_IDS = BUILDINGS.map((building) => building.id)
const TECH_IDS = TECHS.map((tech) => tech.id)
const CAMP_IDS = CAMPS.map((camp) => camp.id)
const HERO_IDS = HEROES.map((hero) => hero.id)
const QUEST_IDS = QUESTS.map((quest) => quest.id)
const SPELL_IDS = SPELLS.map((spell) => spell.id)
/** Bien plus que ce qu'une armée peut compter : écarte seulement les nombres absurdes. */
const MAX_COUNT = 1_000_000_000

/**
 * Le serveur ne fait pas confiance aux ordres qu'il reçoit : n'importe qui peut lui envoyer
 * n'importe quoi. Renvoie l'ordre s'il est bien formé (des noms qui existent, des nombres
 * entiers), ou null sinon. Les règles vérifient ensuite s'il est possible. Le mode d'essai n'est
 * jamais accepté : il ne sert qu'aux parties sans compte.
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
    case 'dismiss': {
      const troops = parseArmy(input.troops)
      return troops ? { type: 'dismiss', troops } : null
    }
    case 'heal': {
      const troops = parseArmy(input.troops)
      return troops ? { type: 'heal', troops } : null
    }
    case 'recruit':
      return isOneOf(input.hero, HERO_IDS) ? { type: 'recruit', hero: input.hero } : null
    case 'claim':
      return isOneOf(input.quest, QUEST_IDS) ? { type: 'claim', quest: input.quest } : null
    case 'cast':
      return isOneOf(input.spell, SPELL_IDS) ? { type: 'cast', spell: input.spell } : null
    case 'skill': {
      if (!isOneOf(input.hero, HERO_IDS)) return null
      const skills = getHeroDef(input.hero).skills.map((skill) => skill.id)
      return isOneOf(input.skill, skills) ? { type: 'skill', hero: input.hero, skill: input.skill } : null
    }
    case 'hatch':
      return { type: 'hatch' }
    case 'march': {
      const target = parseTarget(input.target)
      const troops = parseArmy(input.troops)
      if (!target || !troops) return null
      const march: MarchAction = { type: 'march', target, troops }
      // Le héros est facultatif : absent ou null, l'armée part sans héros.
      if (input.hero !== undefined && input.hero !== null) {
        if (!isOneOf(input.hero, HERO_IDS)) return null
        march.hero = input.hero
      }
      // Le dragon aussi : absent ou false, il reste dans son aire.
      if (input.dragon !== undefined && input.dragon !== false) {
        if (input.dragon !== true) return null
        march.dragon = true
      }
      return march
    }
    case 'order': {
      const target = parseTarget(input.target)
      return isCount(input.army) && target ? { type: 'order', army: input.army, target } : null
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

/** Un nombre de la carte : entre 0 et `max`. */
function isCoordinate(value: unknown, max: number): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= max
}

/**
 * Une cible : un endroit de la carte, un camp qui existe, une bande ou un gisement désignés par
 * leur numéro (les règles vérifient qu'ils sont là), ou la cité.
 */
function parseTarget(value: unknown): Target | null {
  if (!isRecord(value)) return null
  switch (value.type) {
    case 'point':
      return isCoordinate(value.x, WORLD.width) && isCoordinate(value.y, WORLD.height)
        ? { type: 'point', x: value.x, y: value.y }
        : null
    case 'camp':
      return isOneOf(value.camp, CAMP_IDS) ? { type: 'camp', camp: value.camp } : null
    case 'band':
      return isCount(value.band) ? { type: 'band', band: value.band } : null
    case 'node':
      return isCount(value.node) ? { type: 'node', node: value.node } : null
    case 'city':
      return { type: 'city' }
    default:
      return null
  }
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
