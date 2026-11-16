import { describe, expect, it } from 'vitest'
import {
  BAND_KINDS,
  BAND_SPAWN_SECONDS,
  BAND_SPOTS,
  BATTLE_ROUND_SECONDS,
  HEROES,
  HERO_MAX_LEVEL,
  MAX_BAND_LEVEL,
  MAX_BANDS,
  MAX_LEVEL,
  MAX_NODES,
  NODE_SPAWN_SECONDS,
  NODE_SPOTS,
  PATROL_RADIUS,
  PATROL_SPEED,
  QUESTS,
  RESOURCE_IDS,
  SECOND_CONSTRUCTION_CASTLE_LEVEL,
  SKILL_MAX_LEVEL,
  SPELLS,
  START_BANDS,
  START_LEVELS,
  START_NODES,
  START_RESOURCES,
  UNIT_IDS,
  WORLD,
  type Army,
  type BandKindId,
  type BuildingId,
  type CampId,
  type HeroId,
  type MonsterId,
  type Point,
  type QuestDef,
  type ResourceId,
  type TechId,
} from './config.ts'
import {
  advance,
  aggroRadius,
  armySize,
  bandLoot,
  bandMonsters,
  bandPosition,
  bandsNearPath,
  carryCapacity,
  castSpell,
  checkCast,
  checkClaim,
  checkDismiss,
  checkMarch,
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
  emptyArmy,
  emptyResources,
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
  questDone,
  questProgress,
  recruitHero,
  researchCost,
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
function richGame(levels: Partial<Record<BuildingId, number>> = {}, troops: Partial<Army> = {}): GameState {
  const game = newGame('humans', T0)
  const resources = emptyResources()
  for (const id of RESOURCE_IDS) resources[id] = 1e9
  return {
    ...game,
    resources,
    levels: { ...game.levels, ...levels },
    troops: { ...game.troops, ...troops },
    bands: [],
    nextBandAt: null,
    nodes: [],
    nextNodeAt: null,
  }
}

function army(troops: Partial<Army>): Army {
  return { ...emptyArmy(), ...troops }
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
  const band: Band = { id: game.nextId, kind, level, home, monsters, phase: 0, since: game.updatedAt, direction: 1 }
  return { game: { ...game, bands: [...game.bands, band], nextId: game.nextId + 1 }, id: band.id }
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
    const game = newGame('humans', T0)
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
    expect(oneShot.bands).toHaveLength(MAX_BANDS)
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

  it('refuse quand les ressources manquent', () => {
    const poor = { ...newGame('humans', T0), resources: emptyResources() }
    expect(checkUpgrade(poor, 'castle')).toEqual({ ok: false, reason: 'Ressources insuffisantes' })
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

  it('limite le nombre de troupes par entraînement', () => {
    const game = richGame({ barracks: 1 })
    expect(checkTraining(game, 'warrior', maxTrainingBatch(game)).ok).toBe(true)
    expect(checkTraining(game, 'warrior', maxTrainingBatch(game) + 1).ok).toBe(false)
  })
})

describe('entretien des troupes', () => {
  it('les troupes mangent de la nourriture chaque heure', () => {
    const game = { ...newGame('humans', T0), troops: army({ warrior: 100 }) }
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
    const attack = (game: GameState) => {
      const start = startMarch(game, toCamp('goblinCamp'), army({ warrior: 60 }), T0)
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
    const fighting = runUntil(start, (s) => s.battles[0]?.rounds.length === 1)
    const fled = orderArmy(fighting, fighting.armies[0].id, CITY_TARGET, fighting.updatedAt)
    expect(fled.battles).toEqual([])
    expect(fled.reports[0]).toMatchObject({ outcome: 'retreat', loot: {} })
    expect(fled.reports[0].rounds).toHaveLength(1)
    // La bande garde ses pertes et reprend sa ronde…
    expect(total(fled.bands[0].monsters)).toBeLessThan(40)
    expect(fled.bands[0].since).toBe(fighting.updatedAt)
    // … sans plus attaquer l'armée, qui rentre à la cité.
    const home = runUntil(fled, (s) => s.armies.length === 0)
    expect(home.reports).toHaveLength(1)
    expect(home.troops.warrior).toBe(200 - fled.reports[0].lost.warrior)
  })
})

describe('les bandes de monstres', () => {
  it('une nouvelle partie commence avec quelques bandes, puis la carte se remplit', () => {
    const game = newGame('humans', T0)
    expect(game.bands).toHaveLength(START_BANDS)
    for (const band of game.bands) {
      expect(BAND_SPOTS).toContainEqual(band.home)
      const base = levelAt(band.home)
      expect([base, Math.min(MAX_BAND_LEVEL, base + 1)]).toContain(band.level)
      expect(getBandKind(band.kind).minLevel).toBeLessThanOrEqual(band.level)
      expect(band.monsters).toEqual(bandMonsters(band.kind, band.level))
    }
    // Un repaire par endroit.
    expect(new Set(game.bands.map((band) => `${band.home.x},${band.home.y}`)).size).toBe(START_BANDS)

    const full = advance(game, T0 + (MAX_BANDS - START_BANDS) * BAND_SPAWN_SECONDS * 1000)
    expect(full.bands).toHaveLength(MAX_BANDS)
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

  it('aucune ronde ne passe assez près de la cité pour l’attaquer', () => {
    for (const spot of BAND_SPOTS) {
      const radius = aggroRadius(Math.min(MAX_BAND_LEVEL, levelAt(spot) + 1))
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
    const { game, id } = withBand(richGame({}, { archer: 1 }), nearCity(350), { troll: 5 }, 3, 'trolls')
    const after = runUntil(startMarch(game, toBand(id), army({ archer: 1 }), T0), (s) => s.reports.length > 0)
    expect(after.reports[0].outcome).toBe('defeat')
    expect(after.bands[0]).toMatchObject({ id, since: after.reports[0].at })
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

describe('les héros', () => {
  it('on recrute un héros avec ses ressources, à partir d’un niveau du Château', () => {
    const ysolde = getHeroDef('ysolde')
    expect(checkRecruit(richGame({ castle: ysolde.castleLevel - 1 }), 'ysolde')).toEqual({
      ok: false,
      reason: `Nécessite le Château niveau ${ysolde.castleLevel}`,
    })
    const poor = { ...richGame({ castle: ysolde.castleLevel }), resources: emptyResources() }
    expect(checkRecruit(poor, 'ysolde')).toEqual({ ok: false, reason: 'Ressources insuffisantes' })

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
    const firstRound = (game: GameState) => {
      const start = startMarch(game, toCamp('trollLair'), troops, T0, 'ysolde')
      const fighting = runUntil(start, (s) => (s.battles[0]?.rounds.length ?? 0) > 0)
      return fighting.battles[0]
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
    expect(camp.stats).toMatchObject({ victories: 2, bandsDefeated: 1 })

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
    expect(checkCast(poor, 'harvest')).toEqual({ ok: false, reason: 'Ressources insuffisantes' })
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
    const firstRound = (state: GameState) => {
      const start = startMarch(state, toCamp('trollLair'), troops, T0)
      return runUntil(start, (s) => (s.battles[0]?.rounds.length ?? 0) > 0).battles[0]
    }
    const plain = firstRound(game)
    const furious = firstRound(castSpell(game, 'fury', T0))
    expect(furious.rounds[0].dealt / plain.rounds[0].dealt).toBeCloseTo(1.15, 1)
    const stone = firstRound(castSpell(game, 'stoneskin', T0))
    expect(stone.healthFactor).toBeCloseTo(plain.healthFactor + 0.15)
    expect(marchSpeed(castSpell(game, 'tailwind', T0))).toBeCloseTo(marchSpeed(game) / (1 - 0.2))
  })

  it('chaque sort a un niveau de Tour, un coût et une durée', () => {
    for (const spell of SPELLS) {
      expect(spell.towerLevel).toBeGreaterThanOrEqual(1)
      expect(spell.durationSeconds).toBeGreaterThan(0)
      expect(Object.keys(spell.cost).length).toBeGreaterThan(0)
    }
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
