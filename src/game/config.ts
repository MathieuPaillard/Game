// Tous les chiffres du jeu sont réunis ici.
// Pour équilibrer le jeu (coûts, durées, production), c'est ce fichier qu'on modifie.

export type ResourceId = 'food' | 'wood' | 'stone' | 'gold' | 'mana'
export type Resources = Record<ResourceId, number>

export const RESOURCE_IDS: ResourceId[] = ['food', 'wood', 'stone', 'gold', 'mana']

// Les icônes sont provisoires : elles seront remplacées par de vraies images.
export const RESOURCES: Record<ResourceId, { name: string; icon: string }> = {
  food: { name: 'Nourriture', icon: '🌾' },
  wood: { name: 'Bois', icon: '🪵' },
  stone: { name: 'Pierre', icon: '🪨' },
  gold: { name: 'Or', icon: '🪙' },
  mana: { name: 'Mana', icon: '🔮' },
}

export type RaceId = 'humans' | 'elves' | 'dwarves' | 'orcs'

export interface RaceDef {
  id: RaceId
  name: string
  style: string
  description: string
  /** Les bonus, tels qu'ils sont affichés au joueur. */
  bonuses: string[]
  /** Bonus de production par ressource : 0.1 = +10 %. */
  productionBonus: Partial<Resources>
  /** 0.1 = constructions 10 % plus rapides. */
  constructionSpeedBonus: number
}

export const RACES: RaceDef[] = [
  {
    id: 'humans',
    name: 'Humains',
    style: 'Polyvalents',
    description: 'Bâtisseurs infatigables, ils prospèrent partout où ils posent une pierre.',
    bonuses: ['Constructions 10 % plus rapides'],
    productionBonus: {},
    constructionSpeedBonus: 0.1,
  },
  {
    id: 'elves',
    name: 'Elfes',
    style: 'Magie et archerie',
    description: 'Gardiens des forêts anciennes, ils puisent leur force dans la mana.',
    bonuses: ['+10 % de bois', '+10 % de mana'],
    productionBonus: { wood: 0.1, mana: 0.1 },
    constructionSpeedBonus: 0,
  },
  {
    id: 'dwarves',
    name: 'Nains',
    style: 'Défense et artisanat',
    description: 'Maîtres des profondeurs, ils taillent la roche et forgent l’or.',
    bonuses: ['+10 % de pierre', '+10 % d’or'],
    productionBonus: { stone: 0.1, gold: 0.1 },
    constructionSpeedBonus: 0,
  },
  {
    id: 'orcs',
    name: 'Orcs',
    style: 'Force brute et nombre',
    description: 'Une horde affamée que rien n’arrête.',
    bonuses: ['+10 % de nourriture', 'Entraînement plus rapide (avec les armées)'],
    productionBonus: { food: 0.1 },
    constructionSpeedBonus: 0,
  },
]

export type BuildingId = 'castle' | 'farm' | 'sawmill' | 'quarry' | 'goldMine' | 'manaWell'

export interface BuildingDef {
  id: BuildingId
  name: string
  icon: string
  description: string
  /** Ressource produite (bâtiments de production uniquement). */
  produces?: ResourceId
  /** Production par heure au niveau 1. */
  baseProductionPerHour?: number
  /** Niveau du Château à atteindre avant de pouvoir construire ce bâtiment. */
  unlockedAtCastleLevel: number
  /** Coût du niveau 1. Chaque niveau suivant coûte COST_GROWTH fois plus que le précédent. */
  baseCost: Partial<Resources>
  /** Durée du niveau 1, en secondes. Chaque niveau suivant dure DURATION_GROWTH fois plus. */
  baseDurationSeconds: number
}

export const BUILDINGS: BuildingDef[] = [
  {
    id: 'castle',
    name: 'Château',
    icon: '🏰',
    description: 'Le cœur de ta cité. Aucun bâtiment ne peut dépasser son niveau.',
    unlockedAtCastleLevel: 0,
    baseCost: { food: 150, wood: 200, stone: 150, gold: 60, mana: 30 },
    baseDurationSeconds: 20,
  },
  {
    id: 'farm',
    name: 'Ferme',
    icon: '🌾',
    description: 'Nourrit ta population, et bientôt tes troupes.',
    produces: 'food',
    baseProductionPerHour: 1800,
    unlockedAtCastleLevel: 1,
    baseCost: { wood: 50, stone: 30 },
    baseDurationSeconds: 6,
  },
  {
    id: 'sawmill',
    name: 'Scierie',
    icon: '🪵',
    description: 'Le bois entre dans presque toutes les constructions.',
    produces: 'wood',
    baseProductionPerHour: 1800,
    unlockedAtCastleLevel: 1,
    baseCost: { food: 50, stone: 30 },
    baseDurationSeconds: 6,
  },
  {
    id: 'quarry',
    name: 'Carrière',
    icon: '🪨',
    description: 'La pierre des bâtiments solides et, plus tard, des remparts.',
    produces: 'stone',
    baseProductionPerHour: 1500,
    unlockedAtCastleLevel: 1,
    baseCost: { food: 50, wood: 40 },
    baseDurationSeconds: 6,
  },
  {
    id: 'goldMine',
    name: 'Mine d’or',
    icon: '🪙',
    description: 'L’or sert au Château et, bientôt, aux recherches et aux héros.',
    produces: 'gold',
    baseProductionPerHour: 900,
    unlockedAtCastleLevel: 1,
    baseCost: { food: 60, wood: 80, stone: 40 },
    baseDurationSeconds: 8,
  },
  {
    id: 'manaWell',
    name: 'Puits de mana',
    icon: '🔮',
    description: 'Une source de magie pure. La mana renforce le Château et servira aux sorts.',
    produces: 'mana',
    baseProductionPerHour: 600,
    unlockedAtCastleLevel: 2,
    baseCost: { wood: 100, stone: 100, gold: 40 },
    baseDurationSeconds: 10,
  },
]

/** Niveau maximum des bâtiments, pour l'instant. */
export const MAX_LEVEL = 10
/** Chaque niveau coûte 1,6 fois plus que le précédent. */
export const COST_GROWTH = 1.6
/** Chaque niveau dure 1,6 fois plus longtemps que le précédent. */
export const DURATION_GROWTH = 1.6
/** Chaque niveau produit 1,35 fois plus que le précédent. */
export const PRODUCTION_GROWTH = 1.35

export const START_RESOURCES: Resources = { food: 500, wood: 500, stone: 400, gold: 150, mana: 60 }

export const START_LEVELS: Record<BuildingId, number> = {
  castle: 1,
  farm: 1,
  sawmill: 1,
  quarry: 1,
  goldMine: 0,
  manaWell: 0,
}
