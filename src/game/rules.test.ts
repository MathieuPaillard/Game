import { describe, expect, it } from 'vitest'
import {
  BAND_KINDS,
  BAND_SPAWN_SECONDS,
  BAND_SPOTS,
  BATTLE_ROUND_SECONDS,
  MAX_BAND_LEVEL,
  MAX_BANDS,
  MAX_LEVEL,
  MAX_NODES,
  NODE_SPAWN_SECONDS,
  NODE_SPOTS,
  PATROL_RADIUS,
  PATROL_SPEED,
  RESOURCE_IDS,
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
  type Point,
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
  checkDismiss,
  checkMarch,
  checkOrder,
  checkResearch,
  checkTraining,
  checkUpgrade,
  dismissTroops,
  distance,
  emptyArmy,
  emptyResources,
  getBandKind,
  getBuilding,
  getCamp,
  getRace,
  getTech,
  getUnit,
  isStarving,
  levelAt,
  loadSize,
  marchDuration,
  marchSpeed,
  maxArmies,
  maxTrainingBatch,
  newGame,
  nodeAmount,
  orderArmy,
  patrolDistance,
  patrolLoop,
  productionPerHour,
  researchCost,
  startMarch,
  startResearch,
  startTraining,
  startUpgrade,
  trainingCost,
  trainingDuration,
  upgradeCost,
  upgradeDuration,
  upkeepPerHour,
  type Band,
  type GameState,
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
      levels: { ...START_LEVELS, castle: 5, barracks: 1, academy: 1 },
      techs: { ...base.techs, command: 2 },
      troops: army({ warrior: 95 }),
    }
    let start = startUpgrade(game, 'farm', T0)
    start = startResearch(start, 'agriculture', T0)
    start = startTraining(start, 'warrior', 5, T0)
    // Trois armées dehors : vers un camp, vers un gisement, et contre une bande.
    start = startMarch(start, toCamp('wolfDen'), army({ warrior: 30 }), T0)
    start = startMarch(start, toNode(start.nodes[0].id), army({ warrior: 30 }), T0)
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
    expect(next.construction).toEqual({
      building: 'farm',
      targetLevel: 2,
      startedAt: T0,
      endsAt: T0 + upgradeDuration(game, farm, 2),
    })
  })

  it('les Humains construisent plus vite', () => {
    const farm = getBuilding('farm')
    expect(upgradeDuration(newGame('humans', T0), farm, 3)).toBeLessThan(
      upgradeDuration(newGame('elves', T0), farm, 3),
    )
  })

  it('termine le chantier à l’heure prévue, puis produit au nouveau niveau', () => {
    const start = startUpgrade(richGame({ castle: 5 }), 'farm', T0)
    const endsAt = start.construction!.endsAt
    expect(advance(start, endsAt - 1).levels.farm).toBe(1)

    const after = advance(start, endsAt + HOUR)
    expect(after.levels.farm).toBe(2)
    expect(after.construction).toBeNull()
    const expected =
      productionPerHour(start).food * ((endsAt - T0) / HOUR) + productionPerHour(after).food
    expect(after.resources.food - start.resources.food).toBeCloseTo(expected)
  })
})

describe('conditions de construction', () => {
  it('un seul chantier à la fois', () => {
    const busy = startUpgrade(richGame({ castle: 5 }), 'farm', T0)
    expect(checkUpgrade(busy, 'sawmill')).toEqual({ ok: false, reason: 'Un chantier est déjà en cours' })
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
    expect(loadSize(full.armies[0].load)).toBeCloseTo(carryCapacity(troops))

    const home = runUntil(full, (s) => s.armies.length === 0)
    const produced = productionPerHour(start).wood * ((home.updatedAt - start.updatedAt) / HOUR)
    expect(home.resources.wood - start.resources.wood - produced).toBeCloseTo(carryCapacity(troops))
    expect(home.nodes[0].remaining).toBeCloseTo(1e6 - carryCapacity(troops))
  })

  it('rappelée en pleine récolte, l’armée rapporte ce qu’elle a déjà ramassé', () => {
    const troops = army({ warrior: 10 })
    const { game, id } = withNode(richGame({}, troops), nearCity(200), 'stone', 1e6)
    const gathering = runUntil(startMarch(game, toNode(id), troops, T0), (s) => s.armies[0]?.status === 'gathering')
    const busy = advance(gathering, gathering.updatedAt + 10_000)
    const picked = loadSize(busy.armies[0].load)
    expect(picked).toBeGreaterThan(0)
    expect(picked).toBeLessThan(carryCapacity(troops))
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
