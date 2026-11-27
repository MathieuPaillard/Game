// La bataille, en manches successives : les deux camps frappent en même temps.
// Pas de hasard : les mêmes armées donnent toujours le même résultat.
// Dans le jeu, une manche se joue toutes les quelques secondes (voir BATTLE_ROUND_SECONDS) :
// une bataille dure donc un moment, et on peut battre en retraite avant la fin. À chaque manche,
// une troupe ne porte qu'une partie de ses coups (BATTLE_DAMAGE_SCALE), et un camp ne perd jamais
// plus d'une part de sa vie du début (MIN_BATTLE_ROUNDS) : une bataille dure au moins dix manches.

import {
  BATTLE_DAMAGE_SCALE,
  COUNTER_BONUS,
  MAX_BATTLE_ROUNDS,
  MIN_BATTLE_ROUNDS,
  UNITS,
  type Family,
} from './config.ts'

/** Un groupe de combattants identiques. */
export interface Stack {
  /** Famille de troupe, pour les forces et faiblesses. */
  family: Family
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

/** Une famille domine-t-elle l'autre ? (Toutes les troupes d'une famille ont les mêmes forces.) */
export function isStrongAgainst(family: Family, target: Family): boolean {
  return UNITS.some((unit) => unit.family === family && unit.strongAgainst === target)
}

/** Les points de vie de départ de chaque groupe : un combattant blessé continue de se battre. */
export function startingHealth(stacks: Stack[]): number[] {
  return stacks.map((s) => s.count * s.health)
}

/** Combattants encore debout dans chaque groupe, d'après ses points de vie. */
export function counts(stacks: Stack[], health: number[]): number[] {
  return stacks.map((s, i) => Math.max(0, Math.ceil(health[i] / s.health - 1e-9)))
}

export function total(values: number[]): number {
  return values.reduce((sum, v) => sum + v, 0)
}

/** Les dégâts qu'un camp peut subir au plus en une manche : une part de sa vie au début de la bataille. */
export function roundCap(startHealth: number): number {
  return startHealth / MIN_BATTLE_ROUNDS
}

/** Ce que chaque camp peut perdre au plus pendant une manche (sans limite si rien n'est précisé). */
export interface RoundCaps {
  attackers: number
  defenders: number
}

/**
 * Une manche : les deux camps frappent en même temps. Reçoit les points de vie de chaque groupe
 * au début de la manche, et renvoie ceux de la fin, avec le journal de la manche. `caps` limite
 * les pertes de chaque camp pendant la manche (voir roundCap).
 */
export function fightRound(
  attackers: Stack[],
  defenders: Stack[],
  attackerHealth: number[],
  defenderHealth: number[],
  caps: RoundCaps = { attackers: Infinity, defenders: Infinity },
): { attackerHealth: number[]; defenderHealth: number[]; log: RoundLog } {
  const toDefenders = limit(damage(attackers, attackerHealth, defenders, defenderHealth), caps.defenders)
  const toAttackers = limit(damage(defenders, defenderHealth, attackers, attackerHealth), caps.attackers)
  const nextDefenders = defenderHealth.map((hp, i) => Math.max(0, hp - toDefenders[i]))
  const nextAttackers = attackerHealth.map((hp, i) => Math.max(0, hp - toAttackers[i]))
  return {
    attackerHealth: nextAttackers,
    defenderHealth: nextDefenders,
    log: {
      damageByAttackers: total(toDefenders),
      damageByDefenders: total(toAttackers),
      attackers: counts(attackers, nextAttackers),
      defenders: counts(defenders, nextDefenders),
    },
  }
}

/**
 * Les coups d'un seul camp sur un autre pendant une manche (dans une mêlée, chaque troupe frappe sa
 * propre cible) : chaque groupe frappe tous les groupes adverses, au prorata de leur nombre. `cap`
 * limite le total de ces dégâts (voir roundCap). Renvoie les dégâts que reçoit chaque groupe adverse.
 */
export function strike(from: Stack[], fromHealth: number[], to: Stack[], toHealth: number[], cap = Infinity): number[] {
  return limit(damage(from, fromHealth, to, toHealth), cap)
}

/** Une bataille entière, d'un coup : les manches s'enchaînent jusqu'à ce qu'un camp tombe. */
export function fight(attackers: Stack[], defenders: Stack[], maxRounds = MAX_BATTLE_ROUNDS): BattleOutcome {
  let attackerHealth = startingHealth(attackers)
  let defenderHealth = startingHealth(defenders)
  const caps = { attackers: roundCap(total(attackerHealth)), defenders: roundCap(total(defenderHealth)) }
  const log: RoundLog[] = []

  while (
    log.length < maxRounds &&
    total(counts(attackers, attackerHealth)) > 0 &&
    total(counts(defenders, defenderHealth)) > 0
  ) {
    const round = fightRound(attackers, defenders, attackerHealth, defenderHealth, caps)
    attackerHealth = round.attackerHealth
    defenderHealth = round.defenderHealth
    log.push(round.log)
  }

  const attackersLeft = counts(attackers, attackerHealth)
  const defendersLeft = counts(defenders, defenderHealth)
  const winner = total(attackersLeft) === 0 ? 'defender' : total(defendersLeft) === 0 ? 'attacker' : 'none'
  return { winner, rounds: log.length, attackers: attackersLeft, defenders: defendersLeft, log }
}

/**
 * Dégâts reçus par chaque groupe adverse : chaque groupe frappe tous les ennemis, au prorata de
 * leur nombre, avec la part de son attaque qui revient à une manche.
 */
function damage(from: Stack[], fromHealth: number[], to: Stack[], toHealth: number[]): number[] {
  const fromCounts = counts(from, fromHealth)
  const toCounts = counts(to, toHealth)
  const targets = total(toCounts)
  return to.map((target, j) => {
    if (targets === 0) return 0
    const share = toCounts[j] / targets
    return from.reduce((sum, f, i) => {
      const bonus = isStrongAgainst(f.family, target.family) ? COUNTER_BONUS : 1
      return sum + fromCounts[i] * f.attack * share * bonus * BATTLE_DAMAGE_SCALE
    }, 0)
  })
}

/** Ramène les dégâts d'une manche à `cap` au plus, en gardant leur répartition entre les groupes. */
function limit(hits: number[], cap: number): number[] {
  const sum = total(hits)
  return sum <= cap ? hits : hits.map((hit) => (hit * cap) / sum)
}
