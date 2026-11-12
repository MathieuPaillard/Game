// Tous les chiffres du jeu sont réunis ici.
// Pour équilibrer le jeu (coûts, durées, production, combats), c'est ce fichier qu'on modifie.

// --- Ressources ---

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

// --- Races ---

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
  /** 0.1 = entraînement des troupes 10 % plus rapide. */
  trainingSpeedBonus: number
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
    trainingSpeedBonus: 0,
  },
  {
    id: 'elves',
    name: 'Elfes',
    style: 'Magie et archerie',
    description: 'Gardiens des forêts anciennes, ils puisent leur force dans la mana.',
    bonuses: ['+10 % de bois', '+10 % de mana'],
    productionBonus: { wood: 0.1, mana: 0.1 },
    constructionSpeedBonus: 0,
    trainingSpeedBonus: 0,
  },
  {
    id: 'dwarves',
    name: 'Nains',
    style: 'Défense et artisanat',
    description: 'Maîtres des profondeurs, ils taillent la roche et forgent l’or.',
    bonuses: ['+10 % de pierre', '+10 % d’or'],
    productionBonus: { stone: 0.1, gold: 0.1 },
    constructionSpeedBonus: 0,
    trainingSpeedBonus: 0,
  },
  {
    id: 'orcs',
    name: 'Orcs',
    style: 'Force brute et nombre',
    description: 'Une horde affamée que rien n’arrête.',
    bonuses: ['+10 % de nourriture', 'Entraînement 10 % plus rapide'],
    productionBonus: { food: 0.1 },
    constructionSpeedBonus: 0,
    trainingSpeedBonus: 0.1,
  },
]

// --- Bâtiments ---

