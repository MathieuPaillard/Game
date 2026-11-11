// La bataille, calculée automatiquement : les deux camps s'affrontent en manches successives.
// Pas de hasard : les mêmes armées donnent toujours le même résultat.

import { COUNTER_BONUS, MAX_BATTLE_ROUNDS, UNITS, type UnitId } from './config'

/** Un groupe de combattants identiques. */
export interface Stack {
  /** Famille de troupe, pour les forces et faiblesses. */
  family: UnitId
  attack: number
  health: number
  count: number
}

/** Ce qui s'est passé pendant une manche. */
export interface RoundLog {
  /** Dégâts infligés pendant la manche par chaque camp. */
  damageByAttackers: number
  damageByDefenders: number
  /** Combattants encore debout dans chaque groupe à la fin de la manche. */
  attackers: number[]
  defenders: number[]
}

export interface BattleOutcome {
  winner: 'attacker' | 'defender' | 'none'
  rounds: number
  /** Combattants encore debout dans chaque groupe, dans l'ordre des groupes reçus. */
  attackers: number[]
  defenders: number[]
  /** Le déroulé de la bataille, manche par manche. */
  log: RoundLog[]
}

export function isStrongAgainst(family: UnitId, target: UnitId): boolean {
  return UNITS.some((unit) => unit.id === family && unit.strongAgainst === target)
}

export function fight(attackers: Stack[], defenders: Stack[], maxRounds = MAX_BATTLE_ROUNDS): BattleOutcome {
  // Chaque groupe a une réserve de points de vie : un combattant blessé continue de se battre.
  let attackerHealth = attackers.map((s) => s.count * s.health)
  let defenderHealth = defenders.map((s) => s.count * s.health)
  let rounds = 0
  const log: RoundLog[] = []

  while (rounds < maxRounds && total(counts(attackers, attackerHealth)) > 0 && total(counts(defenders, defenderHealth)) > 0) {
    rounds++
    // Les deux camps frappent en même temps.
    const toDefenders = damage(attackers, attackerHealth, defenders, defenderHealth)
    const toAttackers = damage(defenders, defenderHealth, attackers, attackerHealth)
    defenderHealth = defenderHealth.map((hp, i) => Math.max(0, hp - toDefenders[i]))
    attackerHealth = attackerHealth.map((hp, i) => Math.max(0, hp - toAttackers[i]))
    log.push({
      damageByAttackers: total(toDefenders),
      damageByDefenders: total(toAttackers),
      attackers: counts(attackers, attackerHealth),
      defenders: counts(defenders, defenderHealth),
    })
  }

  const attackersLeft = counts(attackers, attackerHealth)
  const defendersLeft = counts(defenders, defenderHealth)
  const winner = total(attackersLeft) === 0 ? 'defender' : total(defendersLeft) === 0 ? 'attacker' : 'none'
  return { winner, rounds, attackers: attackersLeft, defenders: defendersLeft, log }
}

/** Combattants encore debout dans chaque groupe. */
function counts(stacks: Stack[], health: number[]): number[] {
  return stacks.map((s, i) => Math.max(0, Math.ceil(health[i] / s.health - 1e-9)))
}

function total(values: number[]): number {
  return values.reduce((sum, v) => sum + v, 0)
}

/** Dégâts reçus par chaque groupe adverse : chaque groupe frappe tous les ennemis, au prorata de leur nombre. */
function damage(from: Stack[], fromHealth: number[], to: Stack[], toHealth: number[]): number[] {
  const fromCounts = counts(from, fromHealth)
  const toCounts = counts(to, toHealth)
  const targets = total(toCounts)
  return to.map((target, j) => {
    if (targets === 0) return 0
    const share = toCounts[j] / targets
    return from.reduce((sum, f, i) => {
      const bonus = isStrongAgainst(f.family, target.family) ? COUNTER_BONUS : 1
      return sum + fromCounts[i] * f.attack * share * bonus
    }, 0)
  })
}
