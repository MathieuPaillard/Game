import { describe, expect, it } from 'vitest'
import { parseAction, performAction, type Action } from './actions.ts'
import { RESOURCE_IDS, type Army, type BuildingId } from './config.ts'
import {
  emptyArmy,
  emptyResources,
  getBuilding,
  learnSkill,
  newGame,
  orderArmy,
  recruitHero,
  startMarch,
  startResearch,
  startTraining,
  startUpgrade,
  upgradeDuration,
  type GameState,
} from './rules.ts'

const T0 = Date.UTC(2026, 0, 1)

/** Une partie aux ressources illimitées, pour tester sans dépendre de l'équilibrage. */
function richGame(levels: Partial<Record<BuildingId, number>> = {}, troops: Partial<Army> = {}): GameState {
  const game = newGame('humans', T0)
  const resources = emptyResources()
  for (const id of RESOURCE_IDS) resources[id] = 1e9
  return { ...game, resources, levels: { ...game.levels, ...levels }, troops: { ...game.troops, ...troops } }
}

function army(troops: Partial<Army>): Army {
  return { ...emptyArmy(), ...troops }
}

describe('parseAction', () => {
  it('accepte chaque ordre bien formé', () => {
    const actions: Action[] = [
      { type: 'upgrade', building: 'farm' },
      { type: 'research', tech: 'forge' },
      { type: 'train', unit: 'archer', count: 12 },
      { type: 'march', target: { type: 'camp', camp: 'wolfDen' }, troops: army({ warrior: 5 }) },
      { type: 'march', target: { type: 'band', band: 3 }, troops: army({ archer: 2 }) },
      { type: 'march', target: { type: 'node', node: 4 }, troops: army({ rider: 6 }) },
      { type: 'march', target: { type: 'point', x: 120.5, y: 900 }, troops: army({ mage: 1 }) },
      { type: 'march', target: { type: 'camp', camp: 'wolfDen' }, troops: army({ warrior: 5 }), hero: 'ysolde' },
      { type: 'recruit', hero: 'durgan' },
      { type: 'skill', hero: 'thalia', skill: 'lightning' },
      { type: 'order', army: 7, target: { type: 'city' } },
      { type: 'order', army: 7, target: { type: 'band', band: 2 } },
      { type: 'dismiss', troops: army({ mage: 2 }) },
    ]
    // Comme s'ils arrivaient du réseau : transformés en texte, puis relus.
    for (const action of actions) expect(parseAction(JSON.parse(JSON.stringify(action)))).toEqual(action)
  })

  it('une armée sans héros peut le dire avec null', () => {
    const target = { type: 'camp', camp: 'wolfDen' }
    expect(parseAction({ type: 'march', target, troops: { warrior: 1 }, hero: null })).toEqual({
      type: 'march',
      target,
      troops: army({ warrior: 1 }),
    })
  })

  it('complète une armée : un type de troupe absent compte pour zéro', () => {
    expect(parseAction({ type: 'dismiss', troops: { rider: 3 } })).toEqual({
      type: 'dismiss',
      troops: army({ rider: 3 }),
    })
  })

  it('refuse les ordres mal formés', () => {
    const invalid: unknown[] = [
      null,
      'upgrade',
      [],
      {},
      { type: 'teleport' },
      { type: 'upgrade', building: 'dragonTower' },
      { type: 'upgrade', building: 7 },
      { type: 'research', tech: 'toString' },
      { type: 'train', unit: 'archer', count: 2.5 },
      { type: 'train', unit: 'archer', count: -1 },
      { type: 'train', unit: 'archer', count: '10' },
      { type: 'train', unit: 'archer', count: 1e12 },
      { type: 'attack', target: { type: 'camp', camp: 'wolfDen' }, troops: { warrior: 1 } },
      { type: 'march', camp: 'wolfDen', troops: { warrior: 1 } },
      { type: 'march', target: 'wolfDen', troops: { warrior: 1 } },
      { type: 'march', target: { type: 'camp', camp: 'nowhere' }, troops: { warrior: 1 } },
      { type: 'march', target: { type: 'band', band: -1 }, troops: { warrior: 1 } },
      { type: 'march', target: { type: 'band', band: 1.5 }, troops: { warrior: 1 } },
      { type: 'march', target: { type: 'dragon' }, troops: { warrior: 1 } },
      { type: 'march', target: { type: 'point', x: -1, y: 10 }, troops: { warrior: 1 } },
      { type: 'march', target: { type: 'point', x: 10, y: 99999 }, troops: { warrior: 1 } },
      { type: 'march', target: { type: 'point', x: '10', y: 10 }, troops: { warrior: 1 } },
      { type: 'march', target: { type: 'camp', camp: 'wolfDen' }, troops: [1, 2] },
      { type: 'march', target: { type: 'camp', camp: 'wolfDen' }, troops: { warrior: 1, dragon: 1 } },
      { type: 'march', target: { type: 'camp', camp: 'wolfDen' }, troops: { warrior: 1 }, hero: 'merlin' },
      { type: 'march', target: { type: 'camp', camp: 'wolfDen' }, troops: { warrior: 1 }, hero: 3 },
      { type: 'recruit', hero: 'merlin' },
      { type: 'recruit' },
      { type: 'skill', hero: 'ysolde', skill: 'lightning' },
      { type: 'skill', hero: 'ysolde', skill: 'toString' },
      { type: 'skill', hero: 'nobody', skill: 'rally' },
      { type: 'order', army: -2, target: { type: 'city' } },
      { type: 'order', army: 3 },
      { type: 'order', army: 3, target: { type: 'node' } },
      { type: 'dismiss', troops: { warrior: Number.NaN } },
      JSON.parse('{"type": "dismiss", "troops": {"__proto__": 1}}'),
    ]
    for (const input of invalid) expect(parseAction(input), JSON.stringify(input)).toBeNull()
  })

  it('ne garde que ce que l’ordre doit contenir', () => {
    const forged = { type: 'upgrade', building: 'farm', resources: { gold: 1e9 }, endsAt: 0 }
    expect(parseAction(forged)).toEqual({ type: 'upgrade', building: 'farm' })
  })
})

