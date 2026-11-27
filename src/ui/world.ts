// Les mots et les icônes de la carte des alentours : le nom des cibles et ce que font les armées.

import { NODE_KINDS, type MonsterId } from '../game/config'
import {
  battleHealth,
  getBand,
  getCamp,
  getMonster,
  getNode,
  raidArrival,
  type ArmyStatus,
  type Band,
  type Battle,
  type FieldArmy,
  type GameState,
  type Monsters,
  type Target,
} from '../game/rules'
import { foeName } from './battleLog'

/** Ce qui est choisi sur la carte : une cible (camp, bande, gisement), ou une de tes armées. */
export type Selection = { kind: 'target'; target: Target } | { kind: 'army'; id: number }

export const STATUS_ICONS: Record<ArmyStatus, string> = {
  marching: '🚩',
  idle: '⛺',
  fighting: '⚔️',
  gathering: '⛏️',
}

/** Le nom d'une bande : « Meute de loups (niv. 2) », ou « Raid : Meute de loups (niv. 2) ». */
export function bandName(band: Band): string {
  return foeName({ type: 'band', kind: band.kind, level: band.level, raid: band.raid })
}

/** Les bandes lancées à la poursuite de cette armée. */
export function chasers(state: GameState, armyId: number): Band[] {
  return state.bands.filter((band) => band.chase?.army === armyId)
}

/**
 * Les raids sur la carte, du premier qui atteindra la cité au dernier. `arrival` : l'heure de son
 * arrivée, ou null s'il se bat (contre une armée, ou aux portes de la cité).
 */
export function incomingRaids(state: GameState): { band: Band; arrival: number | null }[] {
  return state.bands
    .filter((band) => band.raid)
    .map((band) => ({ band, arrival: raidArrival(band) }))
    .sort((a, b) => (a.arrival ?? Infinity) - (b.arrival ?? Infinity))
}

/**
 * Ce qu'il faut pour animer une bataille sur la carte : la vie qui reste à chaque camp (de 0 à 1),
 * le numéro de la dernière manche jouée, et les dégâts de cette manche, de chaque côté.
 */
export interface FightFx {
  round: number
  ally: number
  foe: number
  dealt: number
  taken: number
}

export function fightFx(battle: Battle): FightFx {
  const health = battleHealth(battle)
  const last = battle.rounds[battle.rounds.length - 1]
  return {
    round: battle.rounds.length,
    ally: health.army.start > 0 ? health.army.now / health.army.start : 0,
    foe: health.foe.start > 0 ? health.foe.now / health.foe.start : 0,
    dealt: last?.dealt ?? 0,
    taken: last?.taken ?? 0,
  }
}

/** Une étincelle lancée d'un combattant à l'autre : le chemin qu'elle parcourt, pour l'animation. */
export function shot(from: { x: number; y: number }, to: { x: number; y: number }): Record<string, string> {
  return { '--dx': `${to.x - from.x}px`, '--dy': `${to.y - from.y}px` }
}

/** L'icône d'un groupe de monstres : celle du premier monstre encore debout. */
export function monstersIcon(monsters: Monsters): string {
  const first = (Object.keys(monsters) as MonsterId[]).find((id) => (monsters[id] ?? 0) > 0)
  return first ? getMonster(first).icon : '❔'
}

/** Le nom d'une cible : « Tanière de loups », « Meute de loups (niv. 2) », « Champs (niv. 1) »… */
export function targetName(state: GameState, target: Target): string {
  switch (target.type) {
    case 'point':
      return 'cet endroit'
    case 'camp':
      return getCamp(target.camp).name
    case 'band': {
      const band = getBand(state, target.band)
      return band ? bandName(band) : 'une bande disparue'
    }
    case 'node': {
      const node = getNode(state, target.node)
      return node ? `${NODE_KINDS[node.resource].name} (niv. ${node.level})` : 'un gisement épuisé'
    }
    case 'city':
      return 'la cité'
  }
}

/** Un ordre, en quelques mots : « Attaquer Tanière de loups », « Récolter Champs (niv. 1) »… */
export function orderText(state: GameState, target: Target): string {
  switch (target.type) {
    case 'point':
      return 'Aller à cet endroit'
    case 'camp':
      return `Attaquer : ${targetName(state, target)}`
    case 'band':
      return `${getBand(state, target.band)?.raid ? 'Intercepter' : 'Attaquer'} : ${targetName(state, target)}`
    case 'node':
      return `Récolter : ${targetName(state, target)}`
    case 'city':
      return 'Rentrer à la cité'
  }
}

/** Ce que fait une armée en ce moment. */
export function armyStatusText(state: GameState, army: FieldArmy): string {
  const order = army.order
  switch (army.status) {
    case 'marching':
      if (!order) return 'En marche'
      if (order.type === 'city') return 'Rentre à la cité'
      if (order.type === 'point') return 'En route'
      return `En route pour : ${targetName(state, order)}`
    case 'idle':
      return 'Attend tes ordres'
    case 'fighting': {
      const battle = state.battles.find((b) => b.army === army.id)
      return battle ? `Au combat contre : ${foeName(battle.foe)}` : 'Au combat'
    }
    case 'gathering':
      return order ? `Récolte : ${targetName(state, order)}` : 'Récolte'
  }
}
