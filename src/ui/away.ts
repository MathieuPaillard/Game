// Le résumé « Bon retour » : ce qui s'est passé pendant que le joueur n'était pas là.

import { RESOURCES, RESOURCE_IDS, type Resources } from '../game/config'
import {
  currentQuest,
  dragonLevel,
  emptyResources,
  getBuilding,
  getHeroDef,
  getSpell,
  getTech,
  getUnit,
  questDone,
  siegeOf,
  type BattleReport,
  type GameState,
} from '../game/rules'
import { OUTCOME_NAMES, bandLabel, foeName } from './battleLog'
import { formatAmount } from './format'

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
  for (const report of after.reports.filter((r) => r.at > before.updatedAt).reverse()) {
    if (report.siege) {
      events.push(siegeText(report))
      continue
    }
    const ambush = report.ambush ? ' (embuscade)' : ''
    events.push(`${OUTCOME_NAMES[report.outcome]} contre : ${foeName(report.foe)}${ambush}.`)
  }
  for (const army of before.armies) {
    if (after.armies.some((a) => a.id === army.id)) continue
    // Anéantie, l'armée n'est pas rentrée : son rapport le dit.
    const wiped = after.reports.some((r) => r.army === army.id && r.outcome === 'defeat')
    if (!wiped) events.push('Une de tes armées est rentrée à la cité, avec ce qu’elle portait.')
  }
  for (const hero of after.heroes) {
    const was = before.heroes.find((h) => h.id === hero.id)
    if (was && hero.level > was.level) {
      events.push(`${getHeroDef(hero.id).name} atteint le niveau ${hero.level} : des points de compétence à placer.`)
    }
  }
  // Le dragon : il est né, ou il a grandi.
  if (before.dragon?.stage !== 'grown' && after.dragon?.stage === 'grown') {
    events.push('Ton dragon est né ! Il t’attend dans son aire.')
  } else if (dragonLevel(after) > dragonLevel(before)) {
    events.push(`Ton dragon atteint le niveau ${dragonLevel(after)}.`)
  }
  for (const active of before.spells) {
    if (!after.spells.some((s) => s.spell === active.spell)) events.push(`Le sort ${getSpell(active.spell).name} a pris fin.`)
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

/** Ce qui s'est passé aux portes de la cité. */
function siegeText(report: BattleReport): string {
  const foe = report.foe
  const name = foe.type === 'band' ? bandLabel(foe.kind, foe.level) : foeName(foe)
  if (report.outcome === 'victory') return `Raid repoussé aux portes de la cité : ${name}.`
  if (report.outcome === 'defeat') {
    const plunder = report.siege?.plunder ?? {}
    const taken = RESOURCE_IDS.filter((id) => plunder[id])
      .map((id) => `${RESOURCES[id].icon} ${formatAmount(plunder[id] ?? 0)}`)
      .join(' · ')
    return `Un raid a pillé ta cité : ${name}.${taken ? ` Il a emporté ${taken}.` : ''}`
  }
  return `Un raid a renoncé à prendre ta cité : ${name}.`
}
