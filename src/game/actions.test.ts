import { describe, expect, it } from 'vitest'
import { parseAction, performAction, type Action } from './actions.ts'
import { RESOURCE_IDS, type Army, type BuildingId } from './config.ts'
import {
  emptyArmy,
  emptyResources,
  getBuilding,
  newGame,
  startExpedition,
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
      { type: 'attack', camp: 'wolfDen', troops: army({ warrior: 5 }) },
      { type: 'dismiss', troops: army({ mage: 2 }) },
    ]
    // Comme s'ils arrivaient du réseau : transformés en texte, puis relus.
    for (const action of actions) expect(parseAction(JSON.parse(JSON.stringify(action)))).toEqual(action)
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
      { type: 'attack', camp: 'nowhere', troops: { warrior: 1 } },
      { type: 'attack', camp: 'wolfDen', troops: [1, 2] },
      { type: 'attack', camp: 'wolfDen', troops: { warrior: 1, dragon: 1 } },
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
    expect(performAction(game, { type: 'attack', camp: 'wolfDen', troops }, t)).toEqual({
      ok: true,
      state: startExpedition(game, 'wolfDen', troops, t),
    })
    const dismissed = performAction(game, { type: 'dismiss', troops: army({ warrior: 4 }) }, t)
    expect(dismissed.ok && dismissed.state.troops.warrior).toBe(6)
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