describe('performAction', () => {
  it('applique chaque ordre comme les règles', () => {
    const game = richGame({ castle: 5, barracks: 3, academy: 2 }, { warrior: 10 })
    const t = T0 + 1000
    expect(performAction(game, { type: 'upgrade', building: 'farm' }, t)).toEqual({
      ok: true,
      state: startUpgrade(game, 'farm', t),
    })
    expect(performAction(game, { type: 'research', tech: 'forge' }, t)).toEqual({
      ok: true,
      state: startResearch(game, 'forge', t),
    })
    expect(performAction(game, { type: 'train', unit: 'mage', count: 4 }, t)).toEqual({
      ok: true,
      state: startTraining(game, 'mage', 4, t),
    })
    const troops = army({ warrior: 6 })
    const target = { type: 'camp', camp: 'wolfDen' } as const
    const marched = startMarch(game, target, troops, t)
    expect(performAction(game, { type: 'march', target, troops }, t)).toEqual({ ok: true, state: marched })
    const id = marched.armies[0].id
    expect(performAction(marched, { type: 'order', army: id, target: { type: 'city' } }, t + 1000)).toEqual({
      ok: true,
      state: orderArmy(marched, id, { type: 'city' }, t + 1000),
    })
    const dismissed = performAction(game, { type: 'dismiss', troops: army({ warrior: 4 }) }, t)
    expect(dismissed.ok && dismissed.state.troops.warrior).toBe(6)

    const recruited = recruitHero(game, 'ysolde', t)
    expect(performAction(game, { type: 'recruit', hero: 'ysolde' }, t)).toEqual({ ok: true, state: recruited })
    expect(performAction(recruited, { type: 'skill', hero: 'ysolde', skill: 'rally' }, t)).toEqual({
      ok: true,
      state: learnSkill(recruited, 'ysolde', 'rally', t),
    })
    expect(performAction(recruited, { type: 'march', target, troops, hero: 'ysolde' }, t)).toEqual({
      ok: true,
      state: startMarch(recruited, target, troops, t, 'ysolde'),
    })
  })

  it('explique un refus, sans rien changer à la partie', () => {
    const game = startUpgrade(richGame({ castle: 5 }), 'farm', T0)
    const result = performAction(game, { type: 'upgrade', building: 'sawmill' }, T0 + 1000)
    expect(result).toMatchObject({ ok: false, reason: 'Un chantier est déjà en cours' })
    expect(result.state.construction).toEqual(game.construction)
  })

  it('fait d’abord avancer la partie : un chantier terminé laisse place au suivant', () => {
    const game = startUpgrade(richGame({ castle: 5 }), 'farm', T0)
    const done = T0 + upgradeDuration(game, getBuilding('farm'), 2)
    const result = performAction(game, { type: 'upgrade', building: 'sawmill' }, done)
    expect(result.ok).toBe(true)
    expect(result.state.levels.farm).toBe(2)
    expect(result.state.construction?.building).toBe('sawmill')
  })
})
