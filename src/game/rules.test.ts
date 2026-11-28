import { describe, expect, it } from 'vitest'
import { isStrongAgainst } from './battle.ts'
import { insideAny } from './terrain.ts'
import {
  BUILDINGS,
  DRAGON_BREATH_EVERY,
  DRAGON_BREATH_TARGETS,
  DRAGON_NATURES,
  TECHS,
  type Resources,
  BAND_KINDS,
  BAND_SPAWN_SECONDS,
  BAND_SPOTS,
  BATTLE_DAMAGE_SCALE,
  BATTLE_ROUND_SECONDS,
  COUNTER_BONUS,
  DRAGON_FAMILY,
  DRAGON_HATCH_COST,
  DRAGON_HATCH_SECONDS,
  DRAGON_MAX_LEVEL,
  DRAGON_REST_SECONDS,
  DRAGON_UPKEEP_PER_LEVEL,
  HEROES,
  HERO_MAX_LEVEL,
  MAX_BAND_LEVEL,
  MAX_BANDS,
  MAX_LEVEL,
  MAX_NODES,
  MIN_BATTLE_ROUNDS,
  NODE_SPAWN_SECONDS,
  NODE_SPOTS,
  PATROL_RADIUS,
  PATROL_SPEED,
  QUESTS,
  RACES,
  RAID_CASTLE_LEVEL,
  RAID_FIRST_SECONDS,
  RAID_GATES,
  RAID_INTERVAL_SECONDS,
  RAID_LOAD_PER_MONSTER,
  RAID_PLUNDER_SHARE,
  RAID_RESPITE_SECONDS,
  RAID_SPEED,
  RESOURCE_IDS,
  SECOND_CONSTRUCTION_CASTLE_LEVEL,
  HEAL_COST_SHARE,
  HEAL_TIME_SHARE,
  WOUNDED_SHARE,
  SIEGE_WAIT_SECONDS,
  SKILL_MAX_LEVEL,
  SPELLS,
  START_BANDS,
  START_LEVELS,
  START_NODES,
  START_RESOURCES,
  UNITS,
  UNIT_IDS,
  WALL_GUARDS_PER_LEVEL,
  WALL_HEALTH_PER_LEVEL,
  WORLD,
  type Army,
  type BandKindId,
  type BuildingId,
  type CampId,
  type DragonNature,
  type HeroId,
  type MonsterId,
  type Point,
  type QuestDef,
  type ResourceId,
  type TechId,
  CAMP_RESPAWN_SECONDS,
  TRIAL_BOOST,
  ENCAMPMENT,
  MOUNTAINS,
  ENCAMPMENT_BANDS,
  ENCAMPMENT_GATE_FRONT,
  ENCAMPMENT_TRAPS,
  CHASE_LEASH,
  CHASE_SPEED,
  ENCIRCLED_ATTACK_MALUS,
  MAX_ATTACKERS,
  REAR_ATTACK_BONUS,
  SIDE_ATTACK_BONUS,
  TRAP_DAMAGE,
  WATCH_RADIUS,
} from './config.ts'
import {
  advance,
  aggroRadius,
  allySurvivors,
  armySize,
  bandLoot,
  bandMonsters,
  bandPosition,
  bandsNearPath,
  campEmptyUntil,
  fighterHealth,
  carryCapacity,
  castSpell,
  checkCast,
  checkClaim,
  checkCost,
  checkDismiss,
  checkDragon,
  checkHatch,
  checkHealing,
  checkMarch,
  checkMarchSlot,
  checkOrder,
  checkRecruit,
  checkResearch,
  checkSkill,
  checkTraining,
  checkUpgrade,
  claimQuest,
  currentQuest,
  dismissTroops,
  distance,
  dragonArmy,
  dragonAttack,
  dragonHealth,
  dragonLevel,
  dragonMaxHealth,
  dragonXpForLevel,
  emptyArmy,
  emptyResources,
  emptyTechs,
  freeBeds,
  hospitalBeds,
  startHealing,
  netPerHour,
  storageCapacity,
  gainXp,
  gatherRate,
  getBandKind,
  getBuilding,
  getCamp,
  getHero,
  getHeroDef,
  getMonster,
  getRace,
  getSpell,
  getTech,
  getUnit,
  hatchEgg,
  heroArmy,
  isStarving,
  learnSkill,
  levelAt,
  loadSize,
  marchDuration,
  marchSpeed,
  maxArmies,
  maxConstructions,
  maxTrainingBatch,
  newGame,
  nodeAmount,
  orderArmy,
  patrolDistance,
  patrolLoop,
  productionPerHour,
  protectedAmount,
  questDone,
  questProgress,
  raidArrival,
  raidLevel,
  raidLoot,
  raidMonsters,
  recruitHero,
  researchCost,
  routeBetween,
  canChase,
  sightRadius,
  watchtower,
  siegeOf,
  skillPoints,
  startMarch,
  startResearch,
  startTraining,
  startUpgrade,
  trainingCost,
  trainingDuration,
  upgradeCost,
  upgradeDuration,
  upkeepPerHour,
  wallGuards,
  xpToNextLevel,
  type Band,
  type GameState,
  type Hero,
  type Monsters,
  type ResourceNode,
  type Target,
} from './rules.ts'

const HOUR = 60 * 60 * 1000
const T0 = Date.UTC(2026, 0, 1)
const CITY_TARGET: Target = { type: 'city' }

/**
 * Une partie aux ressources illimitées, sans bandes ni gisements sur la carte (ni à venir) :
 * pour tester les règles sans dépendre de l'équilibrage ni du hasard.
 */
/** Un Entrepôt démesuré : des réserves sans limite, pour les tests qui ne portent pas sur elle. */
const ROOMY = 100

function roomy(game: GameState): GameState {
  return { ...game, levels: { ...game.levels, warehouse: ROOMY } }
}

function richGame(levels: Partial<Record<BuildingId, number>> = {}, troops: Partial<Army> = {}): GameState {
  const game = newGame('humans', T0)
  const resources = emptyResources()
  for (const id of RESOURCE_IDS) resources[id] = 1e9
  return {
    ...game,
    resources,
    levels: { ...game.levels, warehouse: ROOMY, ...levels },
    troops: { ...game.troops, ...troops },
    bands: [],
    nextBandAt: null,
    nodes: [],
    nextNodeAt: null,
    // Sans grand campement : ses bandes ne viennent pas gêner les tests (withEncampment le remet).
    encampment: { resetAt: null, gateOpen: false, sprung: [] },
  }
}

function army(troops: Partial<Army>): Army {
  return { ...emptyArmy(), ...troops }
}

/** Les bandes de la carte, sans celles du grand campement. */
function patrols(game: GameState): Band[] {
  return game.bands.filter((band) => !band.encampment)
}

/** La même partie, avec certaines recherches déjà faites. */
function withTechs(game: GameState, techs: Partial<Record<TechId, number>>): GameState {
  return { ...game, techs: { ...game.techs, ...techs } }
}

/** Une partie qui démarre avec une quantité de nourriture et une armée données (et une carte vide). */
function withFood(food: number, troops: Partial<Army>): GameState {
  const game = newGame('humans', T0)
  return {
    ...game,
    resources: { ...game.resources, food },
    troops: army(troops),
    bands: [],
    nextBandAt: null,
    nodes: [],
    nextNodeAt: null,
    // Sans grand campement : ses bandes ne viennent pas gêner les tests (withEncampment le remet).
    encampment: { resetAt: null, gateOpen: false, sprung: [] },
  }
}

const toCamp = (camp: CampId): Target => ({ type: 'camp', camp })
const toBand = (band: number): Target => ({ type: 'band', band })
const toNode = (node: number): Target => ({ type: 'node', node })
const toPoint = (point: Point): Target => ({ type: 'point', x: point.x, y: point.y })

/** Installe une bande de monstres choisis. Au départ, elle est sur sa ronde, juste au nord de son repaire. */
function withBand(
  game: GameState,
  home: Point,
  monsters: Monsters,
  level = 1,
  kind: BandKindId = 'wolves',
): { game: GameState; id: number } {
  const band: Band = {
    id: game.nextId,
    kind,
    level,
    home,
    monsters,
    phase: 0,
    since: game.updatedAt,
    direction: 1,
    raid: false,
    encampment: false,
    still: false,
    chase: null,
  }
  return { game: { ...game, bands: [...game.bands, band], nextId: game.nextId + 1 }, id: band.id }
}

/**
 * Lance un raid de monstres choisis vers la cité, depuis le bord de la carte. `left` : la distance
 * qu'il lui reste à parcourir (par défaut, tout le chemin).
 */
function withRaid(
  game: GameState,
  monsters: Monsters,
  left?: number,
  level = 1,
  kind: BandKindId = 'wolves',
): { game: GameState; id: number } {
  const home = RAID_GATES[0]
  const band: Band = {
    id: game.nextId,
    kind,
    level,
    home,
    monsters,
    phase: left === undefined ? 0 : distance(home, WORLD.city) - left,
    since: game.updatedAt,
    direction: 1,
    raid: true,
    encampment: false,
    still: false,
    chase: null,
  }
  return { game: { ...game, bands: [...game.bands, band], nextId: game.nextId + 1 }, id: band.id }
}

/** Donne à la partie un dragon de ce niveau et de cette nature, et l'aire qu'il lui faut (sans dépendre de ses combats). */
function withDragon(game: GameState, level = 1, nature: DragonNature = 'storm'): GameState {
  return {
    ...game,
    levels: { ...game.levels, dragonRoost: Math.max(game.levels.dragonRoost, level) },
    dragon: { stage: 'grown', hatchAt: null, xp: dragonXpForLevel(level), restUntil: null, nature },
  }
}

/** Recrute un héros, avec ses compétences déjà apprises (sans dépendre de son expérience). */
function withHero(game: GameState, id: HeroId, skills: Record<string, number> = {}): GameState {
  const hero: Hero = { id, level: HERO_MAX_LEVEL, xp: 0, skills }
  return { ...game, heroes: [...game.heroes.filter((h) => h.id !== id), hero] }
}

/** Installe un gisement. */
function withNode(
  game: GameState,
  position: Point,
  resource: ResourceId,
  remaining: number,
): { game: GameState; id: number } {
  const node: ResourceNode = { id: game.nextId, resource, level: 1, position, remaining }
  return { game: { ...game, nodes: [...game.nodes, node], nextId: game.nextId + 1 }, id: node.id }
}

/**
 * Les deux parties sont les mêmes : tout est égal, sauf les ressources, des sommes de petits bouts dont
 * les tout derniers chiffres dépendent de l'ordre des additions (on les compare à un millième de
 * milliardième près, ce qui compte avec les réserves immenses des parties de test).
 */
function expectSameGame(a: GameState, b: GameState) {
  expect({ ...a, resources: null }).toEqual({ ...b, resources: null })
  for (const id of RESOURCE_IDS) {
    expect(Math.abs(a.resources[id] - b.resources[id])).toBeLessThanOrEqual(1e-12 * Math.max(1, Math.abs(b.resources[id])))
  }
}

/** Le premier combattant de ton camp dans la première mêlée (une armée, ou la cité), et le premier monstre. */
function allyIn(game: GameState) {
  return game.battles[0]?.allies[0]
}

function foeIn(game: GameState) {
  return game.battles[0]?.foes[0]
}

/** Pose la première armée dehors à cet endroit, sans ordre : pour ne pas dépendre du chemin depuis la cité. */
function placeArmy(game: GameState, position: Point): GameState {
  return { ...game, armies: [{ ...game.armies[0], position, order: null, status: 'idle' }, ...game.armies.slice(1)] }
}

/** Le point situé à la fraction `t` de la route qui va de la cité jusqu'à `to`. */
function onRoad(to: Point, t: number): Point {
  const city = WORLD.city
  return { x: city.x + (to.x - city.x) * t, y: city.y + (to.y - city.y) * t }
}

/** Un endroit à `dx` unités à l'est de la cité (à l'ouest si `dx` est négatif). */
function nearCity(dx: number): Point {
  return { x: WORLD.city.x + dx, y: WORLD.city.y }
}

function total(monsters: Monsters): number {
  return Object.values(monsters).reduce((sum, count) => sum + (count ?? 0), 0)
}

/** Fait avancer la partie seconde par seconde, jusqu'à ce que `done` soit vrai (au plus une heure). */
function runUntil(game: GameState, done: (state: GameState) => boolean, limit = HOUR): GameState {
  let state = game
  for (let t = game.updatedAt + 1000; t <= game.updatedAt + limit; t += 1000) {
    state = advance(state, t)
    if (done(state)) return state
  }
  throw new Error('Il ne s’est rien passé')
}

describe('production', () => {
  it('accumule les ressources avec le temps', () => {
    const game = roomy(newGame('humans', T0))
    const later = advance(game, T0 + HOUR)
    expect(later.resources.food).toBeCloseTo(START_RESOURCES.food + productionPerHour(game).food)
  })

  it('applique le bonus de race', () => {
    const orcs = productionPerHour(newGame('orcs', T0))
    const humans = productionPerHour(newGame('humans', T0))
    const bonus = getRace('orcs').productionBonus.food ?? 0
    expect(orcs.food).toBeCloseTo(humans.food * (1 + bonus))
  })

  it('donne le même résultat d’un coup ou seconde par seconde (la partie continue hors ligne)', () => {
    const base = newGame('humans', T0)
    const game: GameState = {
      ...base,
      resources: { food: 9000, wood: 9000, stone: 9000, gold: 3000, mana: 900 },
      levels: { ...START_LEVELS, castle: 5, barracks: 1, academy: 1, mageTower: 1 },
      techs: { ...base.techs, command: 2 },
      troops: army({ warrior: 95 }),
    }
    let start = startUpgrade(game, 'farm', T0)
    start = startResearch(start, 'agriculture', T0)
    start = startTraining(start, 'warrior', 5, T0)
    // Un sort, qui s'arrête en cours de route.
    start = castSpell(start, 'harvest', T0)
    // Deux héros, avec une compétence chacun.
    start = learnSkill(recruitHero(start, 'ysolde', T0), 'ysolde', 'rally', T0)
    start = learnSkill(recruitHero(start, 'durgan', T0), 'durgan', 'pickaxes', T0)
    // Trois armées dehors : vers un camp, vers un gisement, et contre une bande.
    start = startMarch(start, toCamp('wolfDen'), army({ warrior: 30 }), T0, 'ysolde')
    start = startMarch(start, toNode(start.nodes[0].id), army({ warrior: 30 }), T0, 'durgan')
    start = startMarch(start, toBand(start.bands[0].id), army({ warrior: 35 }), T0)
    const end = T0 + 3 * HOUR

    const oneShot = advance(start, end)
    let stepped = start
    for (let t = T0; t <= end; t += 1000) stepped = advance(stepped, t)

    expect(oneShot.techs.agriculture).toBe(1)
    expect(oneShot.reports.length).toBeGreaterThanOrEqual(1)
    expect(patrols(oneShot)).toHaveLength(MAX_BANDS)
    expect(stepped.levels).toEqual(oneShot.levels)
    expect(stepped.techs).toEqual(oneShot.techs)
    expect(stepped.troops).toEqual(oneShot.troops)
    expect(stepped.reports).toEqual(oneShot.reports)
    expect(stepped.armies).toEqual(oneShot.armies)
    expect(stepped.bands).toEqual(oneShot.bands)
    expect(stepped.nodes).toEqual(oneShot.nodes)
    expect(stepped.heroes).toEqual(oneShot.heroes)
    expect(stepped.stats).toEqual(oneShot.stats)
    expect(oneShot.spells).toEqual([])
    expect(oneShot.stats.victories).toBeGreaterThanOrEqual(1)
    expect(oneShot.heroes.find((hero) => hero.id === 'ysolde')?.xp).toBeGreaterThan(0)
    for (const id of RESOURCE_IDS) expect(stepped.resources[id]).toBeCloseTo(oneShot.resources[id], 6)
  })
})

describe('constructions', () => {
  it('retire le coût et ouvre le chantier', () => {
    const game = richGame({ castle: 5 })
    const farm = getBuilding('farm')
    const next = startUpgrade(game, 'farm', T0)
    const cost = upgradeCost(farm, 2)
    for (const id of RESOURCE_IDS) expect(next.resources[id]).toBe(game.resources[id] - (cost[id] ?? 0))
    expect(next.constructions).toEqual([
      {
        building: 'farm',
        targetLevel: 2,
        startedAt: T0,
        endsAt: T0 + upgradeDuration(game, farm, 2),
      },
    ])
  })

  it('les Humains construisent plus vite', () => {
    const farm = getBuilding('farm')
    expect(upgradeDuration(newGame('humans', T0), farm, 3)).toBeLessThan(
      upgradeDuration(newGame('elves', T0), farm, 3),
    )
  })

  it('termine le chantier à l’heure prévue, puis produit au nouveau niveau', () => {
    const start = startUpgrade(richGame({ castle: 5 }), 'farm', T0)
    const endsAt = start.constructions[0].endsAt
    expect(advance(start, endsAt - 1).levels.farm).toBe(1)

    const after = advance(start, endsAt + HOUR)
    expect(after.levels.farm).toBe(2)
    expect(after.constructions).toEqual([])
    const expected =
      productionPerHour(start).food * ((endsAt - T0) / HOUR) + productionPerHour(after).food
    expect(after.resources.food - start.resources.food).toBeCloseTo(expected)
  })
})

/** Une cité avec un hôpital de ce niveau (0 : sans hôpital). */
function withHospital(game: GameState, level: number): GameState {
  return { ...game, levels: { ...game.levels, hospital: level } }
}

