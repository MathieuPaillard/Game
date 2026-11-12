import { describe, expect, it } from 'vitest'
import { START_LEVELS } from './config.ts'
import { emptyArmy, emptyTechs, newGame } from './rules.ts'
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
    expect(state?.reports[0]).toMatchObject({ enemies: {}, starving: false, rounds: [] })
    // Ce qui n'existe plus dans le jeu est oublié.
    expect(state).not.toHaveProperty('desertions')
    expect(state).not.toHaveProperty('training')
  })
})
