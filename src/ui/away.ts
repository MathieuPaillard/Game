// Le résumé « Bon retour » : ce qui s'est passé pendant que le joueur n'était pas là.

import { RESOURCES, RESOURCE_IDS, type Resources } from '../game/config'
import {
  armySize,
  currentQuest,
  dragonLevel,
  dragonNature,
  emptyResources,
  freeBeds,
  getBuilding,
  getHeroDef,
  getSpell,
  getTech,
  getUnit,
  hospitalBeds,
  netPerHour,
  questDone,
  siegeOf,
  storageCapacity,
  type BattleReport,
  type GameState,
} from '../game/rules'
import { OUTCOME_NAMES, bandLabel, foeName, foesName } from './battleLog'
import { formatAmount } from './format'
import { dragonOfNature } from './world'

// En dessous d'une minute d'absence, pas de résumé.
const AWAY_REPORT_MIN_MS = 60 * 1000

export interface AwayReport {
  duration: number
  gains: Resources
  events: string[]
}

/** Compare la partie laissée par le joueur (`before`) à la partie d'aujourd'hui (`after`). */
export function makeAwayReport(before: GameState, after: GameState): AwayReport | null {
  const duration = after.updatedAt - before.updatedAt
  if (duration < AWAY_REPORT_MIN_MS) return null

  const gains = emptyResources()
  for (const id of RESOURCE_IDS) gains[id] = after.resources[id] - before.resources[id]

  const events: string[] = []
  // Des réserves pleines : leur production s'est arrêtée, et les gains avec elle.
  const room = storageCapacity(after)
  const rates = netPerHour(after)
  const full = RESOURCE_IDS.filter((id) => after.resources[id] >= room && rates[id] > 0)
  if (full.length > 0) {
    const names = full.map((id) => `${RESOURCES[id].icon} ${RESOURCES[id].name.toLowerCase()}`).join(', ')
    const one = full.length === 1
    events.push(
      `${one ? 'Réserve pleine' : 'Réserves pleines'} (${names}) : ${one ? 'sa' : 'leur'} production s’est arrêtée. Agrandis l’Entrepôt pour en garder davantage.`,
    )
  }
  for (const works of before.constructions) {
    const finished = !after.constructions.some((c) => c.building === works.building && c.startedAt === works.startedAt)
    if (finished) events.push(`${getBuilding(works.building).name} : le niveau ${works.targetLevel} est terminé.`)
  }
  const research = before.research
  if (research && !after.research) {
    events.push(`Recherche terminée : ${getTech(research.tech).name}, niveau ${research.targetLevel}.`)
  }
  for (const training of before.trainings) {
    const finished = !after.trainings.some((t) => t.unit === training.unit && t.startedAt === training.startedAt)
    if (finished) events.push(`Entraînement terminé : ${getUnit(training.unit).name} +${training.count}.`)
  }
  // Les soins finis à l'hôpital.
  const cared = before.healing
  if (cared && after.healing?.startedAt !== cared.startedAt) {
    const count = armySize(cared.troops)
    events.push(`Soins terminés : ${count} blessé${count > 1 ? 's ont' : ' a'} rejoint la garnison.`)
  }
  for (const report of after.reports.filter((r) => r.at > before.updatedAt).reverse()) {
    if (report.siege) {
      events.push(siegeText(report))
      continue
    }
    if (report.foe.type === 'trap') {
      events.push(trapText(report))
      continue
    }
    const ambush = report.ambush ? ' (embuscade)' : ''
    events.push(`${OUTCOME_NAMES[report.outcome]} contre : ${foesName(report)}${ambush}.`)
  }
  for (const army of before.armies) {
    if (after.armies.some((a) => a.id === army.id)) continue
    // Anéantie (même dans une victoire, ou par un piège), l'armée n'est pas rentrée : son rapport le dit.
    const wiped = after.reports.some((r) => r.army === army.id && armySize(r.lost) >= armySize(r.sent))
    if (!wiped) events.push('Une de tes armées est rentrée à la cité, avec ce qu’elle portait.')
  }
  // Les blessés de ces combats, qui attendent à l'hôpital, et ses lits.
  const waiting = armySize(after.wounded)
  if (waiting > armySize(before.wounded)) {
    events.push(`${waiting} blessé${waiting > 1 ? 's attendent' : ' attend'} à l’Hôpital : soigne-les pour qu’ils reprennent du service.`)
  }
  if (hospitalBeds(after) > 0 && freeBeds(after) === 0) {
    events.push('L’Hôpital est plein : les prochains blessés mourront.')
  }
  for (const hero of after.heroes) {
    const was = before.heroes.find((h) => h.id === hero.id)
    if (was && hero.level > was.level) {
      events.push(`${getHeroDef(hero.id).name} atteint le niveau ${hero.level} : des points de compétence à placer.`)
    }
  }
  // Le dragon : il est né, ou il a grandi.
  if (before.dragon?.stage !== 'grown' && after.dragon?.stage === 'grown') {
    const nature = dragonNature(after)
    events.push(`Ton dragon est né${nature ? ` : un ${dragonOfNature(nature)} ${nature.icon}` : ''} ! Il t’attend dans son aire.`)
  } else if (dragonLevel(after) > dragonLevel(before)) {
    events.push(`Ton dragon atteint le niveau ${dragonLevel(after)}.`)
  }
  // Les sorts : ceux qui ont pris fin, et les défenses qui ont veillé sur la cité pendant l'absence.
  for (const active of before.spells) {
    const spell = getSpell(active.spell)
    const ended = !after.spells.some((s) => s.spell === active.spell)
    if (spell.absence) events.push(`${spell.name} a veillé sur la cité pendant ton absence${ended ? ', puis s’est dissipée' : ''}.`)
    else if (ended) events.push(`Le sort ${spell.name} a pris fin.`)
  }
  // Un objectif atteint pendant l'absence : sa récompense attend en haut de l'écran.
  const quest = currentQuest(after)
  if (quest && questDone(after, quest) && !questDone(before, quest)) {
    events.push(`Objectif atteint : ${quest.name}. Touche l’objectif, en haut de l’écran, pour recevoir ta récompense.`)
  }
  const fresh = after.bands.filter((band) => !before.bands.some((b) => b.id === band.id))
  const newBands = fresh.filter((band) => !band.raid).length
  if (newBands === 1) events.push('Une nouvelle bande de monstres rôde aux alentours.')
  if (newBands > 1) events.push(`${newBands} nouvelles bandes de monstres rôdent aux alentours.`)
  // Un raid encore en route : le joueur a peut-être le temps de l'arrêter.
  if (siegeOf(after)) events.push('En ce moment, un raid assiège ta cité !')
  else if (after.bands.some((band) => band.raid)) events.push('Un raid de monstres marche sur ta cité !')
  const newNodes = after.nodes.filter((node) => !before.nodes.some((n) => n.id === node.id)).length
  if (newNodes === 1) events.push('Un nouveau gisement de ressources est apparu.')
  if (newNodes > 1) events.push(`${newNodes} nouveaux gisements de ressources sont apparus.`)
  return { duration, gains, events }
}

