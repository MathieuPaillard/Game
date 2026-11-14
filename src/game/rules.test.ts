import { describe, expect, it } from 'vitest'
import { fight } from './battle.ts'
import {
  BAND_KINDS,
  BAND_SPAWN_SECONDS,
  BAND_SPOTS,
  MAX_BAND_LEVEL,
  MAX_BANDS,
  MAX_LEVEL,
  MONSTERS,
  RESOURCE_IDS,
  START_BANDS,
  START_LEVELS,
  START_RESOURCES,
  UNIT_IDS,
  WORLD,
  type Army,
  type BandKindId,
  type BuildingId,
  type CampId,
  type Point,
  type TechId,
} from './config.ts'
import {
  advance,
  aggroRadius,
  armySize,
  bandLevelAt,
  bandLoot,
  bandMonsters,
  bandsOnPath,
  checkDismiss,
  checkExpedition,
  checkResearch,
  checkTraining,
  checkUpgrade,
  distance,
  dismissTroops,
  emptyArmy,
  emptyResources,
  getBandKind,
  getBuilding,
  getCamp,
  getRace,
  getTech,
  getUnit,
  isStarving,
  marchDuration,
  maxExpeditions,
  maxTrainingBatch,
  newGame,
  productionPerHour,
  researchCost,
  startExpedition,
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
  type Target,
} from './rules.ts'

const HOUR = 60 * 60 * 1000
const T0 = Date.UTC(2026, 0, 1)

/**
 * Une partie aux ressources illimitées, et sans bande de monstres sur la carte (ni à venir) :
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
  }
}

function army(troops: Partial<Army>): Army {
  return { ...emptyArmy(), ...troops }
}

/** La même partie, avec certaines recherches déjà faites. */
function withTechs(game: GameState, techs: Partial<Record<TechId, number>>): GameState {
  return { ...game, techs: { ...game.techs, ...techs } }
}

/** Une partie qui démarre avec une quantité de nourriture et une armée données (et sans bandes). */
function withFood(food: number, troops: Partial<Army>): GameState {
  const game = newGame('humans', T0)
  return { ...game, resources: { ...game.resources, food }, troops: army(troops), bands: [], nextBandAt: null }
}

const toCamp = (camp: CampId): Target => ({ type: 'camp', camp })
const toBand = (band: number): Target => ({ type: 'band', band })

/** Installe une bande de monstres choisis, à l'endroit choisi. */
function withBand(
  game: GameState,
  position: Point,
  monsters: Monsters,
  level = 1,
  kind: BandKindId = 'wolves',
): { game: GameState; id: number } {
  const band: Band = { id: game.nextId, kind, level, position, monsters }
  return { game: { ...game, bands: [...game.bands, band], nextId: game.nextId + 1 }, id: band.id }
}

/** Le point situé à la fraction `t` de la route qui va de la cité jusqu'à `to`. */
function onRoad(to: Point, t: number): Point {
  const city = WORLD.city
  return { x: city.x + (to.x - city.x) * t, y: city.y + (to.y - city.y) * t }
}

function total(monsters: Monsters): number {
  return Object.values(monsters).reduce((sum, count) => sum + (count ?? 0), 0)
}

