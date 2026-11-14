import { describe, expect, it } from 'vitest'
import { START_LEVELS } from './config.ts'
import { advance, emptyArmy, emptyTechs, getCamp, newGame } from './rules.ts'
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
      reports: [{ at: T0, camp: 'wolfDen', victory: true, sent: {}, lost: {}, enemyLost: {}, loot: {} }],
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
      expeditions: [],
      construction: null,
      research: null,
    })
    expect(state?.reports[0]).toMatchObject({
      foe: { type: 'camp', camp: 'wolfDen' },
      ambush: false,
      enemies: {},
      starving: false,
      rounds: [],
    })
    // Avant les bandes de monstres, la carte était vide : elles arrivent peu à peu.
    expect(state).toMatchObject({ bands: [], nextBandAt: T0, nextId: 1 })
    expect(advance(state!, T0 + 1000).bands).toHaveLength(1)
    // Ce qui n'existe plus dans le jeu est oublié.
    expect(state).not.toHaveProperty('desertions')
    expect(state).not.toHaveProperty('training')
  })

  it('reprend les armées parties vers un camp avant l’arrivée des bandes', () => {
    const survivors = { warrior: 7, archer: 0, rider: 0, mage: 0 }
    const old = {
      race: 'humans',
      updatedAt: T0,
      expeditions: [
        {
          camp: 'goblinCamp',
          troops: { warrior: 10, archer: 0, rider: 0, mage: 0 },
          departedAt: T0 - 2000,
          arrivesAt: T0 - 1000,
          returnsAt: T0 + 5000,
          result: { survivors, loot: { gold: 80 } },
        },
        {
          camp: 'wolfDen',
          troops: { warrior: 3, archer: 0, rider: 0, mage: 0 },
          departedAt: T0,
          arrivesAt: T0 + 3000,
          returnsAt: T0 + 6000,
          result: null,
        },
      ],
    }
    const state = restoreState(old)
    expect(state?.expeditions).toEqual([
      {
        id: 1,
        target: { type: 'camp', camp: 'goblinCamp' },
        foe: { type: 'camp', camp: 'goblinCamp' },
        destination: getCamp('goblinCamp').position,
        troops: survivors,
        loot: { gold: 80 },
        departedAt: T0 - 2000,
        arrivesAt: T0 - 1000,
        returnsAt: T0 + 5000,
        returning: true,
        fought: [],
      },
      expect.objectContaining({ id: 2, target: { type: 'camp', camp: 'wolfDen' }, returning: false }),
    ])
    expect(state?.nextId).toBe(3)
    // L'armée sur le chemin du retour rentre bien, avec son butin.
    const back = advance(state!, T0 + 5000)
    expect(back.troops.warrior).toBe(7)
  })
})
