// Ce que le joueur a touché sur l'écran de jeu, et le panneau ouvert à côté de la carte.

import type { BuildingId } from '../game/config'
import type { Selection } from './world'

/** Ce qu'on peut toucher sur la carte de la cité : un bâtiment, la garnison ou les héros. */
export type CitySelection = { kind: 'building'; id: BuildingId } | { kind: 'garrison' } | { kind: 'heroes' }

/**
 * Le panneau ouvert à côté de la carte : ce qu'on vient de toucher (dans la cité ou aux alentours),
 * ou l'une des pages du jeu (l'objectif, les rapports de bataille, le menu).
 */
export type Panel = CitySelection | Selection | { kind: 'quest' } | { kind: 'reports' } | { kind: 'menu' }
