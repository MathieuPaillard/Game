import { describe, expect, it } from 'vitest'
import {
  MAX_LEVEL,
  RESOURCE_IDS,
  START_LEVELS,
  START_RESOURCES,
  UNIT_IDS,
  type Army,
  type BuildingId,
  type TechId,
} from './config'
import {
  advance,
  armySize,
  checkDismiss,
  checkExpedition,
  checkResearch,
  checkTraining,
  checkUpgrade,
  dismissTroops,
  emptyArmy,
  emptyResources,
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
  type GameState,
} from './rules'

const HOUR = 60 * 60 * 1000
const T0 = Date.UTC(2026, 0, 1)

/** Une partie aux ressources illimitées, pour tester les règles sans dépendre de l'équilibrage. */
function richGame(levels: Partial<Record<BuildingId, number>> = {}, troops: Partial<Army> = {}): GameState {
  const game = newGame('humans', T0)
  const resources = emptyResources()
  for (const id of RESOURCE_IDS) resources[id] = 1e9
  return { ...game, resources, levels: { ...game.levels, ...levels }, troops: { ...game.troops, ...troops } }
}

function army(troops: Partial<Army>): Army {
  return { ...emptyArmy(), ...troops }
}

/** La même partie, avec certaines recherches déjà faites. */
function withTechs(game: GameState, techs: Partial<Record<TechId, number>>): GameState {
  return { ...game, techs: { ...game.techs, ...techs } }
}

/** Une partie qui démarre avec une quantité de nourriture et une armée données. */
function withFood(food: number, troops: Partial<Army>): GameState {
  const game = newGame('humans', T0)
  return { ...game, resources: { ...game.resources, food }, troops: army(troops) }
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
    start = startExpedition(start, 'wolfDen', army({ warrior: 30 }), T0)
    start = startExpedition(start, 'goblinCamp', army({ warrior: 30 }), T0)
    const end = T0 + 3 * HOUR

    const oneShot = advance(start, end)
    let stepped = start
    for (let t = T0; t <= end; t += 1000) stepped = advance(stepped, t)

    expect(oneShot.techs.agriculture).toBe(1)
    expect(oneShot.reports).toHaveLength(2)
    expect(stepped.levels).toEqual(oneShot.levels)
    expect(stepped.techs).toEqual(oneShot.techs)
    expect(stepped.troops).toEqual(oneShot.troops)
    expect(stepped.reports).toEqual(oneShot.reports)
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
    const away = startExpedition(home, 'wolfDen', army({ warrior: 50 }), T0)
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
      const start = startExpedition(game, 'goblinCamp', army({ warrior: 60 }), T0)
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
    const start = startExpedition(withFood(50, { warrior: 2060 }), 'goblinCamp', army({ warrior: 60 }), T0)
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
    const start = startExpedition(richGame({}, { warrior: 1000 }), 'wolfDen', army({ warrior: 1000 }), T0)
    expect(start.troops.warrior).toBe(0)

    const arrived = advance(start, start.expeditions[0].arrivesAt)
    expect(arrived.reports[0]).toMatchObject({ camp: 'wolfDen', victory: true, loot: camp.loot })
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
    const start = startExpedition(richGame({}, { warrior: 20, archer: 10 }), 'goblinCamp', army({ warrior: 20, archer: 10 }), T0)
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
    const start = startExpedition(richGame({}, { archer: 1 }), 'trollLair', army({ archer: 1 }), T0)
    const after = advance(start, start.expeditions[0].arrivesAt)
    expect(after.expeditions).toEqual([])
    expect(after.reports[0]).toMatchObject({ victory: false, loot: {} })
    expect(armySize(after.troops)).toBe(0)
  })

  it('sans Commandement, une seule armée en campagne à la fois', () => {
    const start = startExpedition(richGame({}, { warrior: 20 }), 'wolfDen', army({ warrior: 10 }), T0)
    expect(checkExpedition(start, 'goblinCamp', army({ warrior: 10 }))).toEqual({
      ok: false,
      reason: 'Une armée est déjà en campagne',
    })
  })

  it('le Commandement permet plusieurs armées en campagne, vers des camps différents', () => {
    let game = withTechs(richGame({}, { warrior: 90 }), { command: 2 })
    expect(maxExpeditions(game)).toBe(3)
    game = startExpedition(game, 'wolfDen', army({ warrior: 30 }), T0)
    expect(checkExpedition(game, 'wolfDen', army({ warrior: 10 }))).toEqual({
      ok: false,
      reason: 'Une armée est déjà en route vers ce camp',
    })
    game = startExpedition(game, 'goblinCamp', army({ warrior: 30 }), T0)
    game = startExpedition(game, 'hauntedRuins', army({ warrior: 20 }), T0)
    expect(game.expeditions).toHaveLength(3)
    expect(checkExpedition(game, 'trollLair', army({ warrior: 10 }))).toEqual({
      ok: false,
      reason: 'Tes 3 armées sont déjà en campagne',
    })
    // Les trois batailles ont lieu, chacune à son heure.
    const later = advance(game, T0 + HOUR)
    expect(later.reports.map((r) => r.camp).sort()).toEqual(['goblinCamp', 'hauntedRuins', 'wolfDen'])
    expect(later.expeditions).toEqual([])
  })

  it('la Marche forcée raccourcit la marche', () => {
    const camp = getCamp('trollLair')
    expect(marchDuration(withTechs(richGame(), { forcedMarch: 2 }), camp)).toBeLessThan(
      marchDuration(richGame(), camp),
    )
  })

  it('on ne peut pas envoyer plus de troupes qu’on en a', () => {
    const game = richGame({}, { warrior: 5 })
    expect(checkExpedition(game, 'wolfDen', army({ warrior: 6 })).ok).toBe(false)
    expect(checkExpedition(game, 'wolfDen', army({})).ok).toBe(false)
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
      const start = startExpedition(game, 'goblinCamp', army({ warrior: 40 }), T0)
      return advance(start, start.expeditions[0].arrivesAt).reports[0]
    }
    const plain = attack(richGame({}, { warrior: 40 }))
    const strong = attack(withTechs(richGame({}, { warrior: 40 }), { forge: 5, armor: 5 }))
    expect(strong.lost.warrior).toBeLessThan(plain.lost.warrior)
  })
})