/** Des guerriers et des monstres de même force : après toutes les manches, personne n'a gagné. */
function stalemate(): { troops: Army; monsters: Monsters } {
  const warrior = getUnit('warrior')
  for (const monster of MONSTERS) {
    for (let a = 1; a <= 80; a++) {
      for (let m = 1; m <= 80; m++) {
        const outcome = fight(
          [{ family: 'warrior', attack: warrior.attack, health: warrior.health, count: a }],
          [{ family: monster.family, attack: monster.attack, health: monster.health, count: m }],
        )
        if (outcome.winner === 'none') return { troops: army({ warrior: a }), monsters: { [monster.id]: m } }
      }
    }
  }
  throw new Error('Aucune bataille sans vainqueur trouvée')
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
      resources: { food: 3000, wood: 3000, stone: 3000, gold: 1000, mana: 300 },
      levels: { ...START_LEVELS, castle: 5, barracks: 1, academy: 1 },
      techs: { ...base.techs, command: 1 },
      troops: army({ warrior: 60 }),
    }
    let start = startUpgrade(game, 'farm', T0)
    start = startResearch(start, 'agriculture', T0)
    start = startTraining(start, 'warrior', 5, T0)
    start = startExpedition(start, toCamp('wolfDen'), army({ warrior: 30 }), T0)
    start = startExpedition(start, toCamp('goblinCamp'), army({ warrior: 30 }), T0)
    const end = T0 + 3 * HOUR

    const oneShot = advance(start, end)
    let stepped = start
    for (let t = T0; t <= end; t += 1000) stepped = advance(stepped, t)

    expect(oneShot.techs.agriculture).toBe(1)
    expect(oneShot.reports.length).toBeGreaterThanOrEqual(2)
    expect(oneShot.bands).toHaveLength(MAX_BANDS)
    expect(stepped.levels).toEqual(oneShot.levels)
    expect(stepped.techs).toEqual(oneShot.techs)
    expect(stepped.troops).toEqual(oneShot.troops)
    expect(stepped.reports).toEqual(oneShot.reports)
    expect(stepped.bands).toEqual(oneShot.bands)
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

  it('les troupes en campagne mangent aussi', () => {
    const home = richGame({}, { warrior: 50 })
    const away = startExpedition(home, toCamp('wolfDen'), army({ warrior: 50 }), T0)
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
      const start = startExpedition(game, toCamp('goblinCamp'), army({ warrior: 60 }), T0)
      return advance(start, start.expeditions[0].arrivesAt).reports[0]
    }
    const hungry = attack(withFood(0, { warrior: 2060 }))
    const fed = attack(withFood(1e9, { warrior: 2060 }))
    expect(hungry.starving).toBe(true)
    expect(fed.starving).toBe(false)
    expect(hungry.lost.warrior).toBeGreaterThan(fed.lost.warrior)
  })

  it('une bataille affamée donne le même résultat d’un coup ou seconde par seconde', () => {
    // Les réserves s'épuisent pendant la marche : l'armée arrive affamée.
    const start = startExpedition(withFood(50, { warrior: 2060 }), toCamp('goblinCamp'), army({ warrior: 60 }), T0)
    const end = T0 + 10 * 60 * 1000
    const oneShot = advance(start, end)
    let stepped = start
    for (let t = T0; t <= end; t += 1000) stepped = advance(stepped, t)
    expect(oneShot.reports[0].starving).toBe(true)
    expect(stepped.reports).toEqual(oneShot.reports)
    expect(stepped.troops).toEqual(oneShot.troops)
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

describe('expéditions', () => {
  it('une grande armée bat le camp, puis rentre avec le butin', () => {
    const camp = getCamp('wolfDen')
    const start = startExpedition(richGame({}, { warrior: 1000 }), toCamp('wolfDen'), army({ warrior: 1000 }), T0)
    expect(start.troops.warrior).toBe(0)

    const arrived = advance(start, start.expeditions[0].arrivesAt)
    expect(arrived.reports[0]).toMatchObject({ foe: toCamp('wolfDen'), ambush: false, victory: true, loot: camp.loot })
    expect(arrived.troops.warrior).toBe(0)

    const back = advance(start, start.expeditions[0].returnsAt)
    const survivors = 1000 - arrived.reports[0].lost.warrior
    expect(back.expeditions).toEqual([])
    expect(back.troops.warrior).toBe(survivors)
    // La nourriture dépend aussi de l'entretien de l'armée : on vérifie le butin sur les autres ressources.
    const hours = (back.updatedAt - start.updatedAt) / HOUR
    for (const id of RESOURCE_IDS.filter((r) => r !== 'food')) {
      const produced = productionPerHour(start)[id] * hours
      expect(back.resources[id] - start.resources[id] - produced).toBeCloseTo(camp.loot[id] ?? 0)
    }
  })

  it('le rapport contient le journal du combat, manche par manche', () => {
    const start = startExpedition(richGame({}, { warrior: 20, archer: 10 }), toCamp('goblinCamp'), army({ warrior: 20, archer: 10 }), T0)
    const report = advance(start, start.expeditions[0].arrivesAt).reports[0]
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

  it('une armée anéantie ne rentre pas et ne rapporte rien', () => {
    const start = startExpedition(richGame({}, { archer: 1 }), toCamp('trollLair'), army({ archer: 1 }), T0)
    const after = advance(start, start.expeditions[0].arrivesAt)
    expect(after.expeditions).toEqual([])
    expect(after.reports[0]).toMatchObject({ victory: false, loot: {} })
    expect(armySize(after.troops)).toBe(0)
  })

  it('sans Commandement, une seule armée en campagne à la fois', () => {
    const start = startExpedition(richGame({}, { warrior: 20 }), toCamp('wolfDen'), army({ warrior: 10 }), T0)
    expect(checkExpedition(start, toCamp('goblinCamp'), army({ warrior: 10 }))).toEqual({
      ok: false,
      reason: 'Une armée est déjà en campagne',
    })
  })

  it('le Commandement permet plusieurs armées en campagne, vers des camps différents', () => {
    let game = withTechs(richGame({}, { warrior: 90 }), { command: 2 })
    expect(maxExpeditions(game)).toBe(3)
    game = startExpedition(game, toCamp('wolfDen'), army({ warrior: 30 }), T0)
    expect(checkExpedition(game, toCamp('wolfDen'), army({ warrior: 10 }))).toEqual({
      ok: false,
      reason: 'Une armée est déjà en route vers ce camp',
    })
    game = startExpedition(game, toCamp('goblinCamp'), army({ warrior: 30 }), T0)
    game = startExpedition(game, toCamp('hauntedRuins'), army({ warrior: 20 }), T0)
    expect(game.expeditions).toHaveLength(3)
    expect(checkExpedition(game, toCamp('trollLair'), army({ warrior: 10 }))).toEqual({
      ok: false,
      reason: 'Tes 3 armées sont déjà en campagne',
    })
    // Les trois batailles ont lieu, chacune à son heure.
    const later = advance(game, T0 + HOUR)
    expect(later.reports.map((r) => (r.foe.type === 'camp' ? r.foe.camp : '')).sort()).toEqual([
      'goblinCamp',
      'hauntedRuins',
      'wolfDen',
    ])
    expect(later.expeditions).toEqual([])
  })

  it('la Marche forcée raccourcit la marche', () => {
    const lair = getCamp('trollLair').position
    expect(marchDuration(withTechs(richGame(), { forcedMarch: 2 }), lair)).toBeLessThan(marchDuration(richGame(), lair))
  })

  it('on ne peut pas envoyer plus de troupes qu’on en a', () => {
    const game = richGame({}, { warrior: 5 })
    expect(checkExpedition(game, toCamp('wolfDen'), army({ warrior: 6 })).ok).toBe(false)
    expect(checkExpedition(game, toCamp('wolfDen'), army({})).ok).toBe(false)
  })
})

describe('les bandes de monstres', () => {
  it('une nouvelle partie commence avec quelques bandes, puis la carte se remplit', () => {
    const game = newGame('humans', T0)
    expect(game.bands).toHaveLength(START_BANDS)
    for (const band of game.bands) {
      expect(BAND_SPOTS).toContainEqual(band.position)
      const base = bandLevelAt(band.position)
      expect([base, Math.min(MAX_BAND_LEVEL, base + 1)]).toContain(band.level)
      expect(getBandKind(band.kind).minLevel).toBeLessThanOrEqual(band.level)
      expect(band.monsters).toEqual(bandMonsters(band.kind, band.level))
    }
    // Une bande par endroit.
    expect(new Set(game.bands.map((band) => `${band.position.x},${band.position.y}`)).size).toBe(START_BANDS)

    const full = advance(game, T0 + (MAX_BANDS - START_BANDS) * BAND_SPAWN_SECONDS * 1000)
    expect(full.bands).toHaveLength(MAX_BANDS)
    expect(full.nextBandAt).toBeNull()
  })

  it('les bandes sont tirées au sort, mais toujours de la même façon pour une même graine', () => {
    expect(newGame('humans', T0, 7).bands).toEqual(newGame('orcs', T0 + 5000, 7).bands)
    expect(newGame('humans', T0, 7).bands).not.toEqual(newGame('humans', T0, 8).bands)
  })

  it('plus une bande est loin de la cité, plus elle est forte, et plus sa zone d’aggro est grande', () => {
    const spots = [...BAND_SPOTS].sort((a, b) => distance(WORLD.city, a) - distance(WORLD.city, b))
    expect(bandLevelAt(spots[0])).toBe(1)
    for (let i = 1; i < spots.length; i++) {
      expect(bandLevelAt(spots[i])).toBeGreaterThanOrEqual(bandLevelAt(spots[i - 1]))
    }
    for (let level = 2; level <= MAX_BAND_LEVEL; level++) {
      expect(aggroRadius(level)).toBeGreaterThan(aggroRadius(level - 1))
      for (const kind of BAND_KINDS) {
        expect(total(bandMonsters(kind.id, level))).toBeGreaterThan(total(bandMonsters(kind.id, level - 1)))
      }
    }
  })

  it('aucune zone d’aggro ne couvre la cité', () => {
    for (const spot of BAND_SPOTS) {
      const radius = aggroRadius(Math.min(MAX_BAND_LEVEL, bandLevelAt(spot) + 1))
      expect(distance(WORLD.city, spot)).toBeGreaterThan(radius + 100)
    }
  })

  it('une bande attaque l’armée qui entre dans sa zone d’aggro', () => {
    const den = getCamp('wolfDen')
    const { game } = withBand(richGame({}, { warrior: 1000 }), onRoad(den.position, 0.5), { wolf: 1 })
    const start = startExpedition(game, toCamp('wolfDen'), army({ warrior: 1000 }), T0)
    const { arrivesAt, returnsAt } = start.expeditions[0]
    // L'armée entre dans la zone un rayon avant d'atteindre la bande, au milieu de la route.
    const entry = 0.5 - aggroRadius(1) / distance(WORLD.city, den.position)
    const ambushAt = T0 + entry * (arrivesAt - T0)

    expect(advance(start, ambushAt - 1).reports).toEqual([])
    const ambushed = advance(start, ambushAt + 1)
    expect(ambushed.reports[0]).toMatchObject({
      ambush: true,
      victory: true,
      foe: { type: 'band', kind: 'wolves', level: 1 },
      loot: bandLoot('wolves', 1),
    })
    expect(ambushed.reports[0].at).toBeCloseTo(ambushAt, 0)
    expect(ambushed.bands).toEqual([])

    // Victorieuse, l'armée poursuit jusqu'au camp, puis rentre avec les deux butins.
    const back = advance(start, returnsAt)
    expect(back.reports.map((r) => r.ambush)).toEqual([false, true])
    expect(back.expeditions).toEqual([])
    const hours = (back.updatedAt - start.updatedAt) / HOUR
    for (const id of RESOURCE_IDS.filter((r) => r !== 'food')) {
      const produced = productionPerHour(start)[id] * hours
      const loot = (den.loot[id] ?? 0) + (bandLoot('wolves', 1)[id] ?? 0)
      expect(back.resources[id] - start.resources[id] - produced).toBeCloseTo(loot)
    }
  })

  it('une bande trop forte anéantit l’armée en chemin, et reste sur place', () => {
    const den = getCamp('wolfDen')
    const { game } = withBand(richGame({}, { archer: 1 }), onRoad(den.position, 0.5), { troll: 50 }, 3, 'trolls')
    const start = startExpedition(game, toCamp('wolfDen'), army({ archer: 1 }), T0)
    const after = advance(start, start.expeditions[0].returnsAt)
    expect(after.expeditions).toEqual([])
    expect(after.reports).toHaveLength(1)
    expect(after.reports[0]).toMatchObject({ ambush: true, victory: false, loot: {} })
    expect(after.bands).toHaveLength(1)
    expect(armySize(after.troops)).toBe(0)
  })

  it('repoussée en chemin, l’armée fait demi-tour et la bande garde ses pertes', () => {
    const { troops, monsters } = stalemate()
    const den = getCamp('wolfDen')
    const { game } = withBand(richGame({}, troops), onRoad(den.position, 0.5), monsters)
    const start = startExpedition(game, toCamp('wolfDen'), troops, T0)
    const entry = 0.5 - aggroRadius(1) / distance(WORLD.city, den.position)
    const ambushAt = T0 + entry * (start.expeditions[0].arrivesAt - T0)
    const turned = advance(start, ambushAt + 1)
    const report = turned.reports[0]
    expect(report).toMatchObject({ ambush: true, victory: false })
    const expedition = turned.expeditions[0]
    expect(expedition.returning).toBe(true)
    expect(expedition.arrivesAt).toBe(report.at)
    // Le retour dure autant que l'aller jusqu'au lieu de l'embuscade.
    expect(expedition.returnsAt).toBeCloseTo(2 * report.at - T0, 0)
    expect(total(turned.bands[0].monsters)).toBeLessThan(total(monsters))

    // Elle rentre sans autre bataille, avec ses survivants.
    const home = advance(start, expedition.returnsAt)
    expect(home.reports).toHaveLength(1)
    expect(home.expeditions).toEqual([])
    expect(home.troops).toEqual(expedition.troops)
  })

  it('vaincre une bande rapporte son butin, puis une autre bande vient prendre sa place', () => {
    const spot = BAND_SPOTS[0]
    const { game, id } = withBand(richGame({}, { warrior: 1000 }), spot, { wolf: 1 }, 2, 'goblins')
    const start = startExpedition(game, toBand(id), army({ warrior: 1000 }), T0)
    const { arrivesAt, returnsAt } = start.expeditions[0]
    expect(arrivesAt - T0).toBe(marchDuration(game, spot))

    const arrived = advance(start, arrivesAt)
    expect(arrived.reports[0]).toMatchObject({
      ambush: false,
      victory: true,
      foe: { type: 'band', kind: 'goblins', level: 2 },
      loot: bandLoot('goblins', 2),
    })
    expect(arrived.bands).toEqual([])
    // La carte n'attendait plus de bande : une autre est en chemin.
    expect(arrived.nextBandAt).toBe(arrivesAt + BAND_SPAWN_SECONDS * 1000)
    expect(advance(start, arrivesAt + BAND_SPAWN_SECONDS * 1000).bands).toHaveLength(1)

    const back = advance(start, returnsAt)
    expect(back.troops.warrior).toBe(1000 - arrived.reports[0].lost.warrior)
    expect(back.resources.gold - start.resources.gold).toBeGreaterThanOrEqual(bandLoot('goblins', 2).gold ?? 0)
  })

  it('si la bande a disparu à son arrivée, l’armée rentre sans combattre', () => {
    const { game, id } = withBand(richGame({}, { warrior: 10 }), BAND_SPOTS[0], { wolf: 1 })
    const start = startExpedition(game, toBand(id), army({ warrior: 10 }), T0)
    const vanished = { ...start, bands: [] }
    const arrived = advance(vanished, start.expeditions[0].arrivesAt)
    expect(arrived.reports).toEqual([])
    expect(arrived.expeditions[0].returning).toBe(true)
    expect(advance(vanished, start.expeditions[0].returnsAt).troops.warrior).toBe(10)
  })

  it('une seule armée à la fois vers une même bande, et seulement si elle est là', () => {
    const { game, id } = withBand(withTechs(richGame({}, { warrior: 20 }), { command: 1 }), BAND_SPOTS[0], { wolf: 1 })
    const sent = startExpedition(game, toBand(id), army({ warrior: 10 }), T0)
    expect(checkExpedition(sent, toBand(id), army({ warrior: 10 }))).toEqual({
      ok: false,
      reason: 'Une armée est déjà en route vers cette bande',
    })
    expect(checkExpedition(sent, toBand(id + 99), army({ warrior: 10 }))).toEqual({
      ok: false,
      reason: 'Cette bande n’est plus là',
    })
  })

  it('annonce les zones d’aggro sur le chemin, dans l’ordre où l’armée les traversera', () => {
    const den = getCamp('wolfDen').position
    let game = richGame()
    const far = withBand(game, onRoad(den, 0.7), { wolf: 1 })
    const near = withBand(far.game, onRoad(den, 0.3), { wolf: 1 })
    // Une bande de l'autre côté de la cité, loin de la route.
    const behind = withBand(near.game, onRoad(den, -0.8), { wolf: 1 })
    game = behind.game
    expect(bandsOnPath(game, toCamp('wolfDen')).map((band) => band.id)).toEqual([near.id, far.id])
    // En visant une bande, on ne compte pas sa propre zone.
    expect(bandsOnPath(game, toBand(far.id)).map((band) => band.id)).toEqual([near.id])
  })

  it('une nouvelle bande ne surgit jamais sur le chemin d’une armée', () => {
    for (let seed = 1; seed <= 100; seed++) {
      const game = { ...richGame({}, { warrior: 10 }), seed, nextBandAt: T0 + 1000 }
      const start = startExpedition(game, toCamp('trollLair'), army({ warrior: 10 }), T0)
      const later = advance(start, T0 + 1000)
      expect(later.bands).toHaveLength(1)
      expect(bandsOnPath(later, toCamp('trollLair'))).toEqual([])
    }
  })

  it('une embuscade donne le même résultat d’un coup ou seconde par seconde', () => {
    const den = getCamp('wolfDen')
    const { game } = withBand(richGame({}, { warrior: 300 }), onRoad(den.position, 0.5), { wolf: 20 })
    const start = startExpedition({ ...game, nextBandAt: T0 + 5000 }, toCamp('wolfDen'), army({ warrior: 300 }), T0)
    const end = T0 + 10 * 60 * 1000
    const oneShot = advance(start, end)
    let stepped = start
    for (let t = T0; t <= end; t += 1000) stepped = advance(stepped, t)
    expect(oneShot.reports.some((report) => report.ambush)).toBe(true)
    expect(stepped.reports).toEqual(oneShot.reports)
    expect(stepped.bands).toEqual(oneShot.bands)
    expect(stepped.troops).toEqual(oneShot.troops)
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
      const start = startExpedition(game, toCamp('goblinCamp'), army({ warrior: 40 }), T0)
      return advance(start, start.expeditions[0].arrivesAt).reports[0]
    }
    const plain = attack(richGame({}, { warrior: 40 }))
    const strong = attack(withTechs(richGame({}, { warrior: 40 }), { forge: 5, armor: 5 }))
    expect(strong.lost.warrior).toBeLessThan(plain.lost.warrior)
  })
})
