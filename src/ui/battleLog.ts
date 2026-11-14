// Raconte une bataille à partir de son rapport : qui avait l'avantage, chaque manche, puis l'issue.

import { isStrongAgainst } from '../game/battle'
import { COUNTER_BONUS, UNIT_IDS, type MonsterId } from '../game/config'
import { getBandKind, getCamp, getMonster, getUnit, type BattleReport, type Foe, type Outcome } from '../game/rules'
import { formatAmount } from './format'

/** L'issue d'une bataille, pour le titre d'un rapport. */
export const OUTCOME_NAMES: Record<Outcome, string> = {
  victory: 'Victoire',
  defeat: 'Défaite',
  retreat: 'Retraite',
  draw: 'Sans vainqueur',
}

/** Le nom d'un adversaire : « Tanière de loups », ou « Meute de loups (niv. 2) ». */
export function foeName(foe: Foe): string {
  return foe.type === 'camp' ? getCamp(foe.camp).name : `${getBandKind(foe.kind).name} (niv. ${foe.level})`
}

export interface BattleStory {
  advantages: string
  rounds: { title: string; text: string }[]
  ending: string
}

export function describeBattle(report: BattleReport): BattleStory {
  const units = UNIT_IDS.filter((id) => report.sent[id] > 0)
  const monsters = (Object.keys(report.enemies) as MonsterId[]).filter((id) => (report.enemies[id] ?? 0) > 0)

  // Les forces et faiblesses en jeu dans cette bataille.
  const edges: string[] = []
  for (const unit of units) {
    for (const id of monsters) {
      const monster = getMonster(id)
      if (isStrongAgainst(unit, monster.family)) edges.push(`tes ${getUnit(unit).name} dominent les ${monster.name}`)
      if (isStrongAgainst(monster.family, unit)) edges.push(`les ${monster.name} dominent tes ${getUnit(unit).name}`)
    }
  }
  const bonus = Math.round((COUNTER_BONUS - 1) * 100)
  const advantages = edges.length
    ? `Avant la bataille : ${edges.join(', ')} (+${bonus} % de dégâts).`
    : 'Avant la bataille : aucune troupe n’a l’avantage sur une autre.'

  // Chaque manche, avec ce qu'il reste de chaque groupe.
  const army = { ...report.sent }
  const foes = { ...report.enemies }
  const rounds = report.rounds.map((round, i) => {
    const foeLosses = monsters
      .filter((id) => (round.enemyLost[id] ?? 0) > 0)
      .map((id) => {
        const lost = round.enemyLost[id] ?? 0
        foes[id] = (foes[id] ?? 0) - lost
        const monster = getMonster(id)
        return `${monster.icon} ${monster.name} −${lost} (reste ${foes[id]})`
      })
    const ownLosses = units
      .filter((id) => round.lost[id] > 0)
      .map((id) => {
        army[id] -= round.lost[id]
        const unit = getUnit(id)
        return `${unit.icon} ${unit.name} −${round.lost[id]} (reste ${army[id]})`
      })
    const dealt = foeLosses.length ? ` : ${foeLosses.join(', ')}` : ', sans abattre personne'
    const taken = ownLosses.length ? ` : ${ownLosses.join(', ')}` : ', sans abattre personne'
    return {
      title: `Manche ${i + 1}`,
      text:
        `Ton armée inflige ${formatAmount(round.dealt)} dégâts${dealt}. ` +
        `Les monstres infligent ${formatAmount(round.taken)} dégâts${taken}.`,
    }
  })

  const count = report.rounds.length
  const length = `${count} manche${count > 1 ? 's' : ''}`
  const endings: Record<Outcome, string> = {
    victory: `Victoire en ${length}.`,
    defeat: `Défaite en ${length} : ton armée a été anéantie.`,
    retreat: `Après ${length}, tu as ordonné la retraite.`,
    draw: `Après ${length}, les deux camps se séparent sans vainqueur.`,
  }
  const ending = endings[report.outcome]

  return { advantages, rounds, ending }
}
