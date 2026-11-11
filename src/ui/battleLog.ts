// Raconte une bataille à partir de son rapport : qui avait l'avantage, chaque manche, puis l'issue.

import { isStrongAgainst } from '../game/battle'
import { COUNTER_BONUS, UNIT_IDS, type MonsterId } from '../game/config'
import { armySize, getMonster, getUnit, type BattleReport } from '../game/rules'
import { formatAmount } from './format'

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
  const survivors = armySize(report.sent) - armySize(report.lost)
  const ending = report.victory
    ? `Victoire en ${length}.`
    : survivors === 0
      ? `Défaite en ${length} : ton armée a été anéantie.`
      : `Après ${length}, personne ne l’emporte : ton armée se replie.`

  return { advantages, rounds, ending }
}