describe('l’hôpital', () => {
  it('ses lits grandissent avec son niveau, et comptent les blessés qui attendent comme ceux en soins', () => {
    const game = { ...withHospital(richGame(), 2), wounded: army({ warrior: 10 }) }
    expect(hospitalBeds(withHospital(game, 0))).toBe(0)
    expect(hospitalBeds(withHospital(game, 3))).toBeGreaterThan(hospitalBeds(game))
    expect(freeBeds(game)).toBe(hospitalBeds(game) - 10)
    const healing = startHealing(game, army({ warrior: 4 }), T0)
    expect(freeBeds(healing)).toBe(hospitalBeds(game) - 10)
  })

  it('dehors aussi, une part des tombés d’une armée n’est que blessée : elle va à l’hôpital', () => {
    const { game, id } = withBand(withHospital(richGame({}, { warrior: 10 }), 1), nearCity(300), { troll: 200 }, 4, 'trolls')
    const lost = runUntil(startMarch(game, toBand(id), army({ warrior: 10 }), T0), (s) => s.reports.length > 0)
    const hurt = Math.ceil(10 * WOUNDED_SHARE)
    expect(lost.reports[0]).toMatchObject({ outcome: 'defeat', lost: army({ warrior: 10 }), wounded: army({ warrior: hurt }) })
    expect(lost.armies).toEqual([])
    expect(lost.wounded).toEqual(army({ warrior: hurt }))
  })

  it('quand les lits manquent, les blessés se partagent ceux qui restent : les autres meurent', () => {
    const base = withHospital(richGame({}, { warrior: 9, archer: 9 }), 1)
    const beds = hospitalBeds(base)
    const { game } = withRaid({ ...base, wounded: army({ rider: beds - 2 }) }, { troll: 500 }, RAID_SPEED, 4, 'trolls')
    const lost = runUntil(game, (s) => s.reports.length > 0)
    expect(lost.reports[0].lost).toEqual(army({ warrior: 9, archer: 9 }))
    expect(lost.reports[0].wounded).toEqual(army({ warrior: 1, archer: 1 }))
    expect(lost.wounded).toEqual(army({ rider: beds - 2, warrior: 1, archer: 1 }))
    expect(freeBeds(lost)).toBe(0)
  })

  it('soigner coûte une part de l’entraînement, prend une part de son temps, puis rend les troupes à la garnison', () => {
    expect(HEAL_COST_SHARE).toBeGreaterThan(0)
    expect(HEAL_COST_SHARE).toBeLessThan(1)
    expect(HEAL_TIME_SHARE).toBeGreaterThan(0)
    expect(HEAL_TIME_SHARE).toBeLessThan(1)
    const game = { ...withHospital(richGame({ barracks: 1 }, { warrior: 2 }), 1), wounded: army({ warrior: 10, archer: 4 }) }
    const troops = army({ warrior: 6, archer: 4 })
    expect(checkHealing(game, troops)).toEqual({ ok: true })
    const started = startHealing(game, troops, T0)
    const warrior = getUnit('warrior')
    const archer = getUnit('archer')
    for (const id of RESOURCE_IDS) {
      const training = 6 * (warrior.cost[id] ?? 0) + 4 * (archer.cost[id] ?? 0)
      expect(game.resources[id] - started.resources[id]).toBe(training > 0 ? Math.ceil(training * HEAL_COST_SHARE - 1e-9) : 0)
    }
    expect(started.wounded).toEqual(army({ warrior: 4 }))
    const duration = (trainingDuration(game, warrior, 6) + trainingDuration(game, archer, 4)) * HEAL_TIME_SHARE
    const endsAt = started.healing!.endsAt
    expect(endsAt - T0).toBe(Math.round(duration))
    expect(advance(started, endsAt - 1).troops).toEqual(army({ warrior: 2 }))
    const healed = advance(started, endsAt)
    expect(healed.healing).toBeNull()
    expect(healed.troops).toEqual(army({ warrior: 8, archer: 4 }))
  })

  it('on ne soigne que les blessés qu’on a, un groupe à la fois, et il faut l’hôpital', () => {
    const game = { ...richGame(), wounded: army({ warrior: 3 }) }
    expect(checkHealing(game, army({ warrior: 1 }))).toEqual({ ok: false, reason: 'Construis d’abord l’Hôpital' })
    const built = withHospital(game, 1)
    expect(checkHealing(built, army({}))).toEqual({ ok: false, reason: 'Choisis les blessés à soigner' })
    expect(checkHealing(built, army({ warrior: 4 }))).toEqual({ ok: false, reason: 'Tu n’as pas autant de blessés' })
    expect(checkHealing(built, army({ warrior: -1 }))).toEqual({ ok: false, reason: 'Nombre de blessés invalide' })
    const busy = startHealing(built, army({ warrior: 1 }), T0)
    expect(checkHealing(busy, army({ warrior: 1 }))).toEqual({ ok: false, reason: 'Des blessés sont déjà en soins' })
  })

  it('les blessés ne mangent pas : seules les troupes debout coûtent leur entretien', () => {
    expect(upkeepPerHour({ ...richGame(), wounded: army({ warrior: 100 }) })).toBe(upkeepPerHour(richGame()))
  })

  it('d’un coup ou seconde par seconde, les blessés et leurs soins donnent le même résultat', () => {
    const { game } = withRaid(withHospital(richGame({ barracks: 1 }, { warrior: 30 }), 1), { troll: 500 }, RAID_SPEED * 5, 4, 'trolls')
    const end = T0 + 3 * 60_000
    let step = game
    for (let t = T0 + 1000; t <= end; t += 1000) step = advance(step, t)
    const jump = advance(game, end)
    expectSameGame(jump, step)
    expect(armySize(jump.wounded)).toBeGreaterThan(0)
    const healing = startHealing(jump, jump.wounded, end)
    const later = healing.healing!.endsAt + 2000
    let stepped = healing
    for (let t = end + 1000; t <= later; t += 1000) stepped = advance(stepped, t)
    stepped = advance(stepped, later)
    expectSameGame(advance(healing, later), stepped)
    expect(stepped.wounded).toEqual(army({}))
  })
})

describe('la limite des réserves', () => {
  /** Une cité sans grand Entrepôt (sauf s'il est demandé) : la place de ses réserves compte. */
  function cramped(resources: Partial<Resources>, warehouse = 0): GameState {
    return { ...richGame({ warehouse }), resources: { ...emptyResources(), ...resources } }
  }

  it('l’Entrepôt et l’Intendance agrandissent les réserves', () => {
    const game = cramped({})
    expect(storageCapacity(cramped({}, 3))).toBeGreaterThan(storageCapacity(game))
    expect(storageCapacity(game, 3)).toBe(storageCapacity(cramped({}, 3)))
    const studied = { ...game, techs: { ...game.techs, stewardship: 2 } }
    const effect = getTech('stewardship').effect
    expect(effect.kind).toBe('storage')
    expect(storageCapacity(studied) / storageCapacity(game)).toBeCloseTo(1 + 2 * effect.perLevel, 2)
  })

  it('une réserve pleine ne grandit plus : la production s’arrête, sans rien retirer de ce qui dépasse', () => {
    const room = storageCapacity(cramped({}))
    const game = cramped({ food: room - 10, wood: room * 2, stone: 0 })
    expect(netPerHour(game).food).toBeGreaterThan(0)
    const later = advance(game, T0 + 10 * HOUR)
    expect(later.resources.food).toBe(room)
    expect(later.resources.wood).toBe(room * 2)
    expect(later.resources.stone).toBe(room)
  })

  it('l’entretien des troupes vide une réserve, même au-delà de la limite', () => {
    const room = storageCapacity(cramped({}))
    const hungry = { ...cramped({}), troops: army({ warrior: 50_000 }) }
    const net = netPerHour(hungry).food
    expect(net).toBeLessThan(0)
    const full = room * 2 - 2 * net
    const later = advance({ ...hungry, resources: { ...hungry.resources, food: full } }, T0 + HOUR)
    expect(later.resources.food).toBeCloseTo(full + net)
  })

  it('d’un coup ou seconde par seconde, la limite donne le même résultat', () => {
    const room = storageCapacity(cramped({}))
    const game = cramped({ food: room - 300, wood: room / 2 })
    const jump = advance(game, T0 + HOUR)
    let step = game
    for (let t = T0 + 1000; t <= T0 + HOUR; t += 1000) step = advance(step, t)
    expectSameGame(jump, step)
    expect(jump.resources.food).toBe(room)
  })

  it('le butin entre même au-delà de la limite : rien de ce que rapporte une armée n’est perdu', () => {
    const den = getCamp('wolfDen')
    const room = storageCapacity(cramped({}))
    const kept = RESOURCE_IDS.find((id) => id !== 'food' && (den.loot[id] ?? 0) > 0)!
    const game = { ...cramped({ food: 1e9, wood: room, stone: room, gold: room, mana: room }), troops: army({ warrior: 1000 }) }
    const won = runUntil(startMarch(game, toCamp('wolfDen'), army({ warrior: 1000 }), T0), (s) => s.reports.length > 0)
    const home = runUntil(orderArmy(won, won.armies[0].id, CITY_TARGET, won.updatedAt), (s) => s.armies.length === 0)
    expect(home.resources[kept]).toBeCloseTo(room + (den.loot[kept] ?? 0))
  })

  it('un coût plus grand que les réserves demande d’abord un plus grand Entrepôt', () => {
    expect(checkCost(emptyResources(), { stone: 500, gold: 50 }, 400)).toEqual({
      ok: false,
      reason: 'Tes réserves ne gardent que 400 de pierre : agrandis l’Entrepôt',
    })
    expect(checkCost(emptyResources(), { stone: 300 }, 400)).toEqual({ ok: false, reason: 'Il manque 300 de pierre' })
    // Des réserves qui débordent (un butin) paient quand même un coût plus grand que leur place.
    expect(checkCost({ ...emptyResources(), stone: 600 }, { stone: 500 }, 400)).toEqual({ ok: true })
    const roost = { ...cramped({}), levels: { ...cramped({}).levels, castle: MAX_LEVEL, dragonRoost: MAX_LEVEL - 1 } }
    expect(checkUpgrade(roost, 'dragonRoost')).toMatchObject({ ok: false, reason: expect.stringMatching(/agrandis l’Entrepôt$/) })
  })

  it('chaque coût tient dans les réserves qu’on peut avoir à ce moment-là : la partie ne peut pas se bloquer', () => {
    for (let castle = 1; castle <= MAX_LEVEL; castle++) {
      // Un Entrepôt au niveau du Château (il ne peut pas le dépasser), sans Intendance.
      const room = storageCapacity({ ...cramped({}), techs: emptyTechs() }, castle)
      const costs: Partial<Resources>[] = []
      for (const building of BUILDINGS) {
        if (building.unlockedAtCastleLevel > castle) continue
        const top = building.id === 'castle' ? Math.min(castle + 1, MAX_LEVEL) : castle
        for (let level = 1; level <= top; level++) costs.push(upgradeCost(building, level))
      }
      for (const tech of TECHS) {
        for (let level = 1; level <= Math.min(tech.maxLevel, castle); level++) costs.push(researchCost(tech, level))
      }
      costs.push(...SPELLS.filter((spell) => spell.towerLevel <= castle).map((spell) => spell.cost))
      costs.push(...HEROES.filter((hero) => hero.castleLevel <= castle).map((hero) => hero.cost))
      if (castle >= getBuilding('dragonRoost').unlockedAtCastleLevel) costs.push(DRAGON_HATCH_COST)
      for (const cost of costs) for (const id of RESOURCE_IDS) expect(cost[id] ?? 0).toBeLessThanOrEqual(room)
    }
  })
})

describe('conditions de construction', () => {
  it('un seul chantier à la fois au début, puis un second à partir d’un niveau du Château', () => {
    const early = SECOND_CONSTRUCTION_CASTLE_LEVEL - 1
    const busy = startUpgrade(richGame({ castle: early }), 'farm', T0)
    expect(maxConstructions(busy)).toBe(1)
    expect(checkUpgrade(busy, 'sawmill')).toEqual({ ok: false, reason: 'Un chantier est déjà en cours' })

    const later = startUpgrade(richGame({ castle: SECOND_CONSTRUCTION_CASTLE_LEVEL }), 'farm', T0)
    expect(maxConstructions(later)).toBe(2)
    expect(checkUpgrade(later, 'farm')).toEqual({ ok: false, reason: 'Ce bâtiment est déjà en chantier' })
    const both = startUpgrade(later, 'sawmill', T0)
    expect(both.constructions.map((c) => c.building)).toEqual(['farm', 'sawmill'])
    expect(checkUpgrade(both, 'quarry')).toEqual({ ok: false, reason: 'Tes 2 chantiers sont occupés' })
  })

  it('deux chantiers avancent en même temps, et chacun se termine à son heure', () => {
    const start = startUpgrade(
      startUpgrade(richGame({ castle: SECOND_CONSTRUCTION_CASTLE_LEVEL }), 'farm', T0),
      'academy',
      T0,
    )
    const [farm, academy] = start.constructions
    const first = Math.min(farm.endsAt, academy.endsAt)
    const halfway = advance(start, first)
    expect(halfway.constructions).toHaveLength(1)
    const done = advance(start, Math.max(farm.endsAt, academy.endsAt))
    expect(done.constructions).toEqual([])
    expect(done.levels).toMatchObject({ farm: farm.targetLevel, academy: academy.targetLevel })
    // Le même résultat seconde par seconde.
    let stepped = start
    for (let t = T0; t <= done.updatedAt; t += 1000) stepped = advance(stepped, t)
    expect(advance(stepped, done.updatedAt).levels).toEqual(done.levels)
  })

  it('aucun bâtiment ne dépasse le niveau du Château', () => {
    expect(checkUpgrade(richGame({ castle: 2, farm: 2 }), 'farm')).toEqual({
      ok: false,
      reason: 'Nécessite le Château niveau 3',
    })
  })

  it('le Puits de mana se débloque avec le Château', () => {
    const unlock = getBuilding('manaWell').unlockedAtCastleLevel
    expect(checkUpgrade(richGame({ castle: unlock - 1, manaWell: 0 }), 'manaWell').ok).toBe(false)
    expect(checkUpgrade(richGame({ castle: unlock, manaWell: 0 }), 'manaWell').ok).toBe(true)
  })

  it('dit quelles ressources manquent', () => {
    const game = newGame('humans', T0)
    const poor = { ...game, resources: { ...game.resources, wood: 0, gold: 0, mana: 10 } }
    const cost = { wood: 120, gold: 30, mana: 77 }
    expect(checkCost(poor.resources, cost)).toEqual({ ok: false, reason: 'Il manque 120 de bois, 30 d’or et 67 de mana' })
    expect(checkCost(game.resources, {})).toEqual({ ok: true })
  })

  it('refuse quand les ressources manquent', () => {
    const poor = { ...newGame('humans', T0), resources: emptyResources() }
    expect(checkUpgrade(poor, 'castle')).toMatchObject({ ok: false, reason: expect.stringMatching(/^Il manque \d+ /) })
  })

  it('s’arrête au niveau maximum', () => {
    expect(checkUpgrade(richGame({ castle: MAX_LEVEL }), 'castle')).toEqual({
      ok: false,
      reason: 'Niveau maximum atteint',
    })
  })
})

describe('entraînement', () => {
  it('retire le coût, puis ajoute les troupes à la fin', () => {
    const game = richGame({ castle: 5, barracks: 1 })
    const started = startTraining(game, 'warrior', 10, T0)
    const cost = trainingCost(getUnit('warrior'), 10)
    for (const id of RESOURCE_IDS) expect(started.resources[id]).toBe(game.resources[id] - (cost[id] ?? 0))

    const endsAt = started.trainings[0].endsAt
    expect(advance(started, endsAt - 1).troops.warrior).toBe(0)
    const done = advance(started, endsAt)
    expect(done.troops.warrior).toBe(10)
    expect(done.trainings).toEqual([])
  })

  it('plusieurs types de troupes s’entraînent en même temps, un entraînement par type', () => {
    let game = richGame({ castle: 5, barracks: 3 })
    game = startTraining(game, 'warrior', 10, T0)
    game = startTraining(game, 'archer', 5, T0)
    game = startTraining(game, 'mage', 2, T0)
    expect(game.trainings.map((t) => t.unit)).toEqual(['warrior', 'archer', 'mage'])
    expect(checkTraining(game, 'warrior', 1)).toEqual({
      ok: false,
      reason: 'Des Guerriers sont déjà à l’entraînement',
    })
    expect(checkTraining(game, 'rider', 1).ok).toBe(true)

    const last = Math.max(...game.trainings.map((t) => t.endsAt))
    const done = advance(game, last)
    expect(done.troops).toEqual(army({ warrior: 10, archer: 5, mage: 2 }))
    expect(done.trainings).toEqual([])
  })

  it('les Orcs entraînent plus vite', () => {
    const warrior = getUnit('warrior')
    const humans = richGame({ barracks: 1 })
    const orcs = { ...humans, race: 'orcs' as const }
    expect(trainingDuration(orcs, warrior, 10)).toBeLessThan(trainingDuration(humans, warrior, 10))
  })

  it('la Caserne débloque les troupes', () => {
    const mage = getUnit('mage')
    expect(checkTraining(richGame({ barracks: 0 }), 'warrior', 1).ok).toBe(false)
    expect(checkTraining(richGame({ barracks: mage.barracksLevel - 1 }), 'mage', 1).ok).toBe(false)
    expect(checkTraining(richGame({ barracks: mage.barracksLevel }), 'mage', 1).ok).toBe(true)
  })

  it('chaque race a sa propre troupe, que les autres races ne peuvent pas entraîner', () => {
    for (const race of RACES) {
      // Une troupe de combat, et des soigneurs.
      const own = UNITS.filter((unit) => unit.race === race.id)
      expect(own.filter((unit) => !unit.heal)).toHaveLength(1)
      expect(own.filter((unit) => unit.heal)).toHaveLength(1)
    }
    const paladin = getUnit('paladin')
    const humans = richGame({ castle: 5, barracks: paladin.barracksLevel })
    expect(checkTraining(humans, 'paladin', 1).ok).toBe(true)
    expect(checkTraining({ ...humans, race: 'elves' }, 'paladin', 1)).toEqual({
      ok: false,
      reason: 'Réservés aux Humains',
    })
    expect(checkTraining(richGame({ castle: 5, barracks: paladin.barracksLevel - 1 }), 'paladin', 1)).toEqual({
      ok: false,
      reason: `Nécessite la Caserne niveau ${paladin.barracksLevel}`,
    })
  })

  it('une troupe de race se bat avec les forces de sa famille', () => {
    // Des Paladins (de la famille des Guerriers) dominent les loups, qui se battent comme des Cavaliers.
    expect(getUnit('paladin').family).toBe('warrior')
    const firstRound = (monsters: Monsters) => {
      const { game, id } = withBand(richGame({}, { paladin: 10 }), nearCity(300), monsters)
      const start = startMarch(game, toBand(id), army({ paladin: 10 }), T0)
      // Face à mille monstres, la bataille ne dure qu'une manche : son rapport la raconte.
      return runUntil(start, (s) => s.reports.length > 0).reports[0].rounds[0]
    }
    expect(firstRound({ wolf: 1000 }).dealt / firstRound({ goblin: 1000 }).dealt).toBeCloseTo(COUNTER_BONUS)
  })

  it('limite le nombre de troupes par entraînement', () => {
    const game = richGame({ barracks: 1 })
    expect(checkTraining(game, 'warrior', maxTrainingBatch(game)).ok).toBe(true)
    expect(checkTraining(game, 'warrior', maxTrainingBatch(game) + 1).ok).toBe(false)
  })
})

describe('entretien des troupes', () => {
  it('les troupes mangent de la nourriture chaque heure', () => {
    const game = { ...roomy(newGame('humans', T0)), troops: army({ warrior: 100 }) }
    expect(upkeepPerHour(game)).toBe(100 * getUnit('warrior').upkeepPerHour)
    const later = advance(game, T0 + HOUR)
    expect(later.resources.food).toBeCloseTo(
      START_RESOURCES.food + productionPerHour(game).food - upkeepPerHour(game),
    )
  })

  it('les troupes dehors mangent aussi', () => {
    const home = richGame({}, { warrior: 50 })
    const away = startMarch(home, toCamp('wolfDen'), army({ warrior: 50 }), T0)
    expect(upkeepPerHour(away)).toBe(upkeepPerHour(home))
  })

  it('la famine ne fait perdre aucune troupe, et la nourriture ne descend jamais sous zéro', () => {
    const game = withFood(100, { warrior: 2000 })
    const later = advance(game, T0 + 3 * HOUR)
    expect(later.resources.food).toBe(0)
    expect(later.troops.warrior).toBe(2000)
  })

  it('les troupes ont faim quand les réserves sont vides et que les fermes ne suffisent plus', () => {
    expect(isStarving(withFood(0, { warrior: 2000 }))).toBe(true)
    // Des réserves restent : personne n'a encore faim.
    expect(isStarving(withFood(100, { warrior: 2000 }))).toBe(false)
    // Les fermes suffisent : pas de famine, même avec des réserves vides.
    expect(isStarving(withFood(0, { warrior: 10 }))).toBe(false)
  })

  it('une armée affamée se bat moins bien', () => {
    // Un adversaire assez fort pour que l'attaque compte à chaque manche (voir MIN_BATTLE_ROUNDS).
    const attack = (game: GameState) => {
      const start = startMarch(game, toCamp('trollLair'), army({ warrior: 60 }), T0)
      return runUntil(start, (s) => s.reports.length > 0).reports[0]
    }
    const hungry = attack(withFood(0, { warrior: 2060 }))
    const fed = attack(withFood(1e9, { warrior: 2060 }))
    expect(hungry.starving).toBe(true)
    expect(fed.starving).toBe(false)
    expect(hungry.lost.warrior).toBeGreaterThan(fed.lost.warrior)
  })

  it('une bataille affamée donne le même résultat d’un coup ou seconde par seconde', () => {
    // Les réserves s'épuisent pendant la marche : l'armée arrive affamée.
    const start = startMarch(withFood(50, { warrior: 2060 }), toCamp('goblinCamp'), army({ warrior: 60 }), T0)
    const end = T0 + 10 * 60 * 1000
    const oneShot = advance(start, end)
    let stepped = start
    for (let t = T0; t <= end; t += 1000) stepped = advance(stepped, t)
    expect(oneShot.reports[0].starving).toBe(true)
    expect(stepped.reports).toEqual(oneShot.reports)
    expect(stepped.troops).toEqual(oneShot.troops)
    expect(stepped.armies).toEqual(oneShot.armies)
  })

  it('on peut renvoyer des troupes pour réduire l’entretien', () => {
    const game = richGame({}, { warrior: 100, archer: 20 })
    const after = dismissTroops(game, army({ warrior: 40 }), T0)
    expect(after.troops).toEqual(army({ warrior: 60, archer: 20 }))
    expect(upkeepPerHour(after)).toBeLessThan(upkeepPerHour(game))
    expect(checkDismiss(game, army({ archer: 21 })).ok).toBe(false)
    expect(checkDismiss(game, army({})).ok).toBe(false)
  })
})

