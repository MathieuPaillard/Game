import { describe, expect, it } from 'vitest'
import { START_LEVELS } from './config.ts'
import { advance, bandPosition, emptyArmy, emptyTechs, newGame } from './rules.ts'
import { restoreState } from './save.ts'

const T0 = Date.UTC(2026, 0, 1)

describe('restoreState', () => {
  it('relit telle quelle une partie de la version actuelle', () => {
    const game = newGame('elves', T0)
    expect(restoreState(JSON.parse(JSON.stringify(game)))).toEqual(game)
  })

  it('refuse ce qui n’est pas une partie', () => {
    for (const input of [null, 42, 'partie', {}, { race: 'humans' }, { race: 'dragons', updatedAt: T0 }]) {
      expect(restoreState(input)).toBeNull()
    }
    expect(restoreState({ race: 'humans', updatedAt: T0, reports: 'abîmé' })).toBeNull()
  })

  it('complète une partie enregistrée par une version plus ancienne', () => {
    const training = { unit: 'warrior', count: 5, startedAt: T0, endsAt: T0 + 1000 }
    const old = {
      race: 'dwarves',
      updatedAt: T0,
      resources: { food: 10, wood: 20, stone: 30, gold: 40 },
      levels: { castle: 2 },
      troops: { archer: 3 },
      training,
      expedition: null,
      reports: [{ at: T0, camp: 'wolfDen', victory: true, sent: {}, lost: {} }],
      desertions: 4,
    }
    const state = restoreState(old)
    expect(state).toMatchObject({
      race: 'dwarves',
      resources: { food: 10, wood: 20, stone: 30, gold: 40, mana: 0 },
      levels: { ...START_LEVELS, castle: 2 },
      techs: emptyTechs(),
      troops: { ...emptyArmy(), archer: 3 },
      trainings: [training],
      heroes: [],
      armies: [],
      battles: [],
      stats: { victories: 0, bandsDefeated: 0, gathered: 0 },
      quests: [],
      constructions: [],
      research: null,
      spells: [],
    })
    expect(state?.reports[0]).toMatchObject({
      foe: { type: 'camp', camp: 'wolfDen' },
      ambush: false,
      outcome: 'victory',
      startedAt: T0,
      enemies: {},
      enemyLost: {},
      loot: {},
      starving: false,
      rounds: [],
      hero: null,
    })
    // Avant les bandes et les gisements, la carte était vide : ils arrivent peu à peu.
    expect(state).toMatchObject({ bands: [], nextBandAt: T0, nodes: [], nextNodeAt: T0, nextId: 1 })
    const later = advance(state!, T0 + 1000)
    expect(later.bands).toHaveLength(1)
    expect(later.nodes).toHaveLength(1)
    // Ce qui n'existe plus dans le jeu est oublié.
    expect(state).not.toHaveProperty('desertions')
    expect(state).not.toHaveProperty('training')
  })

  it('fait rentrer à la cité les armées parties avec une version plus ancienne', () => {
    const old = {
      race: 'humans',
      updatedAt: T0,
      troops: { warrior: 2 },
      resources: { food: 100, wood: 100, stone: 100, gold: 100, mana: 100 },
      expeditions: [
        // Sur le chemin du retour, butin en poche (la toute première version).
        {
          camp: 'goblinCamp',
          troops: { warrior: 10, archer: 0, rider: 0, mage: 0 },
          departedAt: T0 - 2000,
          arrivesAt: T0 - 1000,
          returnsAt: T0 + 5000,
          result: { survivors: { warrior: 7, archer: 0, rider: 0, mage: 0 }, loot: { gold: 80 } },
        },
        // En route vers une bande (la version d'avant les ordres sur la carte).
        {
          id: 4,
          target: { type: 'band', band: 2 },
          troops: { warrior: 0, archer: 3, rider: 0, mage: 0 },
          loot: { wood: 50 },
          returning: false,
        },
      ],
    }
    const state = restoreState(old)
    expect(state?.armies).toEqual([])
    expect(state?.troops).toEqual({ ...emptyArmy(), warrior: 9, archer: 3 })
    expect(state?.resources).toMatchObject({ gold: 180, wood: 150, food: 100 })
  })

  it('reprend le chantier d’une version qui n’en avait qu’un', () => {
    const construction = { building: 'farm', targetLevel: 3, startedAt: T0, endsAt: T0 + 5000 }
    const state = restoreState({ ...newGame('humans', T0), constructions: undefined, construction })!
    expect(state.constructions).toEqual([construction])
    expect(state).not.toHaveProperty('construction')
  })

  it('les armées d’avant les héros partent sans héros', () => {
    const army = {
      id: 5,
      troops: { ...emptyArmy(), warrior: 4 },
      position: { x: 700, y: 600 },
      order: null,
      status: 'idle',
      load: {},
      fought: [],
    }
    const state = restoreState({ ...newGame('orcs', T0), heroes: undefined, armies: [army] })!
    expect(state.heroes).toEqual([])
    expect(state.armies).toEqual([{ ...army, hero: null }])
  })

  it('fait patrouiller les bandes d’avant les rondes autour de l’endroit où elles étaient', () => {
    const old = {
      race: 'humans',
      updatedAt: T0,
      bands: [{ id: 3, kind: 'goblins', level: 2, position: { x: 900, y: 200 }, monsters: { goblin: 9 } }],
      reports: [
        {
          at: T0,
          army: 4,
          foe: { type: 'band', kind: 'wolves', level: 1 },
          ambush: true,
          victory: false,
          sent: { warrior: 5, archer: 0, rider: 0, mage: 0 },
          lost: { warrior: 5, archer: 0, rider: 0, mage: 0 },
          enemyLost: {},
          loot: {},
        },
      ],
    }
    const state = restoreState(old)!
    expect(state.bands[0]).toMatchObject({ id: 3, kind: 'goblins', level: 2, home: { x: 900, y: 200 }, since: T0 })
    expect(bandPosition(state.bands[0], T0 + 10_000)).not.toEqual(bandPosition(state.bands[0], T0))
    expect(state.reports[0]).toMatchObject({ ambush: true, outcome: 'defeat' })
  })
})
