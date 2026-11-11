import { describe, expect, it } from 'vitest'
import { fight, type Stack } from './battle'
import { MAX_BATTLE_ROUNDS, UNITS, type UnitId } from './config'

/** Un groupe aux caractéristiques fixes, pour tester le combat sans dépendre de l'équilibrage. */
function stack(family: UnitId, count: number, attack = 10, health = 50): Stack {
  return { family, count, attack, health }
}

describe('bataille', () => {
  it('à forces égales, le plus nombreux l’emporte', () => {
    const outcome = fight([stack('warrior', 30)], [stack('warrior', 20)])
    expect(outcome.winner).toBe('attacker')
    expect(outcome.defenders).toEqual([0])
    expect(outcome.attackers[0]).toBeGreaterThan(0)
  })

  it('les forces et faiblesses font la différence', () => {
    for (const unit of UNITS) {
      // Deux groupes identiques, sauf la famille : celui qui a l'avantage gagne.
      expect(fight([stack(unit.id, 20)], [stack(unit.strongAgainst, 20)]).winner).toBe('attacker')
      expect(fight([stack(unit.strongAgainst, 20)], [stack(unit.id, 20)]).winner).toBe('defender')
    }
  })

  it('donne toujours le même résultat', () => {
    const army = [stack('warrior', 12), stack('archer', 7, 14, 30)]
    const foes = [stack('rider', 9, 12, 40), stack('mage', 4, 18, 20)]
    expect(fight(army, foes)).toEqual(fight(army, foes))
  })

  it('s’arrête au bout du nombre maximum de manches', () => {
    const outcome = fight([stack('warrior', 5, 1, 1000)], [stack('warrior', 5, 1, 1000)])
    expect(outcome.winner).toBe('none')
    expect(outcome.rounds).toBe(MAX_BATTLE_ROUNDS)
  })
})