describe('les armées dehors', () => {
  it('une armée sort de la cité, marche jusqu’à l’endroit choisi, puis attend un ordre', () => {
    const spot = nearCity(200)
    const start = startMarch(richGame({}, { warrior: 10 }), toPoint(spot), army({ warrior: 10 }), T0)
    expect(start.troops.warrior).toBe(0)
    expect(start.armies[0]).toMatchObject({ status: 'marching', position: WORLD.city, troops: army({ warrior: 10 }) })
    const march = marchDuration(start, WORLD.city, spot)
    expect(distance(advance(start, T0 + march / 2).armies[0].position, WORLD.city)).toBeCloseTo(100)
    expect(advance(start, T0 + march + 1000).armies[0]).toMatchObject({ status: 'idle', order: null, position: spot })
  })

  it('rappelée, l’armée rentre à la cité et ses troupes retrouvent la caserne', () => {
    let game = startMarch(richGame({}, { warrior: 10 }), toPoint(nearCity(200)), army({ warrior: 10 }), T0)
    game = orderArmy(game, game.armies[0].id, CITY_TARGET, T0 + 5000)
    const home = runUntil(game, (s) => s.armies.length === 0)
    expect(home.troops.warrior).toBe(10)
  })

  it('on peut changer l’ordre d’une armée en pleine marche', () => {
    let game = startMarch(richGame({}, { warrior: 10 }), toPoint(nearCity(300)), army({ warrior: 10 }), T0)
    game = advance(game, T0 + 10_000)
    game = orderArmy(game, game.armies[0].id, toPoint(nearCity(-300)), T0 + 10_000)
    const arrived = runUntil(game, (s) => s.armies[0].status === 'idle')
    expect(arrived.armies[0].position).toEqual(nearCity(-300))
  })

  it('sans Commandement, une seule armée dehors ; le Commandement en permet davantage', () => {
    const single = startMarch(richGame({}, { warrior: 20 }), toCamp('wolfDen'), army({ warrior: 10 }), T0)
    expect(checkMarch(single, toCamp('goblinCamp'), army({ warrior: 10 }))).toEqual({
      ok: false,
      reason: 'Ton armée est déjà dehors',
    })
    let game = withTechs(richGame({}, { warrior: 90 }), { command: 2 })
    expect(maxArmies(game)).toBe(3)
    for (const camp of ['wolfDen', 'goblinCamp', 'hauntedRuins'] as const) {
      game = startMarch(game, toCamp(camp), army({ warrior: 20 }), T0)
    }
    expect(checkMarch(game, toCamp('trollLair'), army({ warrior: 10 }))).toEqual({
      ok: false,
      reason: 'Tes 3 armées sont déjà dehors',
    })
  })

  it('vérifie les troupes, les cibles et les ordres', () => {
    const game = richGame({}, { warrior: 5 })
    expect(checkMarch(game, toCamp('wolfDen'), army({ warrior: 6 })).ok).toBe(false)
    expect(checkMarch(game, toCamp('wolfDen'), army({})).ok).toBe(false)
    expect(checkMarch(game, CITY_TARGET, army({ warrior: 1 })).ok).toBe(false)
    expect(checkMarch(game, { type: 'point', x: -5, y: 10 }, army({ warrior: 1 })).ok).toBe(false)
    expect(checkMarch(game, toBand(99), army({ warrior: 1 }))).toEqual({ ok: false, reason: 'Cette bande n’est plus là' })
    expect(checkOrder(game, 99, CITY_TARGET)).toEqual({ ok: false, reason: 'Cette armée n’est plus dehors' })
  })

  it('la Marche forcée accélère les armées', () => {
    expect(marchSpeed(withTechs(richGame(), { forcedMarch: 2 }))).toBeGreaterThan(marchSpeed(richGame()))
  })

  it('une armée qui attend au calme ne coûte rien à faire avancer, même une semaine', () => {
    const start = startMarch(richGame({}, { warrior: 10 }), toPoint(nearCity(150)), army({ warrior: 10 }), T0)
    const parked = runUntil(start, (s) => s.armies[0].status === 'idle')
    const later = advance(parked, parked.updatedAt + 7 * 24 * HOUR)
    expect(later.armies).toEqual(parked.armies)
    // Aucun pas du monde n'a été nécessaire.
    expect(later.tickedAt).toBe(parked.tickedAt)
  })
})

describe('les batailles', () => {
  it('même face à une armée écrasante, une bataille dure au moins MIN_BATTLE_ROUNDS manches', () => {
    const start = startMarch(richGame({}, { warrior: 1000 }), toCamp('wolfDen'), army({ warrior: 1000 }), T0)
    const report = runUntil(start, (s) => s.reports.length > 0).reports[0]
    expect(report.outcome).toBe('victory')
    expect(report.rounds.length).toBeGreaterThanOrEqual(MIN_BATTLE_ROUNDS)
    // Les loups tombent peu à peu : jamais plus d'un dixième de la meute à chaque manche.
    const wolves = getCamp('wolfDen').defenders.wolf ?? 0
    for (const round of report.rounds) {
      expect(round.enemyLost.wolf ?? 0).toBeLessThanOrEqual(Math.ceil(wolves / MIN_BATTLE_ROUNDS))
    }
  })

  it('quand les deux camps tombent dans la même manche, la bande est vaincue, mais personne ne rapporte le butin', () => {
    const { game, id } = withBand(richGame({}, { archer: 2 }), nearCity(300), { shaman: 3 }, 1, 'goblins')
    const end = runUntil(startMarch(game, toBand(id), army({ archer: 2 }), T0), (s) => s.reports.length > 0)
    expect(end.reports[0]).toMatchObject({ outcome: 'victory', loot: {}, lost: { archer: 2 }, enemyLost: { shaman: 3 } })
    expect(end.bands).toEqual([])
    expect(end.armies).toEqual([])
    expect(end.stats).toMatchObject({ victories: 1, bandsDefeated: 1 })
  })

  it('un siège où les deux camps tombent ensemble repousse le raid', () => {
    const { game } = withRaid(richGame({ walls: 0 }, { archer: 2 }), { shaman: 3 }, RAID_SPEED, 1, 'goblins')
    const end = runUntil(advance(game, raidArrival(game.bands[0])!), (s) => s.reports.length > 0)
    expect(end.reports[0]).toMatchObject({ outcome: 'victory', lost: { archer: 2 }, siege: { plunder: {} } })
    expect(end.stats.raidsRepelled).toBe(1)
    expect(end.bands).toEqual([])
    expect(end.nextRaidAt).toBe(game.nextRaidAt)
  })

  it('un camp vaincu reste vide un moment, puis ses monstres reviennent', () => {
    const start = startMarch(richGame({}, { warrior: 200 }), toCamp('wolfDen'), army({ warrior: 100 }), T0)
    const won = runUntil(start, (s) => s.reports.length > 0)
    expect(won.reports[0].outcome).toBe('victory')
    const back = won.reports[0].at + CAMP_RESPAWN_SECONDS * 1000
    expect(campEmptyUntil(won, 'wolfDen')).toBe(back)
    const empty = { ok: false, reason: 'Ce camp est vide : ses monstres ne sont pas encore revenus' }
    expect(checkMarch(won, toCamp('wolfDen'), army({ warrior: 10 }))).toEqual(empty)
    expect(checkOrder(won, won.armies[0].id, toCamp('wolfDen'))).toEqual(empty)
    const later = advance(won, back)
    expect(campEmptyUntil(later, 'wolfDen')).toBeNull()
    // L'armée restée sur place peut l'attaquer de nouveau.
    expect(checkOrder(later, later.armies[0].id, toCamp('wolfDen'))).toEqual({ ok: true })
  })

  it('une armée qui arrive à un camp vidé entre-temps attend sur place', () => {
    const start = startMarch(richGame({}, { warrior: 50 }), toCamp('wolfDen'), army({ warrior: 50 }), T0)
    // Une autre armée l'a vidé pendant la marche.
    const emptied: GameState = { ...start, campsCleared: { wolfDen: T0 + HOUR } }
    const arrived = runUntil(emptied, (s) => s.armies[0].status === 'idle')
    expect(arrived.battles).toEqual([])
    expect(arrived.armies[0].order).toBeNull()
  })

  it('le mode d’essai rend les troupes du joueur bien plus fortes', () => {
    const firstRound = (trial: boolean) => {
      const target = withBand({ ...richGame({}, { warrior: 50 }), trial }, nearCity(300), { goblin: 2000 })
      const start = startMarch(target.game, toBand(target.id), army({ warrior: 50 }), T0)
      return allyIn(runUntil(start, (s) => (allyIn(s)?.rounds.length ?? 0) > 0))!
    }
    const normal = firstRound(false)
    const boosted = firstRound(true)
    expect(boosted.healthFactor).toBeCloseTo(normal.healthFactor * TRIAL_BOOST)
    expect(boosted.rounds[0].dealt).toBeCloseTo(normal.rounds[0].dealt * TRIAL_BOOST, -1)
  })

  it('une armée ne rapporte que le butin qu’elle peut porter', () => {
    const start = startMarch(richGame({}, { warrior: 30 }), toCamp('wolfDen'), army({ warrior: 30 }), T0)
    // Elle porte déjà presque tout ce qu'elle peut : il ne lui reste de la place que pour 200 ressources.
    const capacity = carryCapacity(start, army({ warrior: 30 }))
    const loaded = { ...start, armies: start.armies.map((a) => ({ ...a, load: { stone: capacity - 200 } })) }
    const won = runUntil(loaded, (s) => s.reports.length > 0)
    const report = won.reports[0]
    expect(report.outcome).toBe('victory')
    const taken = loadSize(report.loot)
    expect(taken).toBeGreaterThan(0)
    expect(taken).toBeLessThanOrEqual(200)
    expect(taken).toBeLessThan(loadSize(getCamp('wolfDen').loot))
    expect(loadSize(won.armies[0].load)).toBeLessThanOrEqual(carryCapacity(won, won.armies[0].troops) + 1e-9)
  })

  it('une armée qui se bat ne peut pas reprendre aussitôt le même combat', () => {
    const { game, id } = withBand(richGame({}, { warrior: 50 }), nearCity(300), { goblin: 2000 })
    const fighting = runUntil(startMarch(game, toBand(id), army({ warrior: 50 }), T0), (s) => s.battles.length > 0)
    const armyId = fighting.armies[0].id
    expect(checkOrder(fighting, armyId, toBand(id))).toEqual({ ok: false, reason: 'Ton armée combat déjà cette cible' })
    expect(checkOrder(fighting, armyId, CITY_TARGET)).toEqual({ ok: true })
  })

  it('refuse une heure qui n’est pas un nombre, plutôt que de tourner sans fin', () => {
    const game = richGame()
    const broken: GameState = { ...game, constructions: [{ building: 'farm', targetLevel: 2, startedAt: T0, endsAt: NaN }] }
    expect(() => advance(broken, T0 + 1000)).toThrow()
  })

  it('dit la vie qui reste à chaque camp', () => {
    const start = startMarch(richGame({}, { warrior: 30 }), toCamp('wolfDen'), army({ warrior: 30 }), T0)
    const fighting = runUntil(start, (s) => (allyIn(s)?.rounds.length ?? 0) === 2)
    const ally = allyIn(fighting)!
    const own = fighterHealth(ally)
    const foe = fighterHealth(foeIn(fighting)!)
    const wolves = (getCamp('wolfDen').defenders.wolf ?? 0) * getMonster('wolf').health
    expect(own.start).toBeCloseTo(30 * getUnit('warrior').health * ally.healthFactor)
    expect(foe.start).toBe(wolves)
    // Deux manches : chaque camp a perdu de la vie, jamais plus d'un dixième à chaque manche.
    expect(foe.now).toBeLessThan(wolves)
    expect(foe.now).toBeGreaterThanOrEqual(wolves * (1 - 2 / MIN_BATTLE_ROUNDS) - 1e-6)
    expect(own.now).toBeLessThan(own.start)
  })

  it('une bataille dure un moment : une manche toutes les quelques secondes', () => {
    const den = getCamp('wolfDen')
    const start = startMarch(richGame({}, { warrior: 30 }), toCamp('wolfDen'), army({ warrior: 30 }), T0)
    const fighting = runUntil(start, (s) => s.battles.length > 0)
    expect(fighting.armies[0]).toMatchObject({ status: 'fighting', position: den.position })
    const done = runUntil(fighting, (s) => s.battles.length === 0)
    const report = done.reports[0]
    expect(report.startedAt).toBe(fighting.battles[0].startedAt)
    expect(report.at - report.startedAt).toBe(report.rounds.length * BATTLE_ROUND_SECONDS * 1000)
  })

  it('victorieuse, l’armée reste sur place avec le butin, puis le rapporte à la cité', () => {
    const den = getCamp('wolfDen')
    const start = startMarch(richGame({}, { warrior: 1000 }), toCamp('wolfDen'), army({ warrior: 1000 }), T0)
    const won = runUntil(start, (s) => s.reports.length > 0)
    expect(won.reports[0]).toMatchObject({ foe: toCamp('wolfDen'), outcome: 'victory', ambush: false, loot: den.loot })
    expect(won.armies[0]).toMatchObject({ status: 'idle', order: null, position: den.position, load: den.loot })

    const home = runUntil(orderArmy(won, won.armies[0].id, CITY_TARGET, won.updatedAt), (s) => s.armies.length === 0)
    expect(home.troops.warrior).toBe(1000 - won.reports[0].lost.warrior)
    // La nourriture dépend aussi de l'entretien : on vérifie le butin sur les autres ressources.
    const hours = (home.updatedAt - start.updatedAt) / HOUR
    for (const id of RESOURCE_IDS.filter((r) => r !== 'food')) {
      const produced = productionPerHour(start)[id] * hours
      expect(home.resources[id] - start.resources[id] - produced).toBeCloseTo(den.loot[id] ?? 0)
    }
  })

  it('le journal raconte chaque manche', () => {
    const troops = army({ warrior: 20, archer: 10 })
    const start = startMarch(richGame({}, troops), toCamp('goblinCamp'), troops, T0)
    const report = runUntil(start, (s) => s.reports.length > 0).reports[0]
    expect(report.enemies).toEqual(getCamp('goblinCamp').defenders)
    expect(report.rounds.length).toBeGreaterThan(0)
    // Les pertes de chaque manche s'additionnent pour donner les pertes totales.
    for (const id of UNIT_IDS) {
      expect(report.rounds.reduce((sum, r) => sum + r.lost[id], 0)).toBe(report.lost[id])
    }
    for (const [id, lost] of Object.entries(report.enemyLost)) {
      expect(report.rounds.reduce((sum, r) => sum + (r.enemyLost[id as keyof typeof r.enemyLost] ?? 0), 0)).toBe(lost)
    }
  })

  it('une armée anéantie disparaît, sans butin', () => {
    const start = startMarch(richGame({}, { archer: 1 }), toCamp('trollLair'), army({ archer: 1 }), T0)
    const after = runUntil(start, (s) => s.reports.length > 0)
    expect(after.armies).toEqual([])
    expect(after.reports[0]).toMatchObject({ outcome: 'defeat', loot: {} })
    expect(armySize(after.troops)).toBe(0)
  })

  it('on peut battre en retraite pendant la bataille', () => {
    const { game, id } = withBand(richGame({}, { warrior: 200 }), nearCity(350), { troll: 40 }, 3, 'trolls')
    const start = startMarch(game, toBand(id), army({ warrior: 200 }), T0)
    const fighting = runUntil(start, (s) => allyIn(s)?.rounds.length === 5)
    const fled = orderArmy(fighting, fighting.armies[0].id, CITY_TARGET, fighting.updatedAt)
    expect(fled.battles).toEqual([])
    expect(fled.reports[0]).toMatchObject({ outcome: 'retreat', loot: {} })
    expect(fled.reports[0].rounds).toHaveLength(5)
    // La bande garde ses pertes ; elle avait pris l'armée en chasse, et regagne sa ronde…
    expect(total(fled.bands[0].monsters)).toBeLessThan(40)
    expect(fled.bands[0].chase?.army).toBeNull()
    const back = runUntil(fled, (s) => s.bands[0].chase === null)
    expect(back.bands[0].since).toBe(back.updatedAt)
    // … sans plus attaquer l'armée, qui rentre à la cité.
    const home = runUntil(fled, (s) => s.armies.length === 0)
    expect(home.reports).toHaveLength(1)
    expect(home.troops.warrior).toBe(200 - fled.reports[0].lost.warrior)
  })
})