/** Une armée tombée dans un piège du grand campement. */
function trapText(report: BattleReport): string {
  const lost = armySize(report.lost)
  const what =
    lost >= armySize(report.sent)
      ? 'toute l’armée est tombée'
      : `${formatAmount(lost)} troupe${lost > 1 ? 's' : ''} perdue${lost > 1 ? 's' : ''}`
  return `Une de tes armées est tombée dans un piège du grand campement : ${what}.`
}

/** Ce qui s'est passé aux portes de la cité, face à un raid ou à plusieurs. */
function siegeText(report: BattleReport): string {
  const raids = report.foes.length > 0 ? report.foes : [report.foe]
  const name = raids.map((foe) => (foe.type === 'band' ? bandLabel(foe.kind, foe.level) : foeName(foe))).join(', ')
  const several = raids.length > 1
  if (report.outcome === 'victory') return `${several ? 'Raids repoussés' : 'Raid repoussé'} aux portes de la cité : ${name}.`
  if (report.outcome === 'defeat') {
    const plunder = report.siege?.plunder ?? {}
    const taken = RESOURCE_IDS.filter((id) => plunder[id])
      .map((id) => `${RESOURCES[id].icon} ${formatAmount(plunder[id] ?? 0)}`)
      .join(' · ')
    const carried = taken ? ` ${several ? 'Ils ont' : 'Il a'} emporté ${taken}.` : ''
    return `${several ? 'Des raids ont' : 'Un raid a'} pillé ta cité : ${name}.${carried}`
  }
  return `${several ? 'Des raids ont' : 'Un raid a'} renoncé à prendre ta cité : ${name}.`
}
