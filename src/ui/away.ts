// Le résumé « Bon retour » : ce qui s'est passé pendant que le joueur n'était pas là.

import { RESOURCE_IDS, type Resources } from '../game/config'
import { emptyResources, getBuilding, getHeroDef, getTech, getUnit, type GameState } from '../game/rules'
import { OUTCOME_NAMES, foeName } from './battleLog'

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
  const newBands = after.bands.filter((band) => !before.bands.some((b) => b.id === band.id)).length
  if (newBands === 1) events.push('Une nouvelle bande de monstres rôde aux alentours.')
  if (newBands > 1) events.push(`${newBands} nouvelles bandes de monstres rôdent aux alentours.`)
  const newNodes = after.nodes.filter((node) => !before.nodes.some((n) => n.id === node.id)).length
  if (newNodes === 1) events.push('Un nouveau gisement de ressources est apparu.')
  if (newNodes > 1) events.push(`${newNodes} nouveaux gisements de ressources sont apparus.`)
  return { duration, gains, events }
}