describe('les bandes de monstres', () => {
  it('une nouvelle partie commence avec quelques bandes, puis la carte se remplit', () => {
    const game = newGame('humans', T0)
    expect(patrols(game)).toHaveLength(START_BANDS)
    for (const band of patrols(game)) {
      expect(BAND_SPOTS).toContainEqual(band.home)
      const base = levelAt(band.home)
      expect([base, Math.min(MAX_BAND_LEVEL, base + 1)]).toContain(band.level)
      expect(getBandKind(band.kind).minLevel).toBeLessThanOrEqual(band.level)
      expect(band.monsters).toEqual(bandMonsters(band.kind, band.level))
    }
    // Un repaire par endroit.
    expect(new Set(patrols(game).map((band) => `${band.home.x},${band.home.y}`)).size).toBe(START_BANDS)

    const full = advance(game, T0 + (MAX_BANDS - START_BANDS) * BAND_SPAWN_SECONDS * 1000)
    expect(patrols(full)).toHaveLength(MAX_BANDS)
    expect(full.nextBandAt).toBeNull()
  })

  it('les bandes et les gisements sont tirés au sort, toujours de la même façon pour une même graine', () => {
    const a = newGame('humans', T0, 7)
    const b = newGame('orcs', T0, 7)
    expect(a.bands).toEqual(b.bands)
    expect(a.nodes).toEqual(b.nodes)
    expect(newGame('humans', T0, 8).bands).not.toEqual(a.bands)
  })

  it('plus une bande est loin de la cité, plus elle est forte, et plus sa zone d’aggro est grande', () => {
    const spots = [...BAND_SPOTS].sort((a, b) => distance(WORLD.city, a) - distance(WORLD.city, b))
    expect(levelAt(spots[0])).toBe(1)
    for (let i = 1; i < spots.length; i++) expect(levelAt(spots[i])).toBeGreaterThanOrEqual(levelAt(spots[i - 1]))
    for (let level = 2; level <= MAX_BAND_LEVEL; level++) {
      expect(aggroRadius(level)).toBeGreaterThan(aggroRadius(level - 1))
      for (const kind of BAND_KINDS) {
        expect(total(bandMonsters(kind.id, level))).toBeGreaterThan(total(bandMonsters(kind.id, level - 1)))
      }
    }
  })

  it('aucune ronde ne passe assez près de la cité pour voir les armées qui en sortent', () => {
    for (const spot of BAND_SPOTS) {
      const radius = sightRadius(Math.min(MAX_BAND_LEVEL, levelAt(spot) + 1))
      expect(patrolDistance(spot, WORLD.city)).toBeGreaterThan(radius + 60)
    }
  })

  it('une bande fait des rondes autour de son repaire, et revient à son point de départ', () => {
    const home = { x: 300, y: 300 }
    const band = withBand(richGame(), home, { wolf: 3 }).game.bands[0]
    const loop = patrolLoop(home)
    const lap = loop.reduce((sum, point, i) => sum + distance(point, loop[(i + 1) % loop.length]), 0) / PATROL_SPEED
    const start = bandPosition(band, T0)
    for (const seconds of [5, 20, 40, lap / 2]) {
      const position = bandPosition(band, T0 + seconds * 1000)
      expect(distance(position, home)).toBeLessThanOrEqual(PATROL_RADIUS + 1e-9)
      expect(position).not.toEqual(start)
    }
    const back = bandPosition(band, T0 + lap * 1000)
    expect(back.x).toBeCloseTo(start.x)
    expect(back.y).toBeCloseTo(start.y)
  })

  it('une bande attaque l’armée qui entre dans sa zone d’aggro', () => {
    // L'armée va attendre sur la ronde de la bande : la bande l'attaque en passant.
    const home = nearCity(350)
    const { game } = withBand(richGame({}, { warrior: 500 }), home, { wolf: 2 })
    const start = startMarch(game, toPoint({ x: home.x, y: home.y + PATROL_RADIUS }), army({ warrior: 500 }), T0)
    const attacked = runUntil(start, (s) => s.reports.length > 0)
    expect(attacked.reports[0]).toMatchObject({
      ambush: true,
      outcome: 'victory',
      foe: { type: 'band', kind: 'wolves', level: 1 },
      loot: bandLoot('wolves', 1),
    })
    expect(attacked.bands).toEqual([])
    expect(attacked.armies[0].load).toEqual(bandLoot('wolves', 1))
  })

  it('attaquée en chemin, l’armée reprend sa route après la bataille', () => {
    // La ronde de la bande croise la route, et sa zone d'aggro (niveau 2) est plus large que la ronde.
    const { game } = withBand(richGame({}, { warrior: 500 }), nearCity(250), { wolf: 2 }, 2)
    const goal = nearCity(600)
    const won = runUntil(startMarch(game, toPoint(goal), army({ warrior: 500 }), T0), (s) => s.reports.length > 0)
    expect(won.reports[0]).toMatchObject({ ambush: true, outcome: 'victory' })
    expect(won.armies[0]).toMatchObject({ status: 'marching', order: toPoint(goal) })
    const arrived = runUntil(won, (s) => s.armies[0].status === 'idle')
    expect(arrived.armies[0]).toMatchObject({ position: goal, load: bandLoot('wolves', 2) })
  })

  it('une armée envoyée contre une bande la poursuit, l’attaque, et une autre bande viendra', () => {
    const { game, id } = withBand(richGame({}, { warrior: 500 }), nearCity(400), { goblin: 3 }, 2, 'goblins')
    const won = runUntil(startMarch(game, toBand(id), army({ warrior: 500 }), T0), (s) => s.reports.length > 0)
    expect(won.reports[0]).toMatchObject({ ambush: false, outcome: 'victory', loot: bandLoot('goblins', 2) })
    expect(won.bands).toEqual([])
    // La carte n'attendait plus de bande : une autre est en chemin.
    expect(won.nextBandAt).toBe(won.reports[0].at + BAND_SPAWN_SECONDS * 1000)
    expect(advance(won, won.nextBandAt!).bands).toHaveLength(1)
  })

  it('victorieuse, une bande garde ses survivants et reprend sa ronde', () => {
    // Attaquée sur sa ronde, elle la reprend aussitôt.
    const home = nearCity(350)
    const { game, id } = withBand(richGame({}, { archer: 1 }), home, { troll: 5 }, 3, 'trolls')
    const start = startMarch(game, toPoint(nearCity(100)), army({ archer: 1 }), T0)
    const placed: GameState = {
      ...start,
      armies: [{ ...start.armies[0], position: { x: home.x, y: home.y - PATROL_RADIUS - 20 }, order: null, status: 'idle' }],
    }
    const after = runUntil(placed, (s) => s.reports.length > 0)
    expect(after.reports[0]).toMatchObject({ outcome: 'defeat', ambush: true })
    expect(after.bands[0]).toMatchObject({ id, since: after.reports[0].at, chase: null })
  })

  it('une bande qui avait poursuivi l’armée regagne sa ronde après la bataille', () => {
    const { game, id } = withBand(richGame({}, { archer: 1 }), nearCity(350), { troll: 5 }, 3, 'trolls')
    const after = runUntil(startMarch(game, toBand(id), army({ archer: 1 }), T0), (s) => s.reports.length > 0)
    expect(after.reports[0].outcome).toBe('defeat')
    expect(after.bands[0]).toMatchObject({ id, since: null, chase: { army: null } })
    const back = runUntil(after, (s) => s.bands[0].chase === null)
    expect(back.bands[0].since).toBe(back.updatedAt)
    expect(distance(bandPosition(back.bands[0], back.updatedAt), nearCity(350))).toBeLessThanOrEqual(PATROL_RADIUS + 1e-9)
  })

  it('une nouvelle bande ne s’installe jamais assez près d’une armée pour l’attaquer aussitôt', () => {
    const spot = BAND_SPOTS[0]
    for (let seed = 1; seed <= 60; seed++) {
      let game: GameState = { ...richGame({}, { warrior: 10 }), seed }
      game = startMarch(game, toPoint({ x: spot.x, y: spot.y + 40 }), army({ warrior: 10 }), T0)
      game = runUntil(game, (s) => s.armies[0].status === 'idle')
      const later = advance({ ...game, nextBandAt: game.updatedAt + 1000 }, game.updatedAt + 1000)
      expect(later.bands).toHaveLength(1)
      const band = later.bands[0]
      expect(patrolDistance(band.home, later.armies[0].position)).toBeGreaterThan(aggroRadius(band.level))
    }
  })

  it('signale les bandes qui patrouillent près d’un chemin', () => {
    const den = getCamp('wolfDen').position
    const near = withBand(richGame(), onRoad(den, 0.5), { wolf: 1 })
    const behind = withBand(near.game, onRoad(den, -1.5), { wolf: 1 })
    expect(bandsNearPath(behind.game, WORLD.city, den).map((band) => band.id)).toEqual([near.id])
  })
})

describe('les gisements de ressources', () => {
  it('une nouvelle partie commence avec quelques gisements, puis la carte en accueille davantage', () => {
    const game = newGame('humans', T0)
    expect(game.nodes).toHaveLength(START_NODES)
    for (const node of game.nodes) {
      expect(NODE_SPOTS).toContainEqual(node.position)
      expect(node.level).toBe(levelAt(node.position))
      expect(node.remaining).toBe(nodeAmount(node.resource, node.level))
    }
    const full = advance(game, T0 + (MAX_NODES - START_NODES) * NODE_SPAWN_SECONDS * 1000)
    expect(full.nodes).toHaveLength(MAX_NODES)
    expect(full.nextNodeAt).toBeNull()
  })

  it('une armée récolte jusqu’à ne plus rien pouvoir porter, puis rentre seule à la cité', () => {
    const troops = army({ warrior: 10 })
    const { game, id } = withNode(richGame({}, troops), nearCity(200), 'wood', 1e6)
    const start = startMarch(game, toNode(id), troops, T0)
    const gathering = runUntil(start, (s) => s.armies[0]?.status === 'gathering')
    const full = runUntil(gathering, (s) => s.armies[0]?.order?.type === 'city')
    expect(loadSize(full.armies[0].load)).toBeCloseTo(carryCapacity(game, troops))

    const home = runUntil(full, (s) => s.armies.length === 0)
    const produced = productionPerHour(start).wood * ((home.updatedAt - start.updatedAt) / HOUR)
    expect(home.resources.wood - start.resources.wood - produced).toBeCloseTo(carryCapacity(game, troops))
    expect(home.nodes[0].remaining).toBeCloseTo(1e6 - carryCapacity(game, troops))
  })

  it('rappelée en pleine récolte, l’armée rapporte ce qu’elle a déjà ramassé', () => {
    const troops = army({ warrior: 10 })
    const { game, id } = withNode(richGame({}, troops), nearCity(200), 'stone', 1e6)
    const gathering = runUntil(startMarch(game, toNode(id), troops, T0), (s) => s.armies[0]?.status === 'gathering')
    const busy = advance(gathering, gathering.updatedAt + 10_000)
    const picked = loadSize(busy.armies[0].load)
    expect(picked).toBeGreaterThan(0)
    expect(picked).toBeLessThan(carryCapacity(game, troops))
    const home = runUntil(orderArmy(busy, busy.armies[0].id, CITY_TARGET, busy.updatedAt), (s) => s.armies.length === 0)
    const produced = productionPerHour(busy).stone * ((home.updatedAt - busy.updatedAt) / HOUR)
    expect(home.resources.stone - busy.resources.stone - produced).toBeCloseTo(picked)
  })

  it('un gisement épuisé disparaît, et un autre viendra le remplacer', () => {
    const { game, id } = withNode(richGame({}, { warrior: 50 }), nearCity(200), 'food', 30)
    const exhausted = runUntil(startMarch(game, toNode(id), army({ warrior: 50 }), T0), (s) => s.nodes.length === 0)
    expect(exhausted.armies[0].order).toEqual(CITY_TARGET)
    expect(exhausted.armies[0].load.food).toBeCloseTo(30)
    expect(exhausted.nextNodeAt).not.toBeNull()
  })

  it('une seule armée à la fois récolte un gisement', () => {
    const { game, id } = withNode(withTechs(richGame({}, { warrior: 20 }), { command: 1 }), nearCity(200), 'gold', 500)
    const sent = startMarch(game, toNode(id), army({ warrior: 10 }), T0)
    expect(checkMarch(sent, toNode(id), army({ warrior: 10 }))).toEqual({
      ok: false,
      reason: 'Une de tes armées récolte déjà ici',
    })
    expect(checkMarch(sent, toNode(id + 99), army({ warrior: 10 }))).toEqual({
      ok: false,
      reason: 'Ce gisement est épuisé',
    })
  })
})