export type BuildingId = 'castle' | 'farm' | 'sawmill' | 'quarry' | 'goldMine' | 'manaWell' | 'barracks' | 'academy'

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
    description: 'Nourrit ta population et tes troupes.',
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
    description: 'L’or paie le Château, les cavaliers et les mages.',
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
    description: 'Une source de magie pure, pour le Château et les mages.',
    produces: 'mana',
    baseProductionPerHour: 600,
    unlockedAtCastleLevel: 2,
    baseCost: { wood: 100, stone: 100, gold: 40 },
    baseDurationSeconds: 10,
  },
  {
    id: 'barracks',
    name: 'Caserne',
    icon: '⚔️',
    description: 'Entraîne tes troupes. Chaque niveau débloque des troupes et accélère l’entraînement.',
    unlockedAtCastleLevel: 2,
    baseCost: { food: 120, wood: 160, stone: 100 },
    baseDurationSeconds: 12,
  },
  {
    id: 'academy',
    name: 'Académie',
    icon: '📜',
    description: 'Tes savants y mènent les recherches. Chaque niveau en débloque de nouvelles.',
    unlockedAtCastleLevel: 3,
    baseCost: { food: 250, wood: 300, stone: 250, gold: 120, mana: 40 },
    baseDurationSeconds: 25,
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

// --- Recherches ---

export type TechId =
  | 'agriculture'
  | 'tools'
  | 'forge'
  | 'command'
  | 'alchemy'
  | 'armor'
  | 'masonry'
  | 'forcedMarch'

/** Ce que rapporte chaque niveau d'une recherche. */
export type TechEffect =
  | { kind: 'production'; resources: ResourceId[]; perLevel: number }
  | { kind: 'attack'; perLevel: number }
  | { kind: 'health'; perLevel: number }
  | { kind: 'armies'; perLevel: number }
  | { kind: 'marchSpeed'; perLevel: number }
  | { kind: 'constructionSpeed'; perLevel: number }

export interface TechDef {
  id: TechId
  name: string
  icon: string
  /** L'effet d'un niveau, tel qu'il est affiché au joueur. */
  description: string
  effect: TechEffect
  maxLevel: number
  /** Niveau d'Académie nécessaire pour commencer cette recherche. */
  unlockedAtAcademyLevel: number
  /** Coût du niveau 1. Chaque niveau suivant coûte COST_GROWTH fois plus que le précédent. */
  baseCost: Partial<Resources>
  /** Durée du niveau 1, en secondes. Chaque niveau suivant dure DURATION_GROWTH fois plus. */
  baseDurationSeconds: number
}

// Une recherche ne peut pas dépasser le niveau de l'Académie.
export const TECHS: TechDef[] = [
  {
    id: 'agriculture',
    name: 'Agriculture',
    icon: '🌱',
    description: '+10 % de nourriture par niveau',
    effect: { kind: 'production', resources: ['food'], perLevel: 0.1 },
    maxLevel: 5,
    unlockedAtAcademyLevel: 1,
    baseCost: { wood: 150, stone: 100, gold: 50 },
    baseDurationSeconds: 20,
  },
  {
    id: 'tools',
    name: 'Outils de qualité',
    icon: '🪓',
    description: '+10 % de bois et de pierre par niveau',
    effect: { kind: 'production', resources: ['wood', 'stone'], perLevel: 0.1 },
    maxLevel: 5,
    unlockedAtAcademyLevel: 1,
    baseCost: { food: 150, gold: 60 },
    baseDurationSeconds: 20,
  },
  {
    id: 'forge',
    name: 'Forge',
    icon: '⚒️',
    description: '+5 % d’attaque pour toutes les troupes, par niveau',
    effect: { kind: 'attack', perLevel: 0.05 },
    maxLevel: 5,
    unlockedAtAcademyLevel: 1,
    baseCost: { wood: 200, stone: 150, gold: 80 },
    baseDurationSeconds: 25,
  },
  {
    id: 'command',
    name: 'Commandement',
    icon: '🚩',
    description: '+1 armée en campagne en même temps, par niveau',
    effect: { kind: 'armies', perLevel: 1 },
    maxLevel: 2,
    unlockedAtAcademyLevel: 1,
    baseCost: { food: 400, wood: 300, gold: 150 },
    baseDurationSeconds: 40,
  },
  {
    id: 'alchemy',
    name: 'Alchimie',
    icon: '⚗️',
    description: '+10 % d’or et de mana par niveau',
    effect: { kind: 'production', resources: ['gold', 'mana'], perLevel: 0.1 },
    maxLevel: 5,
    unlockedAtAcademyLevel: 2,
    baseCost: { food: 200, wood: 200, mana: 40 },
    baseDurationSeconds: 30,
  },
  {
    id: 'armor',
    name: 'Armures',
    icon: '⛓️',
    description: '+5 % de vie pour toutes les troupes, par niveau',
    effect: { kind: 'health', perLevel: 0.05 },
    maxLevel: 5,
    unlockedAtAcademyLevel: 2,
    baseCost: { stone: 200, gold: 100 },
    baseDurationSeconds: 25,
  },
  {
    id: 'masonry',
    name: 'Maçonnerie',
    icon: '🧱',
    description: '−5 % de durée de construction par niveau',
    effect: { kind: 'constructionSpeed', perLevel: 0.05 },
    maxLevel: 5,
    unlockedAtAcademyLevel: 2,
    baseCost: { wood: 250, stone: 250, gold: 60 },
    baseDurationSeconds: 25,
  },
  {
    id: 'forcedMarch',
    name: 'Marche forcée',
    icon: '🥾',
    description: '−10 % de temps de marche par niveau',
    effect: { kind: 'marchSpeed', perLevel: 0.1 },
    maxLevel: 3,
    unlockedAtAcademyLevel: 3,
    baseCost: { food: 300, gold: 120 },
    baseDurationSeconds: 30,
  },
]

// --- Troupes ---

export type UnitId = 'warrior' | 'archer' | 'rider' | 'mage'
/** Un nombre de troupes pour chaque famille. */
export type Army = Record<UnitId, number>

export const UNIT_IDS: UnitId[] = ['warrior', 'archer', 'rider', 'mage']

export interface UnitDef {
  id: UnitId
  name: string
  icon: string
  description: string
  attack: number
  health: number
  /** Famille à laquelle cette troupe inflige COUNTER_BONUS fois plus de dégâts. */
  strongAgainst: UnitId
  /** Coût d'une seule troupe. */
  cost: Partial<Resources>
  /** Durée d'entraînement d'une seule troupe, en secondes. */
  trainingSeconds: number
  /** Niveau de Caserne nécessaire pour l'entraîner. */
  barracksLevel: number
  /** Entretien : nourriture mangée par heure par une troupe, dans la cité comme en campagne. */
  upkeepPerHour: number
}

// Les forces et faiblesses forment un cycle :
// Guerriers > Cavaliers > Archers > Mages > Guerriers.
export const UNITS: UnitDef[] = [
  {
    id: 'warrior',
    name: 'Guerriers',
    icon: '🛡️',
    description: 'Solides et bon marché. Leurs lances brisent les charges.',
    attack: 10,
    health: 50,
    strongAgainst: 'rider',
    cost: { food: 30, wood: 10 },
    trainingSeconds: 3,
    barracksLevel: 1,
    upkeepPerHour: 4,
  },
  {
    id: 'archer',
    name: 'Archers',
    icon: '🏹',
    description: 'Ils tirent de loin et abattent les mages avant qu’ils n’incantent.',
    attack: 14,
    health: 30,
    strongAgainst: 'mage',
    cost: { food: 25, wood: 25 },
    trainingSeconds: 3,
    barracksLevel: 1,
    upkeepPerHour: 4,
  },
  {
    id: 'rider',
    name: 'Cavaliers',
    icon: '🐎',
    description: 'Rapides et puissants, ils balaient les lignes d’archers.',
    attack: 16,
    health: 60,
    strongAgainst: 'archer',
    cost: { food: 50, wood: 10, gold: 15 },
    trainingSeconds: 5,
    barracksLevel: 2,
    upkeepPerHour: 8,
  },
  {
    id: 'mage',
    name: 'Mages',
    icon: '🧙',
    description: 'Fragiles, mais leurs sorts traversent les armures.',
    attack: 24,
    health: 25,
    strongAgainst: 'warrior',
    cost: { food: 30, gold: 10, mana: 20 },
    trainingSeconds: 6,
    barracksLevel: 3,
    upkeepPerHour: 6,
  },
]

/** Une troupe inflige 1,5 fois plus de dégâts à la famille qu'elle domine. */
export const COUNTER_BONUS = 1.5
/** Quand les réserves de nourriture sont vides, les troupes ont faim : 0.3 = 30 % d'attaque en moins. */
export const STARVATION_ATTACK_MALUS = 0.3
/** Une bataille s'arrête au plus tard après ce nombre de manches. */
export const MAX_BATTLE_ROUNDS = 10
/** Troupes maximum par entraînement, pour chaque niveau de Caserne. */
export const TRAINING_BATCH_PER_LEVEL = 20
/** Chaque niveau de Caserne au-delà du premier réduit de 10 % la durée d'entraînement. */
export const BARRACKS_SPEED_PER_LEVEL = 0.1

// --- Monstres et camps ---

export type MonsterId = 'wolf' | 'goblin' | 'skeleton' | 'shaman' | 'troll'

export interface MonsterDef {
  id: MonsterId
  name: string
  icon: string
  /** Famille de troupe dont le monstre a les forces et les faiblesses. */
  family: UnitId
  attack: number
  health: number
}

export const MONSTERS: MonsterDef[] = [
  { id: 'wolf', name: 'Loups', icon: '🐺', family: 'rider', attack: 12, health: 40 },
  { id: 'goblin', name: 'Gobelins', icon: '👺', family: 'warrior', attack: 8, health: 35 },
  { id: 'skeleton', name: 'Squelettes archers', icon: '💀', family: 'archer', attack: 11, health: 25 },
  { id: 'shaman', name: 'Chamans', icon: '🔥', family: 'mage', attack: 18, health: 20 },
  { id: 'troll', name: 'Trolls', icon: '👹', family: 'warrior', attack: 40, health: 400 },
]

export type CampId = 'wolfDen' | 'goblinCamp' | 'hauntedRuins' | 'trollLair'

export interface CampDef {
  id: CampId
  name: string
  level: number
  /** Durée de la marche pour y aller (le retour prend autant de temps), en secondes. */
  marchSeconds: number
  defenders: Partial<Record<MonsterId, number>>
  /** Ce que l'armée rapporte en cas de victoire. */
  loot: Partial<Resources>
}

export const CAMPS: CampDef[] = [
  {
    id: 'wolfDen',
    name: 'Tanière de loups',
    level: 1,
    marchSeconds: 20,
    defenders: { wolf: 8 },
    loot: { food: 250, wood: 150 },
  },
  {
    id: 'goblinCamp',
    name: 'Campement gobelin',
    level: 2,
    marchSeconds: 40,
    defenders: { goblin: 14, shaman: 4 },
    loot: { food: 400, wood: 400, stone: 250, gold: 80 },
  },
  {
    id: 'hauntedRuins',
    name: 'Ruines hantées',
    level: 3,
    marchSeconds: 60,
    defenders: { skeleton: 26, shaman: 6 },
    loot: { stone: 700, gold: 250, mana: 100 },
  },
  {
    id: 'trollLair',
    name: 'Antre du troll',
    level: 4,
    marchSeconds: 90,
    defenders: { troll: 2, goblin: 30, wolf: 15 },
    loot: { food: 1200, wood: 1200, stone: 900, gold: 450, mana: 200 },
  },
]

/** Nombre de rapports de bataille conservés. */
export const MAX_REPORTS = 5

// --- Départ ---

export const START_RESOURCES: Resources = { food: 500, wood: 500, stone: 400, gold: 150, mana: 60 }

export const START_LEVELS: Record<BuildingId, number> = {
  castle: 1,
  farm: 1,
  sawmill: 1,
  quarry: 1,
  goldMine: 0,
  manaWell: 0,
  barracks: 0,
  academy: 0,
}
