// Le résumé « Bon retour » : ce qui s'est passé pendant que le joueur n'était pas là.

import { RESOURCE_IDS, type Resources } from '../game/config'
import { armySize, emptyResources, getBuilding, getCamp, getTech, getUnit, type GameState } from '../game/rules'

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
  const works = before.construction
  if (works && !after.construction) {
    events.push(`${getBuilding(works.building).name} : le niveau ${works.targetLevel} est terminé.`)
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
    events.push(`${report.victory ? 'Victoire' : 'Défaite'} contre : ${getCamp(report.camp).name}.`)
  }
  for (const expedition of before.expeditions) {
    if (after.expeditions.some((e) => e.camp === expedition.camp && e.departedAt === expedition.departedAt)) continue
    const report = after.reports.find((r) => r.at === expedition.arrivesAt && r.camp === expedition.camp)
    const survived = report !== undefined && armySize(report.sent) > armySize(report.lost)
    if (expedition.result || survived) {
      events.push(`Ton armée est rentrée de : ${getCamp(expedition.camp).name}.`)
    }
  }
  return { duration, gains, events }
}