describe('les raids et la défense de la cité', () => {
  /** Une cité qui ne produit rien : ses réserves ne bougent que par le pillage ou le butin. */
  const idleCity = (levels: Partial<Record<BuildingId, number>> = {}, troops: Partial<Army> = {}) =>
    richGame({ farm: 0, sawmill: 0, quarry: 0, goldMine: 0, manaWell: 0, ...levels }, troops)

  it('les raids commencent quand le Château a assez grandi, puis reviennent régulièrement', () => {
    const start = startUpgrade(richGame({ castle: RAID_CASTLE_LEVEL - 1 }), 'castle', T0)
    expect(start.nextRaidAt).toBeNull()
    const endsAt = start.constructions[0].endsAt
    const built = advance(start, endsAt)
    const first = endsAt + RAID_FIRST_SECONDS * 1000
    expect(built.nextRaidAt).toBe(first)
    expect(advance(built, first - 1).bands).toEqual([])

    const raided = advance(built, first)
    expect(raided.bands).toHaveLength(1)
    const raid = raided.bands[0]
    expect(raid).toMatchObject({ raid: true, level: 1, monsters: raidMonsters(raid.kind, 1), since: first })
    expect(RAID_GATES).toContainEqual(raid.home)
    expect(bandPosition(raid, first)).toEqual(raid.home)
    // Le suivant est déjà prévu, et il ne prend la place d'aucune bande sur la carte.
    expect(raided.nextRaidAt).toBe(first + RAID_INTERVAL_SECONDS * 1000)
    expect(raided.nextBandAt).toBeNull()
  })

  it('le niveau des raids grandit avec le Château, et un raid compte plus de monstres qu’une bande', () => {
    expect(raidLevel(richGame({ castle: RAID_CASTLE_LEVEL }))).toBe(1)
    expect(raidLevel(richGame({ castle: RAID_CASTLE_LEVEL + 2 }))).toBe(3)
    expect(raidLevel(richGame({ castle: MAX_LEVEL }))).toBe(Math.min(MAX_BAND_LEVEL, MAX_LEVEL - RAID_CASTLE_LEVEL + 1))
    for (const kind of BAND_KINDS) {
      expect(total(raidMonsters(kind.id, 2)), kind.id).toBeGreaterThan(total(bandMonsters(kind.id, 2)))
      expect(loadSize(raidLoot(kind.id, 2)), kind.id).toBeGreaterThan(loadSize(bandLoot(kind.id, 2)))
    }
  })

  it('un raid marche droit sur la cité et y arrive à l’heure dite', () => {
    const { game, id } = withRaid(richGame({}, { warrior: 500 }), { wolf: 1 })
    const raid = game.bands[0]
    const arrival = raidArrival(raid)!
    expect(arrival).toBe(T0 + Math.ceil((distance(raid.home, WORLD.city) / RAID_SPEED) * 1000))
    expect(distance(bandPosition(raid, T0 + 10_000), raid.home)).toBeCloseTo(RAID_SPEED * 10)
    expect(bandPosition(raid, arrival)).toEqual(WORLD.city)
    // Aucune armée dehors pour le croiser : inutile de suivre sa marche seconde par seconde.
    const waiting = advance(game, arrival - 1)
    expect(waiting.battles).toEqual([])
    expect(waiting.tickedAt).toBe(game.tickedAt)
    // À son arrivée, le siège commence : les troupes de la cité se battent.
    const besieged = advance(game, arrival)
    expect(siegeOf(besieged)).toMatchObject({ round: 0, allies: [{ army: null, sent: army({ warrior: 500 }), rounds: [] }], foes: [{ band: id }] })
    expect(raidArrival(besieged.bands[0])).toBeNull()
  })

  it('les troupes de la cité repoussent le raid : son butin rejoint les réserves', () => {
    const calm = richGame({}, { warrior: 500 })
    const { game } = withRaid(calm, { goblin: 3 }, RAID_SPEED, 2, 'goblins')
    const won = runUntil(game, (s) => s.reports.length > 0)
    const report = won.reports[0]
    const loot = raidLoot('goblins', 2)
    expect(report).toMatchObject({ outcome: 'victory', army: null, ambush: false, loot, hero: null })
    expect(report.foe).toEqual({ type: 'band', kind: 'goblins', level: 2, raid: true })
    expect(report.siege).toMatchObject({ guards: 0, guardsLost: 0, plunder: {} })
    expect(won.bands).toEqual([])
    expect(won.battles).toEqual([])
    expect(won.stats).toMatchObject({ victories: 1, bandsDefeated: 1, raidsRepelled: 1 })
    // Le butin est allé droit dans les réserves.
    const without = advance(calm, won.updatedAt)
    for (const id of RESOURCE_IDS) expect(won.resources[id]).toBeCloseTo(without.resources[id] + (loot[id] ?? 0), 1)
    // Un raid vaincu ne libère aucun repaire : aucune bande ne vient le remplacer.
    expect(won.nextBandAt).toBeNull()
  })

  it('les Remparts ajoutent des gardes et protègent mieux les troupes', () => {
    const siege = (walls: number) => {
      const { game } = withRaid(richGame({ walls }, { warrior: 50 }), { troll: 500 }, RAID_SPEED)
      return siegeOf(runUntil(game, (s) => s.battles.length > 0))!.allies[0]
    }
    const bare = siege(0)
    const walled = siege(4)
    expect(bare.siege).toEqual({ guards: 0, guardHealth: 0 })
    expect(walled.siege?.guards).toBe(4 * WALL_GUARDS_PER_LEVEL)
    expect(wallGuards(richGame({ walls: 4 }))).toBe(4 * WALL_GUARDS_PER_LEVEL)
    expect(walled.healthFactor).toBeCloseTo(bare.healthFactor + 4 * WALL_HEALTH_PER_LEVEL)
  })

  it('les gardes se battent même quand la garnison est vide, et sont au complet à chaque siège', () => {
    const { game } = withRaid(richGame({ walls: 5 }), { goblin: 1 }, RAID_SPEED)
    const won = runUntil(game, (s) => s.reports.length > 0)
    expect(won.reports[0]).toMatchObject({ outcome: 'victory', sent: emptyArmy(), lost: emptyArmy() })
    expect(won.reports[0].siege?.guards).toBe(wallGuards(game))
    expect(won.reports[0].rounds[0].guardsLost).toBe(0)
    // Des gardes tombés sont remplacés : le siège suivant en retrouve autant.
    const again = withRaid(won, { troll: 500 }, RAID_SPEED, 4, 'trolls')
    const lost = runUntil(again.game, (s) => s.reports.length > 1)
    expect(lost.reports[0]).toMatchObject({ outcome: 'defeat' })
    expect(lost.reports[0].siege).toMatchObject({ guards: wallGuards(game), guardsLost: wallGuards(game) })
    expect(wallGuards(lost)).toBe(wallGuards(game))
  })

  it('une cité sans défense est pillée sans combat, sauf ce que le Château met à l’abri', () => {
    const empty = idleCity()
    const safe = protectedAmount(empty)
    const stocked: GameState = {
      ...empty,
      resources: { ...emptyResources(), food: safe + 1000, wood: safe - 1, stone: safe + 500 },
      nextRaidAt: T0 + 60_000,
    }
    const { game } = withRaid(stocked, { troll: 500 }, RAID_SPEED, 4, 'trolls')
    const arrival = raidArrival(game.bands[0])!
    const pillaged = advance(game, arrival)
    const report = pillaged.reports[0]
    expect(report).toMatchObject({ outcome: 'defeat', rounds: [], loot: {}, enemyLost: {} })
    const plunder = { food: Math.floor(1000 * RAID_PLUNDER_SHARE), stone: Math.floor(500 * RAID_PLUNDER_SHARE) }
    expect(report.siege?.plunder).toEqual(plunder)
    expect(pillaged.resources).toEqual({
      ...stocked.resources,
      food: safe + 1000 - plunder.food,
      stone: safe + 500 - plunder.stone,
    })
    expect(pillaged.bands).toEqual([])
    expect(pillaged.battles).toEqual([])
    expect(pillaged.stats.raidsRepelled).toBe(0)
    // Les monstres sont repus : le prochain raid attendra plus longtemps que prévu.
    expect(pillaged.nextRaidAt).toBe(arrival + RAID_RESPITE_SECONDS * 1000)
  })

  it('les pillards n’emportent que ce qu’ils peuvent porter', () => {
    const { game } = withRaid(idleCity(), { goblin: 3 }, RAID_SPEED)
    const pillaged = advance(game, raidArrival(game.bands[0])!)
    const carried = loadSize(pillaged.reports[0].siege!.plunder)
    expect(carried).toBeLessThanOrEqual(3 * RAID_LOAD_PER_MONSTER)
    expect(carried).toBeGreaterThan(3 * RAID_LOAD_PER_MONSTER - RESOURCE_IDS.length)
  })

  it('sans hôpital, les défenseurs tombés pendant un siège meurent', () => {
    const { game } = withRaid(richGame({}, { warrior: 9 }), { troll: 500 }, RAID_SPEED, 4, 'trolls')
    const lost = runUntil(game, (s) => s.reports.length > 0)
    expect(lost.reports[0]).toMatchObject({ outcome: 'defeat', sent: army({ warrior: 9 }), lost: army({ warrior: 9 }), wounded: army({}) })
    expect(lost.troops).toEqual(army({}))
    expect(lost.wounded).toEqual(army({}))
  })

  it('avec un hôpital, une part des défenseurs tombés n’est que blessée : elle y va', () => {
    const { game } = withRaid(withHospital(richGame({}, { warrior: 9 }), 1), { troll: 500 }, RAID_SPEED, 4, 'trolls')
    const hurt = Math.ceil(9 * WOUNDED_SHARE)
    expect(hospitalBeds(game)).toBeGreaterThanOrEqual(hurt)
    const lost = runUntil(game, (s) => s.reports.length > 0)
    expect(lost.reports[0]).toMatchObject({ outcome: 'defeat', lost: army({ warrior: 9 }), wounded: army({ warrior: hurt }) })
    // Plus personne ne se relève aussitôt : les blessés attendent leurs soins à l'hôpital.
    expect(lost.reports[0].siege?.healed).toEqual(army({}))
    expect(lost.troops).toEqual(army({}))
    expect(lost.wounded).toEqual(army({ warrior: hurt }))
  })

  it('pendant un siège, les troupes restent aux remparts : ni sortie, ni renvoi', () => {
    const { game } = withRaid(richGame({}, { warrior: 500 }), { troll: 500 }, RAID_SPEED, 4, 'trolls')
    const besieged = advance(game, raidArrival(game.bands[0])!)
    const reason = 'La cité est assiégée : tes troupes défendent les remparts'
    expect(checkMarch(besieged, toCamp('wolfDen'), army({ warrior: 10 }))).toEqual({ ok: false, reason })
    expect(checkDismiss(besieged, army({ warrior: 10 }))).toEqual({ ok: false, reason })
    // Les troupes entraînées pendant le siège arrivent trop tard pour se battre, et n'y perdent rien.
    const trained = startTraining({ ...besieged, levels: { ...besieged.levels, barracks: 1 } }, 'archer', 1, besieged.updatedAt)
    const over = runUntil(trained, (s) => s.battles.length === 0 && s.trainings.length === 0)
    expect(over.troops.archer).toBe(1)
    expect(checkMarchSlot(over, toCamp('wolfDen'))).toEqual({ ok: true })
  })

  it('un raid qui arrive pendant un siège s’y joint, et la cité les repousse tous les deux', () => {
    const first = withRaid(richGame({}, { warrior: 500 }), { troll: 20 }, RAID_SPEED, 4, 'trolls')
    const second = withRaid(first.game, { goblin: 1 }, RAID_SPEED)
    const arrival = raidArrival(second.game.bands[0])!
    const besieged = advance(second.game, arrival)
    expect(besieged.battles).toHaveLength(1)
    expect(besieged.battles[0].foes.map((foe) => foe.band)).toEqual([first.id, second.id])
    // Ils sont venus du même côté : côte à côte, devant la cité.
    expect(new Set(besieged.battles[0].foes.map((foe) => foe.slot)).size).toBe(2)
    expect(bandPosition(besieged.bands[1], arrival)).toEqual(WORLD.city)
    const over = runUntil(besieged, (s) => s.bands.length === 0)
    expect(over.reports).toHaveLength(1)
    expect(over.reports[0]).toMatchObject({ outcome: 'victory', foes: [{ kind: 'trolls' }, { kind: 'wolves' }] })
    expect(over.stats.raidsRepelled).toBe(2)
  })

  it('un raid attend son tour aux portes quand la cité est déjà entourée', () => {
    let game = richGame({}, { warrior: 5000 })
    const ids: number[] = []
    for (let i = 0; i <= MAX_ATTACKERS; i++) {
      const raid = withRaid(game, { troll: 50 }, RAID_SPEED, 4, 'trolls')
      game = raid.game
      ids.push(raid.id)
    }
    const arrival = raidArrival(game.bands[0])!
    const besieged = advance(game, arrival)
    expect(besieged.battles[0].foes).toHaveLength(MAX_ATTACKERS)
    const last = besieged.bands.find((band) => band.id === ids[MAX_ATTACKERS])!
    expect(raidArrival(last)).toBe(arrival + SIEGE_WAIT_SECONDS * 1000)
  })

  it('une armée peut intercepter un raid avant qu’il n’atteigne la cité', () => {
    const { game, id } = withRaid(richGame({}, { warrior: 500 }), { goblin: 3 }, undefined, 2, 'goblins')
    const won = runUntil(startMarch(game, toBand(id), army({ warrior: 500 }), T0), (s) => s.reports.length > 0)
    const loot = raidLoot('goblins', 2)
    expect(won.reports[0]).toMatchObject({ outcome: 'victory', ambush: false, siege: null, loot })
    expect(won.reports[0].foe).toEqual({ type: 'band', kind: 'goblins', level: 2, raid: true })
    // La bataille a eu lieu loin des murs, et l'armée porte le butin.
    expect(distance(won.armies[0].position, WORLD.city)).toBeGreaterThan(200)
    expect(won.armies[0].load).toEqual(loot)
    expect(won.bands).toEqual([])
    expect(won.nextBandAt).toBeNull()
    // Un raid arrêté en chemin est un raid repoussé.
    expect(won.stats).toMatchObject({ victories: 1, bandsDefeated: 1, raidsRepelled: 1 })
    const quest = QUESTS.find((q) => q.goal.kind === 'raids')!
    expect(questDone(game, quest)).toBe(false)
    expect(questDone(won, quest)).toBe(true)
  })

  it('un raid attaque l’armée qu’il croise, puis reprend sa marche vers la cité', () => {
    const { game, id } = withRaid(idleCity({}, { archer: 1 }), { troll: 50 }, 400, 3, 'trolls')
    const gate = game.bands[0].home
    // L'armée remonte le chemin du raid : il l'attaque dès qu'elle est à sa portée.
    const start = startMarch(game, toPoint(onRoad(gate, 0.3)), army({ archer: 1 }), T0)
    const beaten = runUntil(start, (s) => s.reports.length > 0)
    expect(beaten.reports[0]).toMatchObject({ ambush: true, outcome: 'defeat', siege: null })
    expect(beaten.armies).toEqual([])
    expect(beaten.bands[0]).toMatchObject({ id, since: beaten.reports[0].at })
    // Vainqueur, le raid repart de là où il s'est battu, et finit par atteindre la cité.
    const arrival = raidArrival(beaten.bands[0])!
    expect(arrival).toBeGreaterThan(beaten.reports[0].at)
    const pillaged = advance(beaten, arrival)
    expect(pillaged.reports).toHaveLength(2)
    expect(pillaged.reports[0].siege).not.toBeNull()
    expect(pillaged.bands).toEqual([])
  })

  it('signale un raid qui se trouve près d’un chemin', () => {
    const { game, id } = withRaid(richGame(), { wolf: 1 }, 200)
    const gate = game.bands[0].home
    expect(bandsNearPath(game, WORLD.city, gate).map((band) => band.id)).toEqual([id])
    expect(bandsNearPath(game, WORLD.city, onRoad(gate, -0.5))).toEqual([])
    expect(bandsNearPath(game, WORLD.city, gate, toBand(id))).toEqual([])
  })

  it('donne le même résultat d’un coup ou seconde par seconde, raids et sièges compris', () => {
    const base = newGame('orcs', T0, 11)
    let start: GameState = {
      ...base,
      resources: { food: 9000, wood: 9000, stone: 9000, gold: 3000, mana: 900 },
      levels: { ...START_LEVELS, castle: RAID_CASTLE_LEVEL + 1, walls: 2 },
      techs: { ...base.techs, command: 1 },
      troops: army({ warrior: 60, archer: 30 }),
      nextRaidAt: T0 + 20_000,
    }
    // Une armée attend dehors, sur le chemin possible d'un raid ; une autre part en intercepter un.
    start = startMarch(start, toPoint(onRoad(RAID_GATES[1], 0.5)), army({ warrior: 10 }), T0)
    start = advance(start, T0 + 20_000)
    expect(start.bands.filter((band) => band.raid)).toHaveLength(1)
    start = startMarch(start, toBand(start.bands.find((band) => band.raid)!.id), army({ warrior: 20 }), T0 + 20_000)
    const end = T0 + 3 * HOUR

    const oneShot = advance(start, end)
    let stepped = start
    for (let t = T0 + 21_000; t <= end; t += 1000) stepped = advance(stepped, t)

    // Plusieurs raids sont venus, et au moins un a atteint les murs.
    expect(oneShot.reports.some((report) => report.siege !== null)).toBe(true)
    expect(stepped.reports).toEqual(oneShot.reports)
    expect(stepped.troops).toEqual(oneShot.troops)
    expect(stepped.armies).toEqual(oneShot.armies)
    expect(stepped.bands).toEqual(oneShot.bands)
    expect(stepped.battles).toEqual(oneShot.battles)
    expect(stepped.stats).toEqual(oneShot.stats)
    expect(stepped.nextRaidAt).toBe(oneShot.nextRaidAt)
    expect(stepped.seed).toBe(oneShot.seed)
    for (const id of RESOURCE_IDS) expect(stepped.resources[id]).toBeCloseTo(oneShot.resources[id], 6)
  })
})

describe('le dragon', () => {
  it('une quête donne un œuf ; couvé dans l’Aire du dragon, il éclôt', () => {
    const quest = QUESTS.find((q) => q.gift === 'dragonEgg')!
    // Tous les objectifs d'avant sont reçus : celui de l'œuf est l'objectif du moment.
    const before = { ...reach(richGame(), quest), quests: QUESTS.slice(0, QUESTS.indexOf(quest)).map((q) => q.id) }
    const egg = claimQuest(before, quest.id, T0)
    expect(egg.dragon).toEqual({ stage: 'egg', hatchAt: null, xp: 0, restUntil: null, nature: null })
    expect(dragonLevel(egg)).toBe(0)
    expect(checkHatch(egg)).toEqual({ ok: false, reason: 'Construis d’abord l’Aire du dragon' })
    const roost = { ...egg, levels: { ...egg.levels, dragonRoost: 1 } }
    const hatching = hatchEgg(roost, T0)
    for (const id of RESOURCE_IDS) {
      expect(hatching.resources[id]).toBeCloseTo(roost.resources[id] - (DRAGON_HATCH_COST[id] ?? 0))
    }
    expect(hatching.dragon?.stage).toBe('hatching')
    expect(checkHatch(hatching)).toEqual({ ok: false, reason: 'L’œuf est déjà en train d’éclore' })
    const at = T0 + DRAGON_HATCH_SECONDS * 1000
    expect(advance(hatching, at - 1).dragon?.stage).toBe('hatching')
    const born = advance(hatching, at)
    expect(born.dragon).toMatchObject({ stage: 'grown', hatchAt: null, xp: 0, restUntil: null })
    expect(DRAGON_NATURES.map((nature) => nature.id)).toContain(born.dragon?.nature)
    expect(dragonLevel(born)).toBe(1)
    expect(checkHatch(born)).toEqual({ ok: false, reason: 'Le dragon est déjà né' })
    expect(checkHatch(richGame())).toEqual({ ok: false, reason: 'Il te faut d’abord un œuf de dragon' })
  })

  it('le dragon grandit avec l’expérience, sans jamais dépasser le niveau de son aire', () => {
    const young = withDragon(richGame(), 1)
    const seasoned = { ...young, dragon: { ...young.dragon!, xp: dragonXpForLevel(4) } }
    expect(dragonXpForLevel(2)).toBeLessThan(dragonXpForLevel(3))
    expect(dragonLevel(seasoned)).toBe(1)
    expect(dragonLevel({ ...seasoned, levels: { ...seasoned.levels, dragonRoost: 3 } })).toBe(3)
    expect(dragonLevel({ ...seasoned, levels: { ...seasoned.levels, dragonRoost: 10 } })).toBe(4)
    const legend = { ...seasoned, levels: { ...seasoned.levels, dragonRoost: 10 }, dragon: { ...young.dragon!, xp: 1e12 } }
    expect(dragonLevel(legend)).toBe(DRAGON_MAX_LEVEL)
    expect(dragonAttack(2)).toBeGreaterThan(dragonAttack(1))
    expect(dragonHealth(2)).toBeGreaterThan(dragonHealth(1))
  })

  it('le dragon accompagne une armée, se bat avec elle et gagne de l’expérience', () => {
    const { game, id } = withBand(withDragon(richGame({}, { warrior: 50 }), 1), nearCity(300), { goblin: 40 }, 2, 'goblins')
    const start = startMarch(game, toBand(id), army({ warrior: 50 }), T0, null, true)
    expect(start.armies[0].dragon).toBe(true)
    expect(dragonArmy(start)?.id).toBe(start.armies[0].id)
    expect(checkDragon(start)).toEqual({ ok: false, reason: 'Le dragon accompagne déjà une armée' })
    const fighting = runUntil(start, (s) => (allyIn(s)?.rounds.length ?? 0) > 0)
    expect(allyIn(fighting)!.dragon?.start).toBeCloseTo(dragonHealth(1) * allyIn(fighting)!.healthFactor)
    const won = runUntil(fighting, (s) => s.reports.length > 0)
    const xp = 40 * getMonster('goblin').xp
    expect(won.reports[0]).toMatchObject({ outcome: 'victory', dragon: { xp, level: 1, wounded: false } })
    expect(won.dragon?.xp).toBe(xp)
    expect(won.armies[0].dragon).toBe(true)
    // L'armée rentre : le dragon regagne son aire, prêt à repartir.
    const home = runUntil(orderArmy(won, won.armies[0].id, CITY_TARGET, won.updatedAt), (s) => s.armies.length === 0)
    expect(checkDragon(home)).toEqual({ ok: true })
  })

  it('le dragon frappe fort, avec les forces des mages', () => {
    const firstRound = (game: GameState, dragon: boolean) => {
      // Une bande assez nombreuse pour que les coups de la première manche ne soient pas plafonnés.
      const target = withBand(game, nearCity(300), { goblin: 2000 })
      const start = startMarch(target.game, toBand(target.id), army({ warrior: 50 }), T0, null, dragon)
      return allyIn(runUntil(start, (s) => (allyIn(s)?.rounds.length ?? 0) > 0))!.rounds[0]
    }
    const game = withDragon(richGame({}, { warrior: 50 }), 2)
    const bonus = isStrongAgainst(DRAGON_FAMILY, getMonster('goblin').family) ? COUNTER_BONUS : 1
    const extra = firstRound(game, true).dealt - firstRound(game, false).dealt
    expect(extra).toBeCloseTo(dragonAttack(2) * BATTLE_DAMAGE_SCALE * bonus, -1)
  })

  it('le dragon ne se bat jamais seul : quand son escorte tombe, il rompt le combat et va se reposer', () => {
    // Une escorte minuscule face à une armée de trolls : elle tombe vite, bien avant le dragon.
    const { game, id } = withBand(withDragon(richGame({}, { warrior: 1 }), 1), nearCity(300), { troll: 400 }, 5, 'trolls')
    const start = startMarch(game, toBand(id), army({ warrior: 1 }), T0, null, true)
    const lost = runUntil(start, (s) => s.reports.length > 0)
    const report = lost.reports[0]
    expect(report).toMatchObject({ outcome: 'defeat', loot: {}, dragon: { wounded: true } })
    expect(report.rounds.some((round) => round.dragonFell)).toBe(false)
    expect(lost.armies).toEqual([])
    expect(lost.bands.map((band) => band.id)).toEqual([id])
    expect(lost.dragon?.restUntil).toBe(report.at + DRAGON_REST_SECONDS * 1000)
    expect(checkDragon(lost)).toEqual({ ok: false, reason: 'Le dragon, blessé, se repose dans son aire' })
    expect(checkDragon(advance(lost, report.at + DRAGON_REST_SECONDS * 1000))).toEqual({ ok: true })
  })

  it('à la cité, le dragon défend jusqu’au bout ; tombé, il se repose dans son aire', () => {
    // Personne d'autre pour défendre la cité face à une horde de trolls : le dragon finit par tomber.
    const home = withRaid(withDragon(richGame({ walls: 0 }), 1), { troll: 400 }, RAID_SPEED, 5, 'trolls')
    const besieged = advance(home.game, raidArrival(home.game.bands[0])!)
    const lost = runUntil(besieged, (s) => s.reports.length > 0)
    const report = lost.reports[0]
    expect(report).toMatchObject({ outcome: 'defeat', dragon: { wounded: true } })
    expect(report.rounds.some((round) => round.dragonFell)).toBe(true)
    expect(lost.dragon?.restUntil).toBe(report.at + DRAGON_REST_SECONDS * 1000)
    expect(checkDragon(advance(lost, report.at + DRAGON_REST_SECONDS * 1000))).toEqual({ ok: true })
  })

  it('dans son aire, le dragon défend la cité pendant un siège ; parti, il ne la défend pas', () => {
    const home = withRaid(withDragon(richGame({}, { warrior: 10 }), 2), { goblin: 30 }, RAID_SPEED)
    const besieged = advance(home.game, raidArrival(home.game.bands[0])!)
    expect(siegeOf(besieged)?.allies[0].dragon).not.toBeNull()
    const won = runUntil(besieged, (s) => s.reports.length > 0)
    expect(won.reports[0]).toMatchObject({ outcome: 'victory', dragon: { wounded: false } })
    expect(won.reports[0].dragon!.xp).toBeGreaterThan(0)

    const out = startMarch(withDragon(richGame({}, { warrior: 20 }), 2), toPoint(nearCity(600)), army({ warrior: 10 }), T0, null, true)
    const raid = withRaid(out, { goblin: 30 }, 300)
    expect(siegeOf(advance(raid.game, raidArrival(raid.game.bands[0])!))?.allies[0].dragon).toBeNull()
  })

  it('le dragon mange, d’autant plus qu’il est grand', () => {
    const game = richGame({}, { warrior: 10 })
    expect(upkeepPerHour(withDragon(game, 3)) - upkeepPerHour(game)).toBe(3 * DRAGON_UPKEEP_PER_LEVEL)
  })

  it('sans dragon, il ne part pas ; et il lui faut toujours une escorte', () => {
    const game = richGame({}, { warrior: 10 })
    expect(checkMarch(game, toCamp('wolfDen'), army({ warrior: 1 }), null, true)).toEqual({
      ok: false,
      reason: 'Tu n’as pas encore de dragon',
    })
    expect(checkMarch(withDragon(game), toCamp('wolfDen'), army({}), null, true).ok).toBe(false)
    expect(checkMarch(withDragon(game), toCamp('wolfDen'), army({ warrior: 1 }), null, true)).toEqual({ ok: true })
  })

  it('donne le même résultat d’un coup ou seconde par seconde, avec le dragon', () => {
    const { game, id } = withBand(withDragon(richGame({}, { warrior: 40 }), 2), nearCity(300), { troll: 20 }, 4, 'trolls')
    const start = startMarch(game, toBand(id), army({ warrior: 40 }), T0, null, true)
    const end = T0 + 30 * 60 * 1000
    const oneShot = advance(start, end)
    let stepped = start
    for (let t = T0 + 1000; t <= end; t += 1000) stepped = advance(stepped, t)
    expect(oneShot.reports.length).toBeGreaterThan(0)
    expect(stepped.reports).toEqual(oneShot.reports)
    expect(stepped.dragon).toEqual(oneShot.dragon)
    expect(stepped.armies).toEqual(oneShot.armies)
  })
})

