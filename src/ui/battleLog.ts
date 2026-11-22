// Raconte une bataille à partir de son rapport : qui avait l'avantage, chaque manche, puis l'issue.

import { isStrongAgainst } from '../game/battle'
import { COUNTER_BONUS, DRAGON_FAMILY, UNIT_IDS, WALL_GUARD, type BandKindId, type MonsterId } from '../game/config'
import { getBandKind, getCamp, getMonster, getUnit, type BattleReport, type Foe, type Outcome } from '../game/rules'
import { formatAmount } from './format'

/** L'issue d'une bataille, pour le titre d'un rapport. */
export const OUTCOME_NAMES: Record<Outcome, string> = {
  victory: 'Victoire',
  defeat: 'Défaite',
  retreat: 'Retraite',
  draw: 'Sans vainqueur',
}

/** L'issue d'un siège, vue de la cité. */
const SIEGE_OUTCOME_NAMES: Record<Outcome, string> = {
  victory: 'Raid repoussé',
  defeat: 'Cité pillée',
  retreat: 'Retraite',
  draw: 'Siège sans vainqueur',
}

/** Le titre d'un rapport : « Victoire », « Défaite »… ou, pour un siège, « Raid repoussé », « Cité pillée »… */
export function reportTitle(report: BattleReport): string {
  return (report.siege ? SIEGE_OUTCOME_NAMES : OUTCOME_NAMES)[report.outcome]
}

/** Une sorte de bande et son niveau : « Meute de loups (niv. 2) ». */
export function bandLabel(kind: BandKindId, level: number): string {
  return `${getBandKind(kind).name} (niv. ${level})`
}

/** Le nom d'un adversaire : « Tanière de loups », « Meute de loups (niv. 2) », ou « Raid : Meute de loups (niv. 2) ». */
export function foeName(foe: Foe): string {
  if (foe.type === 'camp') return getCamp(foe.camp).name
  return foe.raid ? `Raid : ${bandLabel(foe.kind, foe.level)}` : bandLabel(foe.kind, foe.level)
}

export interface BattleStory {
  advantages: string
  rounds: { title: string; text: string }[]
  ending: string
}

export function describeBattle(report: BattleReport): BattleStory {
  const units = UNIT_IDS.filter((id) => report.sent[id] > 0)
  const monsters = (Object.keys(report.enemies) as MonsterId[]).filter((id) => (report.enemies[id] ?? 0) > 0)
  // Pendant un siège, les gardes des Remparts se battent aux côtés des troupes de la cité.
  const siege = report.siege
  let guards = siege?.guards ?? 0

  // Les forces et faiblesses en jeu dans cette bataille.
  const edges: string[] = []
  for (const unit of units) {
    for (const id of monsters) {
      const monster = getMonster(id)
      const family = getUnit(unit).family
      if (isStrongAgainst(family, monster.family)) edges.push(`tes ${getUnit(unit).name} dominent les ${monster.name}`)
      if (isStrongAgainst(monster.family, family)) edges.push(`les ${monster.name} dominent tes ${getUnit(unit).name}`)
    }
  }
  if (report.dragon) {
    for (const id of monsters) {
      const monster = getMonster(id)
      if (isStrongAgainst(DRAGON_FAMILY, monster.family)) edges.push(`ton dragon domine les ${monster.name}`)
      if (isStrongAgainst(monster.family, DRAGON_FAMILY)) edges.push(`les ${monster.name} dominent ton dragon`)
    }
  }
  if (guards > 0) {
    for (const id of monsters) {
      const monster = getMonster(id)
      if (isStrongAgainst(WALL_GUARD.family, monster.family)) edges.push(`les gardes des Remparts dominent les ${monster.name}`)
      if (isStrongAgainst(monster.family, WALL_GUARD.family)) edges.push(`les ${monster.name} dominent les gardes des Remparts`)
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
    const guardsLost = round.guardsLost ?? 0
    if (guardsLost > 0) {
      guards -= guardsLost
      ownLosses.push(`🧱 gardes des Remparts −${guardsLost} (reste ${guards})`)
    }
    const dealt = foeLosses.length ? ` : ${foeLosses.join(', ')}` : ', sans abattre personne'
    const taken = ownLosses.length ? ` : ${ownLosses.join(', ')}` : ', sans abattre personne'
    const side = siege ? 'Tes défenseurs infligent' : 'Ton armée inflige'
    const dragonFell = round.dragonFell ? ' Blessé, le dragon quitte le combat.' : ''
    return {
      title: `Manche ${i + 1}`,
      text:
        `${side} ${formatAmount(round.dealt)} dégâts${dealt}. ` +
        `Les monstres infligent ${formatAmount(round.taken)} dégâts${taken}.${dragonFell}`,
    }
  })

  const count = report.rounds.length
  const length = `${count} manche${count > 1 ? 's' : ''}`
  const endings: Record<Outcome, string> = siege
    ? {
        victory: `Raid repoussé en ${length}.`,
        defeat:
          count === 0
            ? 'Personne ne défendait la cité : le raid l’a pillée sans combat.'
            : `Après ${length}, les défenseurs sont tombés : le raid a pillé la cité.`,
        retreat: `Après ${length}, les défenseurs se sont retirés.`,
        draw: `Après ${length}, le raid renonce et repart sans rien emporter.`,
      }
    : {
        victory: `Victoire en ${length}.`,
        defeat: `Défaite en ${length} : ton armée a été anéantie.`,
        retreat: `Après ${length}, tu as ordonné la retraite.`,
        draw: `Après ${length}, les deux camps se séparent sans vainqueur.`,
      }
  const ending = endings[report.outcome]

  return { advantages, rounds, ending }
}