describe('les héros', () => {
  it('on recrute un héros avec ses ressources, à partir d’un niveau du Château', () => {
    const ysolde = getHeroDef('ysolde')
    expect(checkRecruit(richGame({ castle: ysolde.castleLevel - 1 }), 'ysolde')).toEqual({
      ok: false,
      reason: `Nécessite le Château niveau ${ysolde.castleLevel}`,
    })
    const poor = { ...richGame({ castle: ysolde.castleLevel }), resources: emptyResources() }
    expect(checkRecruit(poor, 'ysolde')).toMatchObject({ ok: false, reason: expect.stringMatching(/^Il manque \d+ /) })

    const game = richGame({ castle: ysolde.castleLevel })
    const recruited = recruitHero(game, 'ysolde', T0)
    expect(recruited.heroes).toEqual([{ id: 'ysolde', level: 1, xp: 0, skills: {} }])
    expect(recruited.resources.gold).toBe(game.resources.gold - (ysolde.cost.gold ?? 0))
    expect(checkRecruit(recruited, 'ysolde')).toEqual({ ok: false, reason: 'Ce héros est déjà à ton service' })
  })

  it('l’expérience fait monter un héros de niveau, jusqu’au niveau maximum', () => {
    const hero: Hero = { id: 'ysolde', level: 1, xp: 0, skills: {} }
    expect(gainXp(hero, xpToNextLevel(1) - 1)).toMatchObject({ level: 1, xp: xpToNextLevel(1) - 1 })
    expect(gainXp(hero, xpToNextLevel(1) + xpToNextLevel(2) + 5)).toMatchObject({ level: 3, xp: 5 })
    expect(xpToNextLevel(2)).toBeGreaterThan(xpToNextLevel(1))
    expect(gainXp(hero, 1e9)).toMatchObject({ level: HERO_MAX_LEVEL, xp: 0 })
  })

  it('chaque niveau donne un point de compétence, et une compétence a un niveau maximum', () => {
    let game = recruitHero(richGame({ castle: 5 }), 'ysolde', T0)
    expect(skillPoints(getHero(game, 'ysolde')!)).toBe(1)
    game = learnSkill(game, 'ysolde', 'rally', T0)
    expect(getHero(game, 'ysolde')!.skills).toEqual({ rally: 1 })
    expect(checkSkill(game, 'ysolde', 'rally')).toEqual({
      ok: false,
      reason: 'Aucun point de compétence : le héros doit gagner un niveau',
    })
    // Un niveau de plus : un point de plus.
    const leveled = { ...game, heroes: [gainXp(getHero(game, 'ysolde')!, xpToNextLevel(1))] }
    expect(skillPoints(leveled.heroes[0])).toBe(1)
    expect(checkSkill(leveled, 'ysolde', 'spears').ok).toBe(true)

    const maxed = withHero(game, 'ysolde', { rally: SKILL_MAX_LEVEL })
    expect(checkSkill(maxed, 'ysolde', 'rally')).toEqual({ ok: false, reason: 'Niveau maximum atteint' })
    expect(checkSkill(maxed, 'ysolde', 'lightning').ok).toBe(false)
    expect(checkSkill(game, 'thalia', 'lightning')).toEqual({ ok: false, reason: 'Recrute d’abord ce héros' })
  })

  it('un héros mène une seule armée à la fois, et revient avec elle à la cité', () => {
    const game = withHero(withTechs(richGame({}, { warrior: 20 }), { command: 1 }), 'ysolde')
    const sent = startMarch(game, toPoint(nearCity(200)), army({ warrior: 10 }), T0, 'ysolde')
    expect(sent.armies[0].hero).toBe('ysolde')
    expect(heroArmy(sent, 'ysolde')?.id).toBe(sent.armies[0].id)
    expect(checkMarch(sent, toCamp('wolfDen'), army({ warrior: 10 }), 'ysolde')).toEqual({
      ok: false,
      reason: 'Ysolde de Valcourt mène déjà une armée',
    })
    expect(checkMarch(sent, toCamp('wolfDen'), army({ warrior: 10 }), 'thalia')).toEqual({
      ok: false,
      reason: 'Recrute d’abord ce héros',
    })
    const back = runUntil(orderArmy(sent, sent.armies[0].id, CITY_TARGET, T0), (s) => s.armies.length === 0)
    expect(heroArmy(back, 'ysolde')).toBeUndefined()
    expect(checkMarch(back, toCamp('wolfDen'), army({ warrior: 10 }), 'ysolde').ok).toBe(true)
  })

  it('le héros gagne de l’expérience pour chaque monstre vaincu', () => {
    const game = recruitHero(richGame({ castle: 5 }, { warrior: 1000 }), 'ysolde', T0)
    const den = getCamp('wolfDen')
    const won = runUntil(startMarch(game, toCamp('wolfDen'), army({ warrior: 1000 }), T0, 'ysolde'), (s) =>
      s.reports.length > 0,
    )
    const xp = (Object.entries(den.defenders) as [MonsterId, number][]).reduce(
      (sum, [id, count]) => sum + count * getMonster(id).xp,
      0,
    )
    const after = gainXp({ id: 'ysolde', level: 1, xp: 0, skills: {} }, xp)
    expect(won.reports[0].hero).toEqual({
      hero: 'ysolde',
      xp,
      level: after.level,
      levelsGained: after.level - 1,
    })
    expect(getHero(won, 'ysolde')).toMatchObject({ level: after.level, xp: after.xp })
  })

  it('une armée anéantie rend son héros à la cité, avec l’expérience gagnée', () => {
    const game = withHero(richGame({}, { archer: 3 }), 'ysolde')
    const lost = runUntil(startMarch(game, toCamp('trollLair'), army({ archer: 3 }), T0, 'ysolde'), (s) =>
      s.reports.length > 0,
    )
    expect(lost.reports[0].outcome).toBe('defeat')
    expect(lost.armies).toEqual([])
    expect(heroArmy(lost, 'ysolde')).toBeUndefined()
    expect(lost.reports[0].hero?.hero).toBe('ysolde')
  })

  it('les compétences du héros renforcent son armée', () => {
    const troops = army({ warrior: 200 })
    const base = withHero(richGame({}, troops), 'ysolde')
    const strong = withHero(base, 'ysolde', { rally: 5, spears: 5, shieldWall: 5 })
    // Une bande assez nombreuse pour que les coups de la première manche ne soient pas plafonnés.
    const firstRound = (game: GameState) => {
      const target = withBand(game, nearCity(300), { goblin: 2000 })
      const start = startMarch(target.game, toBand(target.id), troops, T0, 'ysolde')
      return allyIn(runUntil(start, (s) => (allyIn(s)?.rounds.length ?? 0) > 0))!
    }
    const plain = firstRound(base)
    const boosted = firstRound(strong)
    // +15 % d'attaque pour tous, et +30 % pour les guerriers : 45 % de dégâts en plus.
    expect(boosted.rounds[0].dealt / plain.rounds[0].dealt).toBeCloseTo(1.45, 1)
    expect(boosted.healthFactor).toBeCloseTo(plain.healthFactor + 0.15)
  })

  it('un héros peut faire marcher plus vite, récolter plus vite et porter davantage', () => {
    const game = withHero(withHero(richGame(), 'faelan', { trails: 5 }), 'durgan', { pickaxes: 5, baskets: 5 })
    expect(marchSpeed(game, 'faelan')).toBeCloseTo(marchSpeed(game) / (1 - 0.3))
    expect(marchDuration(game, WORLD.city, nearCity(300), 'faelan')).toBeLessThan(
      marchDuration(game, WORLD.city, nearCity(300)),
    )
    const troops = army({ warrior: 10 })
    expect(carryCapacity(game, troops, 'durgan')).toBeCloseTo(carryCapacity(game, troops) * 1.5)
    expect(gatherRate(game, troops, 'stone', 'durgan')).toBeCloseTo(gatherRate(game, troops, 'stone') * 1.5)
    // Sur le terrain : l'armée de Durgan rapporte davantage.
    const { game: withWood, id } = withNode(richGame({}, troops), nearCity(200), 'wood', 1e6)
    const led = withHero(withWood, 'durgan', { baskets: 5 })
    const full = runUntil(startMarch(led, toNode(id), troops, T0, 'durgan'), (s) => s.armies[0]?.order?.type === 'city')
    expect(loadSize(full.armies[0].load)).toBeCloseTo(carryCapacity(led, troops) * 1.5)
  })
})

/** Une partie où l'objectif de cette quête est tout juste atteint, quel qu'il soit. */
function reach(game: GameState, quest: QuestDef): GameState {
  const goal = quest.goal
  switch (goal.kind) {
    case 'building':
      return { ...game, levels: { ...game.levels, [goal.building]: goal.level } }
    case 'troops':
      return { ...game, troops: { ...game.troops, [goal.unit]: goal.count } }
    case 'heroes':
      return { ...game, heroes: HEROES.slice(0, goal.count).map((hero) => ({ id: hero.id, level: 1, xp: 0, skills: {} })) }
    case 'heroLevel':
      return { ...game, heroes: [{ id: 'ysolde', level: goal.level, xp: 0, skills: {} }] }
    case 'research':
      return { ...game, techs: { ...game.techs, agriculture: goal.levels } }
    case 'victories':
      return { ...game, stats: { ...game.stats, victories: goal.count } }
    case 'bands':
      return { ...game, stats: { ...game.stats, bandsDefeated: goal.count } }
    case 'gathered':
      return { ...game, stats: { ...game.stats, gathered: goal.amount } }
    case 'raids':
      return { ...game, stats: { ...game.stats, raidsRepelled: goal.count } }
    case 'camp':
      return { ...game, stats: { ...game.stats, campsDefeated: { ...game.stats.campsDefeated, [goal.camp]: goal.count } } }
    case 'dragonLevel':
      return withDragon(game, goal.level)
  }
}

describe('les quêtes', () => {
  it('chaque objectif mesure ce qu’il demande, et aucun n’est atteint au début de la partie', () => {
    const game = newGame('humans', T0)
    for (const quest of QUESTS) {
      expect(questDone(game, quest), quest.id).toBe(false)
      expect(questDone(reach(game, quest), quest), quest.id).toBe(true)
      expect(questProgress(reach(game, quest), quest).current, quest.id).toBe(questProgress(game, quest).target)
    }
  })

  it('les objectifs se suivent, un à la fois, dans l’ordre de la liste', () => {
    const game = newGame('humans', T0)
    expect(currentQuest(game)).toEqual(QUESTS[0])
    const later = reach(game, QUESTS[1])
    expect(checkClaim(later, QUESTS[1].id)).toEqual({ ok: false, reason: 'Termine d’abord l’objectif en cours' })
    expect(checkClaim(game, QUESTS[0].id)).toEqual({ ok: false, reason: 'Objectif pas encore atteint' })
  })

  it('un objectif atteint rapporte sa récompense, une seule fois, puis le suivant prend sa place', () => {
    const [first, second] = QUESTS
    const game = reach(newGame('humans', T0), first)
    const claimed = claimQuest(game, first.id, T0)
    for (const id of RESOURCE_IDS) expect(claimed.resources[id]).toBe(game.resources[id] + (first.reward[id] ?? 0))
    expect(claimed.quests).toEqual([first.id])
    expect(currentQuest(claimed)).toEqual(second)
    expect(checkClaim(claimed, first.id)).toEqual({ ok: false, reason: 'Récompense déjà reçue' })
    // Tout réclamer, dans l'ordre : il ne reste plus d'objectif.
    let all = claimed
    for (const quest of QUESTS.slice(1)) all = claimQuest(reach(all, quest), quest.id, T0)
    expect(currentQuest(all)).toBeNull()
  })

  it('les victoires, les bandes vaincues et les récoltes sont comptées', () => {
    const { game, id } = withBand(richGame({}, { warrior: 500 }), nearCity(400), { goblin: 3 }, 2, 'goblins')
    const won = runUntil(startMarch(game, toBand(id), army({ warrior: 500 }), T0), (s) => s.reports.length > 0)
    expect(won.stats).toMatchObject({ victories: 1, bandsDefeated: 1 })
    const home = runUntil(orderArmy(won, won.armies[0].id, CITY_TARGET, won.updatedAt), (s) => s.armies.length === 0)
    const camp = runUntil(startMarch(home, toCamp('wolfDen'), army({ warrior: 500 }), home.updatedAt), (s) =>
      s.reports.length > 1,
    )
    expect(camp.stats).toMatchObject({ victories: 2, bandsDefeated: 1, campsDefeated: { wolfDen: 1 } })

    const troops = army({ warrior: 10 })
    const { game: withWood, id: node } = withNode(richGame({}, troops), nearCity(200), 'wood', 1e6)
    const full = runUntil(startMarch(withWood, toNode(node), troops, T0), (s) => s.armies[0]?.order?.type === 'city')
    expect(full.stats.gathered).toBeCloseTo(carryCapacity(withWood, troops))
  })
})

describe('les sorts', () => {
  it('il faut la Tour des mages, au niveau du sort, et assez de mana', () => {
    const fury = getSpell('fury')
    expect(checkCast(richGame({ castle: 5 }), 'harvest')).toEqual({
      ok: false,
      reason: 'Construis d’abord la Tour des mages',
    })
    expect(checkCast(richGame({ castle: 5, mageTower: fury.towerLevel - 1 }), 'fury')).toEqual({
      ok: false,
      reason: `Nécessite la Tour des mages niveau ${fury.towerLevel}`,
    })
    const poor = { ...richGame({ castle: 5, mageTower: 5 }), resources: emptyResources() }
    expect(checkCast(poor, 'harvest')).toMatchObject({ ok: false, reason: expect.stringMatching(/^Il manque \d+ /) })
  })

  it('un sort coûte son prix, agit pour sa durée, puis s’arrête à l’heure exacte', () => {
    const game = richGame({ castle: 5, mageTower: 1 })
    const harvest = getSpell('harvest')
    const duration = harvest.durationSeconds * 1000
    const cast = castSpell(game, 'harvest', T0)
    expect(cast.resources.mana).toBe(game.resources.mana - (harvest.cost.mana ?? 0))
    expect(cast.spells).toEqual([{ spell: 'harvest', endsAt: T0 + duration }])
    expect(checkCast(cast, 'harvest')).toEqual({ ok: false, reason: 'Ce sort agit déjà' })
    // Pendant le sort, les fermes produisent 25 % de plus.
    const base = productionPerHour(game).food
    expect(productionPerHour(cast).food).toBeCloseTo(base * 1.25)
    // Après, le sort a disparu, et la production d'avant est revenue.
    const later = advance(cast, T0 + 2 * duration)
    expect(later.spells).toEqual([])
    expect(productionPerHour(later).food).toBeCloseTo(base)
    const gained = later.resources.food - cast.resources.food
    expect(gained).toBeCloseTo(base * 1.25 * (duration / HOUR) + base * (duration / HOUR))
    expect(checkCast(later, 'harvest').ok).toBe(true)
  })

  it('les sorts de guerre renforcent toutes les armées', () => {
    const troops = army({ warrior: 200 })
    const game = richGame({ castle: 5, mageTower: 5 }, troops)
    // Une bande assez nombreuse pour que les coups de la première manche ne soient pas plafonnés.
    const firstRound = (state: GameState) => {
      const target = withBand(state, nearCity(300), { goblin: 2000 })
      const start = startMarch(target.game, toBand(target.id), troops, T0)
      return allyIn(runUntil(start, (s) => (allyIn(s)?.rounds.length ?? 0) > 0))!
    }
    const plain = firstRound(game)
    const furious = firstRound(castSpell(game, 'fury', T0))
    expect(furious.rounds[0].dealt / plain.rounds[0].dealt).toBeCloseTo(1.15, 1)
    const stone = firstRound(castSpell(game, 'stoneskin', T0))
    expect(stone.healthFactor).toBeCloseTo(plain.healthFactor + 0.15)
    expect(marchSpeed(castSpell(game, 'tailwind', T0))).toBeCloseTo(marchSpeed(game) / (1 - 0.2))
  })

  it('chaque sort a un niveau de Tour, un coût et une durée : des dizaines de minutes, une nuit pour une défense', () => {
    for (const spell of SPELLS) {
      expect(spell.towerLevel).toBeGreaterThanOrEqual(1)
      expect(spell.durationSeconds).toBeGreaterThanOrEqual(20 * 60)
      expect(Object.keys(spell.cost).length).toBeGreaterThan(0)
      if (spell.absence) expect(spell.durationSeconds).toBeGreaterThanOrEqual(6 * 60 * 60)
    }
  })

  it('l’Égide des remparts protège mieux les défenseurs de la cité pendant les sièges', () => {
    const siege = (game: GameState) => {
      const { game: raided } = withRaid(game, { troll: 500 }, RAID_SPEED)
      return siegeOf(runUntil(raided, (s) => s.battles.length > 0))!.allies[0]
    }
    const game = richGame({ castle: 7, mageTower: 7 }, { warrior: 50 })
    const plain = siege(game)
    const shielded = siege(castSpell(game, 'aegis', T0))
    expect(shielded.healthFactor).toBeCloseTo(plain.healthFactor + 0.3)
  })

  it('la Brume d’oubli retient les raids jusqu’à ce qu’elle se lève', () => {
    const game: GameState = { ...richGame({ castle: 7, mageTower: 7 }), nextRaidAt: T0 + 60_000 }
    const veiled = castSpell(game, 'mist', T0)
    const ends = veiled.spells[0].endsAt
    // Pendant la brume, aucun raid ne part.
    const during = advance(veiled, ends - 1000)
    expect(during.bands.filter((band) => band.raid)).toEqual([])
    expect(during.nextRaidAt).toBe(ends)
    // Elle se lève : le raid retenu part aussitôt.
    const after = advance(veiled, ends)
    expect(after.spells).toEqual([])
    expect(after.bands.filter((band) => band.raid)).toHaveLength(1)
  })

  it('la Brume d’oubli se recharge : on ne la relance qu’un moment après sa fin', () => {
    const game = richGame({ castle: 7, mageTower: 7 })
    const veiled = castSpell(game, 'mist', T0)
    const ends = veiled.spells[0].endsAt
    const recharge = (getSpell('mist').rechargeSeconds ?? 0) * 1000
    expect(recharge).toBeGreaterThan(0)
    expect(veiled.spellsReadyAt.mist).toBe(ends + recharge)
    // Dissipée, elle se reforme : pas encore de nouvelle brume.
    expect(checkCast(advance(veiled, ends), 'mist')).toEqual({ ok: false, reason: 'Ce sort se recharge' })
    expect(checkCast(advance(veiled, ends + recharge - 1000), 'mist').ok).toBe(false)
    expect(checkCast(advance(veiled, ends + recharge), 'mist').ok).toBe(true)
    // L'Égide, elle, se relance dès sa fin.
    const shielded = castSpell(game, 'aegis', T0)
    expect(shielded.spellsReadyAt).toEqual({})
    expect(checkCast(advance(shielded, shielded.spells[0].endsAt), 'aegis').ok).toBe(true)
  })

  it('la Brume d’oubli n’arrête pas un raid déjà en marche', () => {
    const { game } = withRaid(richGame({ castle: 7, mageTower: 7 }, { warrior: 500 }), { goblin: 1 }, RAID_SPEED * 10)
    const veiled = castSpell(game, 'mist', T0)
    const arrived = advance(veiled, raidArrival(veiled.bands[0])!)
    expect(siegeOf(arrived)).toBeDefined()
  })
})

describe('recherches', () => {
  it('il faut une Académie, et une recherche ne dépasse pas son niveau', () => {
    expect(checkResearch(richGame({ academy: 0 }), 'agriculture')).toEqual({
      ok: false,
      reason: 'Construis d’abord l’Académie',
    })
    expect(checkResearch(withTechs(richGame({ academy: 1 }), { agriculture: 1 }), 'agriculture')).toEqual({
      ok: false,
      reason: 'Nécessite l’Académie niveau 2',
    })
    const late = getTech('forcedMarch')
    expect(checkResearch(richGame({ academy: late.unlockedAtAcademyLevel - 1 }), 'forcedMarch').ok).toBe(false)
  })

  it('retire le coût, puis applique le nouveau niveau à la fin', () => {
    const game = richGame({ academy: 3 })
    const started = startResearch(game, 'agriculture', T0)
    const cost = researchCost(getTech('agriculture'), 1)
    for (const id of RESOURCE_IDS) expect(started.resources[id]).toBe(game.resources[id] - (cost[id] ?? 0))
    expect(checkResearch(started, 'tools')).toEqual({ ok: false, reason: 'Une recherche est déjà en cours' })

    const endsAt = started.research!.endsAt
    expect(advance(started, endsAt - 1).techs.agriculture).toBe(0)
    const done = advance(started, endsAt)
    expect(done.techs.agriculture).toBe(1)
    expect(done.research).toBeNull()
  })

  it('l’Agriculture augmente la production de nourriture', () => {
    const game = richGame()
    const effect = getTech('agriculture').effect
    const perLevel = effect.kind === 'production' ? effect.perLevel : 0
    expect(productionPerHour(withTechs(game, { agriculture: 2 })).food).toBeCloseTo(
      productionPerHour(game).food * (1 + 2 * perLevel),
    )
    expect(productionPerHour(withTechs(game, { agriculture: 2 })).wood).toBe(productionPerHour(game).wood)
  })

  it('la Maçonnerie accélère les constructions', () => {
    const farm = getBuilding('farm')
    expect(upgradeDuration(withTechs(richGame(), { masonry: 3 }), farm, 4)).toBeLessThan(
      upgradeDuration(richGame(), farm, 4),
    )
  })

  it('la Forge et les Armures rendent l’armée plus forte', () => {
    const attack = (game: GameState) => {
      const start = startMarch(game, toCamp('goblinCamp'), army({ warrior: 40 }), T0)
      return runUntil(start, (s) => s.reports.length > 0).reports[0]
    }
    const plain = attack(richGame({}, { warrior: 40 }))
    const strong = attack(withTechs(richGame({}, { warrior: 40 }), { forge: 5, armor: 5 }))
    expect(strong.lost.warrior).toBeLessThan(plain.lost.warrior)
  })
})

describe('les poursuites', () => {
  /** Une bande de niveau 1 près de la cité, et une armée qui s'éloigne vers le nord, à sa vue. */
  function fleeing(): { game: GameState; id: number; home: Point } {
    const home = nearCity(400)
    const { game, id } = withBand(richGame({}, { warrior: 10 }), home, { wolf: 2 })
    const start = startMarch(game, toPoint({ x: home.x, y: 150 }), army({ warrior: 10 }), T0)
    // Elle part un peu au nord de la ronde : la bande, qui en passe tout près, la voit.
    const placed = { ...start, armies: [{ ...start.armies[0], position: { x: home.x, y: home.y - PATROL_RADIUS - 70 } }] }
    return { game: placed, id, home }
  }

  it('une bande en patrouille prend en chasse l’armée qu’elle voit, et l’attaque en la rattrapant', () => {
    const home = nearCity(400)
    const { game, id } = withBand(richGame({}, { warrior: 500 }), home, { wolf: 2 }, 2)
    // L'armée attend plus loin que la zone d'aggro de la ronde, mais à la vue de la bande.
    const spot = { x: home.x, y: home.y - PATROL_RADIUS - 90 }
    expect(patrolDistance(home, spot)).toBeGreaterThan(aggroRadius(2))
    expect(patrolDistance(home, spot)).toBeLessThan(sightRadius(2))
    const placed = placeArmy(startMarch(game, toPoint(nearCity(100)), army({ warrior: 500 }), T0), spot)
    const chasing = runUntil(placed, (s) => s.bands[0].chase !== null)
    expect(chasing.bands[0].chase?.army).toBe(placed.armies[0].id)
    const caught = runUntil(chasing, (s) => s.battles.length > 0)
    expect(foeIn(caught)).toMatchObject({ band: id, target: `army:${placed.armies[0].id}` })
    expect(allyIn(caught)).toMatchObject({ ambush: true })
    // Elle a quitté sa ronde pour l'atteindre.
    expect(distance(bandPosition(caught.bands[0], caught.updatedAt), home)).toBeGreaterThan(PATROL_RADIUS + 1)
  })

  it('une bande renonce quand elle s’éloigne trop de son repaire, puis regagne sa ronde', () => {
    const { game, id, home } = fleeing()
    let farthest = 0
    const gaveUp = runUntil(game, (s) => {
      farthest = Math.max(farthest, distance(bandPosition(s.bands[0], s.updatedAt), home))
      return s.armies[0].escaped.includes(id)
    })
    // Elle a couru après l'armée sans l'atteindre, jusqu'au bout de sa laisse.
    expect(gaveUp.reports).toEqual([])
    expect(gaveUp.bands[0].chase?.army).toBeNull()
    expect(farthest).toBeGreaterThan(CHASE_LEASH)
    expect(farthest).toBeLessThanOrEqual(CHASE_LEASH + CHASE_SPEED)
    const back = runUntil(gaveUp, (s) => s.bands[0].chase === null)
    expect(back.bands[0].since).toBe(back.updatedAt)
    expect(distance(bandPosition(back.bands[0], back.updatedAt), home)).toBeLessThanOrEqual(PATROL_RADIUS + 1e-9)
    // Semée, elle ne la poursuit plus : l'armée arrive au bout de sa route.
    const arrived = runUntil(back, (s) => s.armies[0].status === 'idle')
    expect(arrived.reports).toEqual([])
    expect(arrived.bands[0].chase).toBeNull()
  })

  it('les chefs et les raids ne poursuivent personne', () => {
    const { game } = withRaid(richGame(), { wolf: 3 })
    expect(canChase(game.bands[0])).toBe(false)
    const encampment = newGame('humans', T0).bands.filter((band) => band.encampment)
    expect(encampment.filter(canChase).every((band) => band.kind === 'crocs')).toBe(true)
    expect(encampment.filter((band) => band.still).some(canChase)).toBe(false)
  })

  it('une armée qui attend derrière une montagne ne fait pas avancer le monde seconde par seconde', () => {
    // La ronde de la bande passe à sa vue… si la montagne n'était pas là.
    const { game } = withBand(richGame({}, { warrior: 20 }), { x: 1650, y: 520 }, { goblin: 5 }, 5, 'goblins')
    const hidden = placeArmy(startMarch(game, toPoint(nearCity(100)), army({ warrior: 10 }), T0), { x: 1555, y: 465 })
    expect(patrolDistance(game.bands[0].home, hidden.armies[0].position)).toBeLessThan(sightRadius(5))
    const later = advance(hidden, T0 + HOUR)
    expect(later.battles).toEqual([])
    expect(later.bands[0].chase).toBeNull()
    expect(later.tickedAt).toBeLessThan(T0 + 10_000)
  })

  it('donne le même résultat d’un coup ou seconde par seconde, poursuites comprises', () => {
    const { game } = fleeing()
    const end = T0 + 3 * 60_000
    let stepped = game
    for (let t = T0 + 1000; t <= end; t += 1000) stepped = advance(stepped, t)
    expectSameGame(advance(game, end), stepped)
  })
})

describe('les soigneurs', () => {
  /** Une armée face à une bande de trolls, jusqu'à sa première manche : son combattant dans la mêlée. */
  function firstRound(troops: Partial<Army>, monsters: Monsters = { troll: 40 }) {
    const { game, id } = withBand(richGame({}, troops), nearCity(300), monsters, 2, 'trolls')
    const start = startMarch(game, toBand(id), army(troops), T0)
    return allyIn(runUntil(start, (s) => (allyIn(s)?.rounds.length ?? 0) > 0))!
  }

  /** La vie de toutes les troupes d'un combattant, à son entrée dans la mêlée et maintenant. */
  function troopHealth(ally: ReturnType<typeof firstRound>) {
    return {
      start: UNIT_IDS.reduce((sum, id) => sum + ally.sent[id] * getUnit(id).health * ally.healthFactor, 0),
      now: UNIT_IDS.reduce((sum, id) => sum + ally.health[id], 0),
    }
  }

  it('chaque race a les siens : ils se battent à peine, et les autres races ne peuvent pas les entraîner', () => {
    const healers = UNITS.filter((unit) => unit.heal)
    expect(new Set(healers.map((unit) => unit.race)).size).toBe(RACES.length)
    for (const healer of healers) expect(healer.attack).toBeLessThan(getUnit(healer.family).attack)
    const priest = getUnit('priest')
    const humans = richGame({ castle: 5, barracks: priest.barracksLevel })
    expect(checkTraining(humans, 'priest', 1).ok).toBe(true)
    expect(checkTraining({ ...humans, race: 'orcs' }, 'priest', 1)).toEqual({ ok: false, reason: 'Réservés aux Humains' })
  })

  it('à chaque manche, ils rendent de la vie à leur armée, sans dépasser ce qu’elle a perdu', () => {
    // Une petite bande : ses coups, répartis sur toute l'armée, ne font tomber personne.
    const ally = firstRound({ warrior: 50, priest: 10 }, { troll: 10 })
    expect(allySurvivors(ally).troops).toEqual(army({ warrior: 50, priest: 10 }))
    const round = ally.rounds[0]
    const power = 10 * getUnit('priest').heal! * ally.healthFactor
    expect(round.taken).toBeGreaterThan(0)
    expect(Math.abs(round.healed! - Math.min(power, round.taken))).toBeLessThanOrEqual(1)
    const { start, now } = troopHealth(ally)
    expect(Math.abs(start - now - (round.taken - round.healed!))).toBeLessThanOrEqual(1)
    // Sans soigneurs, rien n'est rendu.
    expect(firstRound({ warrior: 60 }).rounds[0].healed).toBeUndefined()
  })

  it('ils relèvent des troupes tombées', () => {
    const { game, id } = withBand(richGame({}, { warrior: 20, priest: 10 }), nearCity(300), { wolf: 3 })
    const fighting = runUntil(startMarch(game, toBand(id), army({ warrior: 20, priest: 10 }), T0), (s) => (allyIn(s)?.rounds.length ?? 0) > 0)
    // Les guerriers ont beaucoup souffert : il n'en reste qu'un quart debout.
    const battle = fighting.battles[0]
    const ally = battle.allies[0]
    const hurt = { ...ally, health: { ...ally.health, warrior: ally.sent.warrior * getUnit('warrior').health * ally.healthFactor * 0.25 } }
    const standing = allySurvivors(hurt).troops.warrior
    const next = runUntil({ ...fighting, battles: [{ ...battle, allies: [hurt] }] }, (s) => (allyIn(s)?.rounds.length ?? 0) > 1)
    expect(allySurvivors(allyIn(next)!).troops.warrior).toBeGreaterThan(standing)
    // Le journal de la manche le dit.
    expect(allyIn(next)!.rounds[1].raised?.warrior).toBeGreaterThan(0)
  })

  it('ceux de la cité soignent ses défenseurs pendant un siège', () => {
    const { game } = withRaid(richGame({}, { warrior: 40, priest: 10 }), { troll: 30 }, RAID_SPEED, 2, 'trolls')
    const besieged = runUntil(game, (s) => (siegeOf(s)?.allies[0].rounds.length ?? 0) > 0)
    expect(siegeOf(besieged)!.allies[0].rounds[0].healed).toBeGreaterThan(0)
  })

  it('donnent le même résultat d’un coup ou seconde par seconde', () => {
    const { game, id } = withBand(richGame({}, { warrior: 30, priest: 8 }), nearCity(300), { troll: 25 }, 2, 'trolls')
    const start = startMarch(game, toBand(id), army({ warrior: 30, priest: 8 }), T0)
    const end = T0 + 3 * 60_000
    let step = start
    for (let t = T0 + 1000; t <= end; t += 1000) step = advance(step, t)
    expectSameGame(advance(start, end), step)
    const rounds = [...(allyIn(step)?.rounds ?? []), ...(step.reports[0]?.rounds ?? [])]
    expect(rounds.some((round) => (round.healed ?? 0) > 0)).toBe(true)
  })
})

describe('le cône de flammes et les natures du dragon', () => {
  const spot = nearCity(400)
  const SIDES = [
    { x: -30, y: 0 },
    { x: 30, y: 0 },
    { x: 0, y: -30 },
    { x: 0, y: 30 },
  ]
  const natureOf = (id: DragonNature) => DRAGON_NATURES.find((nature) => nature.id === id)!

  /** Une armée avec le dragon, qui attend à `spot`, et `count` bandes de gobelins tout autour d'elle. */
  function withFlames(count: number, nature: DragonNature, goblins = 200): GameState {
    let game = withDragon(richGame({}, { warrior: 500 }), 1, nature)
    for (const side of SIDES.slice(0, count)) {
      game = withBand(game, { x: spot.x + side.x, y: spot.y + side.y + PATROL_RADIUS }, { goblin: goblins }, 1, 'goblins').game
    }
    return placeArmy(startMarch(game, toPoint(nearCity(100)), army({ warrior: 500 }), T0, null, true), spot)
  }
  /** La partie quand l'armée a joué `count` manches. */
  const after = (game: GameState, count: number) => runUntil(game, (s) => (allyIn(s)?.rounds.length ?? 0) >= count)
  const breathRound = DRAGON_BREATH_EVERY - 1

  it('toutes les 3 manches, le dragon crache un cône sur sa cible et les adversaires les plus proches', () => {
    const rounds = allyIn(after(withFlames(4, 'ember'), DRAGON_BREATH_EVERY))!.rounds
    expect(rounds.slice(0, breathRound).every((round) => round.breath === undefined)).toBe(true)
    expect(rounds[breathRound].breath!.foes).toBe(1 + DRAGON_BREATH_TARGETS)
    expect(rounds[breathRound].breath!.damage).toBeGreaterThan(0)
    // Orage : un adversaire de plus.
    const storm = allyIn(after(withFlames(4, 'storm'), DRAGON_BREATH_EVERY))!.rounds[breathRound]
    expect(storm.breath!.foes).toBe(Math.min(4, 1 + DRAGON_BREATH_TARGETS + natureOf('storm').extraTargets))
    // Face à une seule bande, il ne touche qu'elle.
    expect(allyIn(after(withFlames(1, 'ember'), DRAGON_BREATH_EVERY))!.rounds[breathRound].breath!.foes).toBe(1)
  })

  it('le cône compte comme les coups de l’armée : les bandes brûlées lui doivent une part de leur butin', () => {
    const burned = after(withFlames(3, 'ember'), DRAGON_BREATH_EVERY)
    const ally = allyIn(burned)!
    expect(burned.battles[0].foes.every((foe) => (foe.damageBy[ally.ref] ?? 0) > 0)).toBe(true)
  })

  it('Givre : les monstres touchés par le cône frappent moins fort à la manche suivante', () => {
    const chilled = after(withFlames(3, 'frost'), DRAGON_BREATH_EVERY)
    const battle = chilled.battles[0]
    expect(battle.foes.every((foe) => foe.chilled === battle.round + 1)).toBe(true)
    const thawed = { ...chilled, battles: [{ ...battle, foes: battle.foes.map(({ chilled: _chilled, ...foe }) => foe) }] }
    const next = (game: GameState) => allyIn(after(game, DRAGON_BREATH_EVERY + 1))!.rounds[DRAGON_BREATH_EVERY]
    expect(next(chilled).taken / next(thawed).taken).toBeCloseTo(1 - natureOf('frost').chill, 2)
  })

  it('Braise brûle plus fort ; Écaille a plus de vie, et plus encore pour défendre la cité', () => {
    const flames = (nature: DragonNature) =>
      allyIn(after(withFlames(1, nature), DRAGON_BREATH_EVERY))!.rounds[breathRound].breath!.damage
    expect(flames('ember') / flames('scale')).toBeCloseTo(natureOf('ember').breath / natureOf('scale').breath, 1)
    const start = (nature: DragonNature) => allyIn(after(withFlames(1, nature), 1))!.dragon!.start
    expect(start('scale') / start('ember')).toBeCloseTo(natureOf('scale').health / natureOf('ember').health, 5)
    // À la cité, pendant un siège.
    const home = withDragon(richGame({}, { warrior: 50 }), 1, 'scale')
    const { game } = withRaid(home, { troll: 500 }, RAID_SPEED, 2, 'trolls')
    const city = siegeOf(runUntil(game, (s) => s.battles.length > 0))!.allies[0]
    expect(city.dragon!.start).toBeCloseTo(dragonMaxHealth(home, true) * city.healthFactor, 5)
    expect(dragonMaxHealth(home, true) / dragonMaxHealth(home)).toBeCloseTo(natureOf('scale').homeHealth, 5)
  })

  it('à l’éclosion, sa nature est tirée au sort : chacune peut sortir, et la même graine donne la même', () => {
    const born = (seed: number) => {
      const egg = { ...richGame({ dragonRoost: 1 }), seed, dragon: { stage: 'hatching' as const, hatchAt: T0 + 1000, xp: 0, restUntil: null, nature: null } }
      return advance(egg, T0 + 1000).dragon!.nature
    }
    const seen = new Set(Array.from({ length: 60 }, (_, seed) => born(seed)))
    expect(seen.size).toBe(DRAGON_NATURES.length)
    expect(born(17)).toBe(born(17))
  })

  it('donne le même résultat d’un coup ou seconde par seconde', () => {
    const start = withFlames(3, 'frost')
    const end = T0 + 40_000
    let step = start
    for (let t = T0 + 1000; t <= end; t += 1000) step = advance(step, t)
    expectSameGame(advance(start, end), step)
    expect(allyIn(step)!.rounds.some((round) => round.breath)).toBe(true)
  })
})

describe('les mêlées', () => {
  const spot = nearCity(400)

  /** Une armée qui attend à `spot`, et des bandes de gobelins tout près d'elle, dans l'ordre (à l'ouest, à l'est, au nord…). */
  function surrounded(sides: Point[], goblins: number[], troops = 500): GameState {
    let game = richGame({}, { warrior: troops })
    sides.forEach((side, i) => {
      // Au départ, une bande se trouve en haut de sa ronde : son repaire est donc juste en dessous.
      game = withBand(game, { x: spot.x + side.x, y: spot.y + side.y + PATROL_RADIUS }, { goblin: goblins[i] }, 1, 'goblins').game
    })
    return placeArmy(startMarch(game, toPoint(nearCity(100)), army({ warrior: troops }), T0), spot)
  }
  const WEST = { x: -30, y: 0 }
  const EAST = { x: 30, y: 0 }
  const NORTH = { x: 0, y: -30 }

  /** La première manche de l'armée. */
  const firstRound = (game: GameState) => allyIn(runUntil(game, (s) => (allyIn(s)?.rounds.length ?? 0) > 0))!

  it('plusieurs bandes attaquent la même armée en même temps', () => {
    const fighting = firstRound(surrounded([WEST, EAST], [1000, 1000]))
    expect(fighting.rounds[0].attackers).toBe(2)
    const battle = runUntil(surrounded([WEST, EAST], [1000, 1000]), (s) => s.battles.length > 0).battles[0]
    expect(battle.foes).toHaveLength(2)
    expect(battle.foes.every((foe) => foe.target === allyIn({ battles: [battle] } as GameState)!.ref)).toBe(true)
  })

  it('frapper de dos donne un bonus : la bande arrivée derrière l’armée frappe plus fort', () => {
    // Seule, la bande de l'est est face à l'armée ; avec celle de l'ouest, qui l'a attaquée d'abord, elle est dans son dos.
    const alone = firstRound(surrounded([EAST], [1000]))
    const both = firstRound(surrounded([WEST, EAST], [1000, 1000]))
    expect(both.rounds[0].taken / alone.rounds[0].taken).toBeCloseTo(2 + REAR_ATTACK_BONUS, 2)
  })

  it('attaquée de trois côtés, une armée est encerclée et frappe moins fort', () => {
    const free = firstRound(surrounded([WEST], [1000]))
    const caught = firstRound(surrounded([WEST, EAST, NORTH], [1000, 1000, 1000]))
    expect(free.rounds[0].encircled).toBeUndefined()
    expect(caught.rounds[0]).toMatchObject({ encircled: true, attackers: 3 })
    expect(caught.rounds[0].dealt / free.rounds[0].dealt).toBeCloseTo(1 - ENCIRCLED_ATTACK_MALUS, 2)
    // Le flanc seul ne suffit pas : deux côtés, ce n'est pas encore l'encerclement.
    expect(firstRound(surrounded([WEST, NORTH], [1000, 1000])).rounds[0].encircled).toBeUndefined()
  })

  it('frapper de côté donne un bonus plus petit que de dos', () => {
    const alone = firstRound(surrounded([NORTH], [1000]))
    const side = firstRound(surrounded([WEST, NORTH], [1000, 1000]))
    expect(side.rounds[0].taken / alone.rounds[0].taken).toBeCloseTo(2 + SIDE_ATTACK_BONUS, 2)
  })

  it('quand sa cible tombe, l’armée se tourne vers une bande qui la frappe', () => {
    const start = surrounded([WEST, EAST], [3, 1000])
    const ids = start.bands.map((band) => band.id)
    const turned = runUntil(start, (s) => s.bands.length === 1 && s.battles.length > 0)
    expect(allyIn(turned)?.target).toBe(`band:${ids[1]}`)
    // Elles se font face, maintenant.
    expect(foeIn(turned)?.target).toBe(allyIn(turned)?.ref)
    expect(allyIn(turned)?.slot).toBe(((foeIn(turned)?.slot ?? 0) + 4) % 8)
  })

  it('une armée peut se tourner vers un autre adversaire de sa mêlée, sans battre en retraite', () => {
    const start = surrounded([WEST, EAST], [1000, 1000])
    const ids = start.bands.map((band) => band.id)
    const fighting = runUntil(start, (s) => s.battles[0]?.foes.length === 2)
    const armyId = fighting.armies[0].id
    expect(checkOrder(fighting, armyId, toBand(ids[0]))).toEqual({ ok: false, reason: 'Ton armée combat déjà cette cible' })
    const turned = orderArmy(fighting, armyId, toBand(ids[1]), fighting.updatedAt)
    expect(allyIn(turned)?.target).toBe(`band:${ids[1]}`)
    expect(turned.reports).toEqual([])
    expect(turned.armies[0].status).toBe('fighting')
  })

  it('en retraite, l’armée quitte la mêlée, et les bandes reprennent leur ronde', () => {
    const fighting = runUntil(surrounded([WEST, EAST], [1000, 1000]), (s) => s.battles[0]?.foes.length === 2)
    const fled = orderArmy(fighting, fighting.armies[0].id, CITY_TARGET, fighting.updatedAt)
    expect(fled.battles).toEqual([])
    expect(fled.reports[0]).toMatchObject({ outcome: 'retreat', foes: [{ kind: 'goblins' }, { kind: 'goblins' }] })
    expect(fled.bands.every((band) => band.since === fled.updatedAt)).toBe(true)
  })

  it('plusieurs armées attaquent la même bande, et se partagent son butin selon leurs coups', () => {
    const { game, id } = withBand(withTechs(richGame({}, { warrior: 400 }), { command: 2 }), nearCity(350), { goblin: 60 }, 2, 'goblins')
    let start = startMarch(game, toBand(id), army({ warrior: 300 }), T0)
    start = startMarch(start, toBand(id), army({ warrior: 100 }), T0)
    const together = runUntil(start, (s) => s.battles[0]?.allies.length === 2)
    expect(together.battles[0].foes).toHaveLength(1)
    const done = runUntil(together, (s) => s.reports.length === 2)
    expect(done.reports.map((report) => report.outcome)).toEqual(['victory', 'victory'])
    const loot = bandLoot('goblins', 2)
    for (const resource of RESOURCE_IDS) {
      expect(done.reports.reduce((sum, report) => sum + (report.loot[resource] ?? 0), 0)).toBe(loot[resource] ?? 0)
    }
    // La plus grosse armée a frappé plus fort : elle emporte la plus grosse part.
    const share = (troops: number) => loadSize(done.reports.find((r) => r.sent.warrior === troops)!.loot)
    expect(share(300)).toBeGreaterThan(share(100))
    expect(done.stats).toMatchObject({ victories: 1, bandsDefeated: 1 })
  })

  it('une armée rejoint la mêlée où se bat la bande qu’elle vise', () => {
    // Des trolls : peu nombreux, ils frappent peu mais tiennent longtemps. La première armée tient jusqu'à l'arrivée de la seconde.
    const { game, id } = withBand(withTechs(richGame({}, { warrior: 400 }), { command: 1 }), nearCity(350), { troll: 30 }, 2, 'trolls')
    const first = startMarch(game, toBand(id), army({ warrior: 200 }), T0)
    const fighting = runUntil(first, (s) => s.battles.length > 0)
    const second = startMarch(fighting, toBand(id), army({ warrior: 200 }), fighting.updatedAt)
    const joined = runUntil(second, (s) => s.battles[0]?.allies.length === 2)
    expect(joined.battles).toHaveLength(1)
    expect(joined.battles[0].allies.every((ally) => ally.target === `band:${id}`)).toBe(true)
  })

  it('donne le même résultat d’un coup ou seconde par seconde, en pleine mêlée', () => {
    const start = surrounded([WEST, EAST, NORTH], [40, 60, 80], 200)
    const end = T0 + 3 * 60_000
    let stepped = start
    for (let t = T0 + 1000; t <= end; t += 1000) stepped = advance(stepped, t)
    const jumped = advance(start, end)
    expectSameGame(jumped, stepped)
    expect(jumped.reports.length).toBeGreaterThan(0)
  })
})

describe('le relief', () => {
  const cirque = ENCAMPMENT.center
  const beyond = { x: 2700, y: 520 }

  it('une armée contourne les montagnes : elle entre dans le grand campement par son col', () => {
    const start = startMarch(richGame({}, { warrior: 10 }), toPoint(cirque), army({ warrior: 10 }), T0)
    const straight = Math.round((distance(WORLD.city, cirque) / marchSpeed(start)) * 1000)
    expect(marchDuration(start, WORLD.city, cirque)).toBeGreaterThan(straight)
    const positions: Point[] = []
    const arrived = runUntil(
      start,
      (s) => {
        positions.push(s.armies[0].position)
        return s.armies[0].status === 'idle'
      },
      2 * HOUR,
    )
    expect(distance(arrived.armies[0].position, cirque)).toBeLessThan(1)
    // Elle n'a jamais mis le pied dans une montagne.
    expect(positions.some((p) => insideAny(p, MOUNTAINS))).toBe(false)
  })

  it('refuse d’envoyer une armée dans les montagnes, ou au-delà de la porte fermée', () => {
    const game = richGame({}, { warrior: 10 })
    const peak = { x: 1900, y: 1040 }
    expect(insideAny(peak, MOUNTAINS)).toBe(true)
    expect(checkMarch(game, toPoint(peak), army({ warrior: 10 }))).toEqual({
      ok: false,
      reason: 'Aucune armée ne peut franchir ces montagnes',
    })
    expect(checkMarch(game, toPoint(beyond), army({ warrior: 10 }))).toEqual({
      ok: false,
      reason: 'Aucun chemin n’y mène : la porte du grand campement est fermée',
    })
  })

  it('une armée qui se trouve au-delà de la porte peut toujours rentrer', () => {
    const start = startMarch(richGame({}, { warrior: 10 }), toPoint(nearCity(100)), army({ warrior: 10 }), T0)
    const away: GameState = { ...start, armies: [{ ...start.armies[0], position: beyond, order: null, status: 'idle' }] }
    expect(checkOrder(away, away.armies[0].id, CITY_TARGET)).toEqual({ ok: true })
    const home = runUntil(orderArmy(away, away.armies[0].id, CITY_TARGET, T0), (s) => s.armies.length === 0, 3 * HOUR)
    expect(home.troops.warrior).toBe(10)
  })

  it('une montagne empêche une bande d’attaquer l’armée qui se tient derrière', () => {
    // Une bande contre le mur ouest du cirque ; une armée de chaque côté du mur, à la même distance.
    const { game } = withBand(richGame({}, { warrior: 20 }), { x: 1650, y: 520 }, { goblin: 5 }, 5, 'goblins')
    const start = startMarch(game, toPoint(nearCity(100)), army({ warrior: 10 }), T0)
    const at = (position: Point): GameState => ({
      ...start,
      armies: [{ ...start.armies[0], position, order: null, status: 'idle' }],
    })
    const hidden = advance(at({ x: 1555, y: 465 }), T0 + 5000)
    expect(hidden.battles).toEqual([])
    const seen = advance(at({ x: 1745, y: 465 }), T0 + 5000)
    expect(seen.battles).toHaveLength(1)
  })
})

describe('le grand campement', () => {
  /** La même partie, avec le grand campement peuplé. */
  function withEncampment(game: GameState): GameState {
    const at = game.updatedAt + 1000
    return advance({ ...game, encampment: { resetAt: at, gateOpen: false, sprung: [] } }, at)
  }

  const keeperOf = (game: GameState) => game.bands.find((band) => band.kind === 'keeper')

  it('est peuplé dès le début ; ses bandes ne comptent pas parmi celles de la carte, et ses chefs ne bougent pas', () => {
    const game = newGame('humans', T0)
    const encampment = game.bands.filter((band) => band.encampment)
    expect(encampment).toHaveLength(ENCAMPMENT_BANDS.length)
    const chiefs = encampment.filter((band) => band.still).map((band) => band.kind)
    expect(chiefs.sort()).toEqual(['eliteGuard', 'eliteGuard', 'keeper', 'warlord', 'watchtower'])
    expect(game.encampment).toEqual({ resetAt: T0 + CAMP_RESPAWN_SECONDS * 1000, gateOpen: false, sprung: [] })
    const warlord = encampment.find((band) => band.kind === 'warlord')!
    expect(bandPosition(warlord, T0 + HOUR)).toEqual(warlord.home)
  })

  it('l’armée qui bat le gardien emporte la clef, et ouvre la porte en arrivant à son seuil', () => {
    const game = withEncampment({ ...richGame({}, { warrior: 2000 }), trial: true })
    const keeper = keeperOf(game)!
    // L'armée est posée près du gardien, dans le cirque, pour ne pas avoir à traverser tout le campement.
    const start = startMarch(game, toPoint(nearCity(100)), army({ warrior: 2000 }), game.updatedAt)
    const placed: GameState = {
      ...start,
      armies: [{ ...start.armies[0], position: { x: keeper.home.x + 20, y: keeper.home.y }, order: null, status: 'idle' }],
    }
    const id = placed.armies[0].id
    const won = runUntil(orderArmy(placed, id, toBand(keeper.id), placed.updatedAt), (s) => !keeperOf(s) && s.battles.length === 0)
    expect(won.armies[0].key).toBe(true)
    const beyond = { x: 2700, y: 520 }
    expect(routeBetween(won, WORLD.city, beyond)).toBeNull()
    const opened = runUntil(orderArmy(won, id, toPoint(ENCAMPMENT_GATE_FRONT), won.updatedAt), (s) => s.encampment.gateOpen, 2 * HOUR)
    expect(opened.armies[0].key).toBe(false)
    expect(routeBetween(opened, WORLD.city, beyond)).not.toBeNull()
  })

  it('la clef perdue retourne à son gardien', () => {
    const game = withEncampment(richGame({}, { warrior: 10 }))
    const withoutKeeper = { ...game, bands: game.bands.filter((band) => band.kind !== 'keeper') }
    const start = startMarch(withoutKeeper, toPoint(nearCity(100)), army({ warrior: 10 }), game.updatedAt)
    const carrying: GameState = { ...start, armies: [{ ...start.armies[0], key: true }] }
    const home = runUntil(orderArmy(carrying, carrying.armies[0].id, CITY_TARGET, carrying.updatedAt), (s) => s.armies.length === 0)
    expect(keeperOf(home)).toBeDefined()
  })

  it('tant que la tour de guet tient, les patrouilles du campement accourent vers les armées qu’elle voit', () => {
    const game = withEncampment(richGame({}, { warrior: 10 }))
    const tower = watchtower(game)!
    // Une armée au nord du cirque, que la tour voit ; et la patrouille qui en est la plus loin, hors de sa vue.
    const spot = { x: 1900, y: 300 }
    expect(distance(tower.home, spot)).toBeLessThanOrEqual(WATCH_RADIUS)
    const far = game.bands
      .filter((band) => band.encampment && canChase(band))
      .sort((a, b) => distance(b.home, spot) - distance(a.home, spot))[0]
    expect(patrolDistance(far.home, spot)).toBeGreaterThan(sightRadius(far.level))
    const placed = placeArmy(startMarch({ ...game, bands: [far, tower] }, toPoint(nearCity(100)), army({ warrior: 10 }), game.updatedAt), spot)
    const alerted = advance(placed, placed.updatedAt + 2000)
    expect(alerted.bands.find((band) => band.id === far.id)?.chase?.army).toBe(placed.armies[0].id)
    // La tour abattue, plus d'alerte : la patrouille garde sa ronde.
    const unwatched = advance({ ...placed, bands: [far] }, placed.updatedAt + 60_000)
    expect(unwatched.bands[0].chase).toBeNull()
  })

  it('ses pièges sont sur des passages où les armées peuvent aller', () => {
    const game = withEncampment(richGame())
    for (const trap of ENCAMPMENT_TRAPS) {
      expect(insideAny(trap, MOUNTAINS)).toBe(false)
      expect(routeBetween(game, WORLD.city, trap)).not.toBeNull()
    }
  })

  it('un piège caché blesse la première armée qui passe dessus, puis reste désarmé jusqu’au repeuplement', () => {
    const game = { ...withEncampment(richGame({}, { warrior: 300 })), bands: [] }
    // Le piège de la sortie du col : l'armée le franchit en entrant dans le cirque.
    const trap = ENCAMPMENT_TRAPS[0]
    const before = { x: trap.x - 40, y: trap.y + 30 }
    const after = { x: trap.x + 40, y: trap.y - 30 }
    expect(insideAny(before, MOUNTAINS) || insideAny(after, MOUNTAINS)).toBe(false)
    const placed = placeArmy(startMarch(game, toPoint(nearCity(100)), army({ warrior: 300 }), game.updatedAt), before)
    const id = placed.armies[0].id
    const crossed = runUntil(orderArmy(placed, id, toPoint(after), placed.updatedAt), (s) => s.armies[0].status === 'idle')
    const lost = Math.floor(TRAP_DAMAGE / getUnit('warrior').health)
    expect(crossed.reports).toHaveLength(1)
    expect(crossed.reports[0]).toMatchObject({ foe: { type: 'trap' }, army: id, sent: army({ warrior: 300 }), lost: army({ warrior: lost }) })
    expect(crossed.armies[0].troops.warrior).toBe(300 - lost)
    expect(crossed.encampment.sprung).toEqual([0])
    // Désarmé : l'armée repasse sans encombre.
    const again = runUntil(orderArmy(crossed, id, toPoint(before), crossed.updatedAt), (s) => s.armies[0].status === 'idle')
    expect(again.reports).toHaveLength(1)
    // Au repeuplement, il est tendu à nouveau.
    expect(advance(again, again.encampment.resetAt!).encampment.sprung).toEqual([])
  })

  it('une armée anéantie par un piège disparaît, et la clef qu’elle portait retourne à son gardien', () => {
    const game = { ...withEncampment(richGame({}, { warrior: 5 })), bands: [] }
    const trap = ENCAMPMENT_TRAPS[0]
    const start = startMarch(game, toPoint(nearCity(100)), army({ warrior: 5 }), game.updatedAt)
    const placed = placeArmy({ ...start, armies: [{ ...start.armies[0], key: true }] }, { x: trap.x - 40, y: trap.y + 30 })
    const id = placed.armies[0].id
    const wiped = runUntil(orderArmy(placed, id, toPoint({ x: trap.x + 40, y: trap.y - 30 }), placed.updatedAt), (s) => s.armies.length === 0)
    expect(wiped.reports[0]).toMatchObject({ foe: { type: 'trap' }, lost: army({ warrior: 5 }) })
    expect(wiped.bands.some((band) => band.kind === 'keeper')).toBe(true)
  })

  it('donne le même résultat d’un coup ou seconde par seconde, alertes, poursuites et pièges compris', () => {
    const game = withEncampment({ ...richGame({}, { warrior: 3000 }), trial: true })
    const start = startMarch(game, toPoint(ENCAMPMENT.center), army({ warrior: 3000 }), game.updatedAt)
    const end = start.updatedAt + 30 * 60_000
    let stepped = start
    for (let t = start.updatedAt + 1000; t <= end; t += 1000) stepped = advance(stepped, t)
    const jumped = advance(start, end)
    expectSameGame(jumped, stepped)
    // Il s'est bien passé quelque chose : des batailles, et le piège du col.
    expect(jumped.reports.some((report) => report.foe.type === 'band')).toBe(true)
    expect(jumped.encampment.sprung).toContain(0)
  })

  it('se repeuple toutes les deux heures : ses chefs reviennent, et sa porte se referme', () => {
    const game = withEncampment(richGame())
    const resetAt = game.encampment.resetAt!
    const opened: GameState = {
      ...game,
      encampment: { ...game.encampment, gateOpen: true },
      bands: game.bands.filter((band) => band.kind !== 'warlord'),
    }
    const later = advance(opened, resetAt)
    expect(later.encampment).toEqual({ resetAt: resetAt + CAMP_RESPAWN_SECONDS * 1000, gateOpen: false, sprung: [] })
    expect(later.bands.filter((band) => band.kind === 'warlord')).toHaveLength(1)
    expect(later.bands.filter((band) => band.encampment)).toHaveLength(ENCAMPMENT_BANDS.length)
  })
})
