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
    description: '+1 armée dehors en même temps, par niveau',
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
  /** Entretien : nourriture mangée par heure par une troupe, dans la cité comme sur la carte. */
  upkeepPerHour: number
  /** Ressources qu'une troupe peut porter : le butin et la récolte rapportés à la cité. */
  load: number
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
    load: 20,
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
    load: 15,
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
    load: 30,
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
    load: 10,
  },
]

/** Une troupe inflige 1,5 fois plus de dégâts à la famille qu'elle domine. */
export const COUNTER_BONUS = 1.5
/** Quand les réserves de nourriture sont vides, les troupes ont faim : 0.3 = 30 % d'attaque en moins. */
export const STARVATION_ATTACK_MALUS = 0.3
/** Une manche de bataille se joue toutes les 2 secondes : une bataille dure un moment. */
export const BATTLE_ROUND_SECONDS = 2
/** Au-delà de ce nombre de manches, les deux camps se séparent sans vainqueur. */
export const MAX_BATTLE_ROUNDS = 100
/** Troupes maximum par entraînement, pour chaque niveau de Caserne. */
export const TRAINING_BATCH_PER_LEVEL = 20
/** Chaque niveau de Caserne au-delà du premier réduit de 10 % la durée d'entraînement. */
export const BARRACKS_SPEED_PER_LEVEL = 0.1

// --- Héros ---
// Un héros se recrute avec de l'or, puis mène une armée. Il gagne de l'expérience pour chaque
// monstre vaincu, et chaque niveau lui donne un point à placer dans l'une de ses compétences.

export type HeroId = 'ysolde' | 'durgan' | 'faelan' | 'garrok' | 'thalia'

/** Ce que rapporte chaque niveau d'une compétence, à l'armée que mène le héros. */
export type SkillEffect =
  /** Attaque de toute l'armée. */
  | { kind: 'attack'; perLevel: number }
  /** Vie de toute l'armée. */
  | { kind: 'health'; perLevel: number }
  /** Attaque d'une seule famille de troupes. */
  | { kind: 'familyAttack'; family: UnitId; perLevel: number }
  /** Temps de marche en moins, comme la Marche forcée. */
  | { kind: 'marchSpeed'; perLevel: number }
  /** Vitesse de récolte sur les gisements. */
  | { kind: 'gatherSpeed'; perLevel: number }
  /** Ce que l'armée peut porter. */
  | { kind: 'load'; perLevel: number }

export interface SkillDef {
  id: string
  name: string
  icon: string
  /** L'effet d'un niveau, tel qu'il est affiché au joueur. */
  description: string
  effect: SkillEffect
}

export interface HeroDef {
  id: HeroId
  name: string
  title: string
  icon: string
  description: string
  /** Niveau du Château nécessaire pour le recruter. */
  castleLevel: number
  /** Ce que coûte son recrutement. */
  cost: Partial<Resources>
  skills: SkillDef[]
}

export const HEROES: HeroDef[] = [
  {
    id: 'ysolde',
    name: 'Ysolde de Valcourt',
    title: 'Capitaine de la garde',
    icon: '🤺',
    description: 'Elle a tenu seule la porte d’un fort assiégé. Ses guerriers la suivraient n’importe où.',
    castleLevel: 2,
    cost: { gold: 150 },
    skills: [
      {
        id: 'shieldWall',
        name: 'Mur de boucliers',
        icon: '🛡️',
        description: '+3 % de vie pour toute l’armée, par niveau',
        effect: { kind: 'health', perLevel: 0.03 },
      },
      {
        id: 'spears',
        name: 'Lances dressées',
        icon: '🔱',
        description: '+6 % d’attaque des Guerriers, par niveau',
        effect: { kind: 'familyAttack', family: 'warrior', perLevel: 0.06 },
      },
      {
        id: 'rally',
        name: 'Cri de ralliement',
        icon: '📯',
        description: '+3 % d’attaque pour toute l’armée, par niveau',
        effect: { kind: 'attack', perLevel: 0.03 },
      },
    ],
  },
  {
    id: 'durgan',
    name: 'Durgan Barbe-de-Granite',
    title: 'Maître des mines',
    icon: '🧔',
    description: 'Un vieux nain qui flaire un filon à des lieues. Avec lui, une armée récolte plus vite et rapporte davantage.',
    castleLevel: 2,
    cost: { gold: 100 },
    skills: [
      {
        id: 'pickaxes',
        name: 'Pioches bénies',
        icon: '⛏️',
        description: '+10 % de vitesse de récolte, par niveau',
        effect: { kind: 'gatherSpeed', perLevel: 0.1 },
      },
      {
        id: 'baskets',
        name: 'Hottes renforcées',
        icon: '🧺',
        description: '+10 % de charge, par niveau',
        effect: { kind: 'load', perLevel: 0.1 },
      },
      {
        id: 'shortcuts',
        name: 'Raccourcis de mineur',
        icon: '🥾',
        description: '−6 % de temps de marche, par niveau',
        effect: { kind: 'marchSpeed', perLevel: 0.06 },
      },
    ],
  },
  {
    id: 'faelan',
    name: 'Faëlan Flèche-d’Argent',
    title: 'Maître archer',
    icon: '🧝',
    description: 'Un archer elfe qui ne manque jamais sa cible, et qui connaît chaque sentier de la forêt.',
    castleLevel: 3,
    cost: { gold: 300, mana: 40 },
    skills: [
      {
        id: 'volley',
        name: 'Pluie de flèches',
        icon: '🏹',
        description: '+6 % d’attaque des Archers, par niveau',
        effect: { kind: 'familyAttack', family: 'archer', perLevel: 0.06 },
      },
      {
        id: 'trails',
        name: 'Sentiers secrets',
        icon: '🍃',
        description: '−6 % de temps de marche, par niveau',
        effect: { kind: 'marchSpeed', perLevel: 0.06 },
      },
      {
        id: 'aim',
        name: 'Tir précis',
        icon: '🎯',
        description: '+3 % d’attaque pour toute l’armée, par niveau',
        effect: { kind: 'attack', perLevel: 0.03 },
      },
    ],
  },
  {
    id: 'garrok',
    name: 'Garrok aux Deux Haches',
    title: 'Chef de guerre',
    icon: '🪓',
    description: 'Un orc colossal qui mène ses cavaliers à la charge en hurlant.',
    castleLevel: 4,
    cost: { gold: 500 },
    skills: [
      {
        id: 'charge',
        name: 'Charge sauvage',
        icon: '🐎',
        description: '+6 % d’attaque des Cavaliers, par niveau',
        effect: { kind: 'familyAttack', family: 'rider', perLevel: 0.06 },
      },
      {
        id: 'thickHide',
        name: 'Cuir épais',
        icon: '🐗',
        description: '+3 % de vie pour toute l’armée, par niveau',
        effect: { kind: 'health', perLevel: 0.03 },
      },
      {
        id: 'gallop',
        name: 'Galop furieux',
        icon: '💨',
        description: '−6 % de temps de marche, par niveau',
        effect: { kind: 'marchSpeed', perLevel: 0.06 },
      },
    ],
  },
  {
    id: 'thalia',
    name: 'Thalia des Brumes',
    title: 'Archimage',
    icon: '🧙‍♀️',
    description: 'Elle a étudié la magie dans les tours oubliées du Nord. Ses mages frappent comme la foudre.',
    castleLevel: 5,
    cost: { gold: 800, mana: 150 },
    skills: [
      {
        id: 'lightning',
        name: 'Foudre',
        icon: '⚡',
        description: '+6 % d’attaque des Mages, par niveau',
        effect: { kind: 'familyAttack', family: 'mage', perLevel: 0.06 },
      },
      {
        id: 'ward',
        name: 'Bouclier arcanique',
        icon: '🔮',
        description: '+3 % de vie pour toute l’armée, par niveau',
        effect: { kind: 'health', perLevel: 0.03 },
      },
      {
        id: 'lore',
        name: 'Savoir ancien',
        icon: '📖',
        description: '+3 % d’attaque pour toute l’armée, par niveau',
        effect: { kind: 'attack', perLevel: 0.03 },
      },
    ],
  },
]

/** Niveau maximum d'un héros. Chaque niveau donne un point de compétence (le premier aussi). */
export const HERO_MAX_LEVEL = 10
/** Niveau maximum d'une compétence : un héros ne peut pas tout apprendre, il faut choisir. */
export const SKILL_MAX_LEVEL = 5
/** L'expérience pour passer du niveau 1 au niveau 2 ; chaque niveau suivant en demande 1,5 fois plus. */
export const HERO_BASE_XP = 100
export const HERO_XP_GROWTH = 1.5

// --- La carte des alentours ---

/** Un point de la carte des alentours, en unités de carte. */
export interface Point {
  x: number
  y: number
}

/** La carte des alentours : sa taille, et la cité en son centre. */
export const WORLD: { width: number; height: number; city: Point } = {
  width: 1600,
  height: 1200,
  city: { x: 800, y: 620 },
}

/** Vitesse de marche des armées, en unités de carte par seconde (Marche forcée l'augmente). */
export const MARCH_SPEED = 10
/** Tant que des armées sont dehors, le monde avance par pas d'une seconde. */
export const WORLD_TICK_SECONDS = 1

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
  /** L'expérience que gagne le héros d'une armée pour chacun de ces monstres vaincus. */
  xp: number
}

export const MONSTERS: MonsterDef[] = [
  { id: 'wolf', name: 'Loups', icon: '🐺', family: 'rider', attack: 12, health: 40, xp: 5 },
  { id: 'goblin', name: 'Gobelins', icon: '👺', family: 'warrior', attack: 8, health: 35, xp: 4 },
  { id: 'skeleton', name: 'Squelettes archers', icon: '💀', family: 'archer', attack: 11, health: 25, xp: 4 },
  { id: 'shaman', name: 'Chamans', icon: '🔥', family: 'mage', attack: 18, health: 20, xp: 6 },
  { id: 'troll', name: 'Trolls', icon: '👹', family: 'warrior', attack: 40, health: 400, xp: 30 },
]

export type CampId = 'wolfDen' | 'goblinCamp' | 'hauntedRuins' | 'trollLair'

export interface CampDef {
  id: CampId
  name: string
  level: number
  /** Sa place sur la carte des alentours. */
  position: Point
  defenders: Partial<Record<MonsterId, number>>
  /** Ce que l'armée rapporte en cas de victoire. */
  loot: Partial<Resources>
}

export const CAMPS: CampDef[] = [
  {
    id: 'wolfDen',
    name: 'Tanière de loups',
    level: 1,
    position: { x: 560, y: 470 },
    defenders: { wolf: 8 },
    loot: { food: 250, wood: 150 },
  },
  {
    id: 'goblinCamp',
    name: 'Campement gobelin',
    level: 2,
    position: { x: 1110, y: 430 },
    defenders: { goblin: 14, shaman: 4 },
    loot: { food: 400, wood: 400, stone: 250, gold: 80 },
  },
  {
    id: 'hauntedRuins',
    name: 'Ruines hantées',
    level: 3,
    position: { x: 1190, y: 870 },
    defenders: { skeleton: 26, shaman: 6 },
    loot: { stone: 700, gold: 250, mana: 100 },
  },
  {
    id: 'trollLair',
    name: 'Antre du troll',
    level: 4,
    position: { x: 360, y: 930 },
    defenders: { troll: 2, goblin: 30, wolf: 15 },
    loot: { food: 1200, wood: 1200, stone: 900, gold: 450, mana: 200 },
  },
]

// --- Les bandes de monstres ---
// Elles apparaissent peu à peu sur la carte des alentours, d'autant plus fortes qu'elles sont loin
// de la cité, et patrouillent autour de leur repaire. Chacune a une zone autour d'elle (sa zone
// d'aggro) : elle attaque toute armée qui y entre.

export type BandKindId = 'wolves' | 'goblins' | 'skeletons' | 'trolls'

export interface BandKindDef {
  id: BandKindId
  name: string
  /**
   * Les monstres d'une bande de niveau 1 : chaque niveau au-dessus multiplie leur nombre par
   * BAND_GROWTH. (Les sortes qui n'apparaissent qu'à un niveau élevé suivent le même calcul.)
   */
  monsters: Partial<Record<MonsterId, number>>
  /** Le butin d'une bande de niveau 1 : chaque niveau au-dessus le multiplie par BAND_LOOT_GROWTH. */
  loot: Partial<Resources>
  /** Cette sorte de bande n'apparaît qu'à partir de ce niveau. */
  minLevel: number
}

export const BAND_KINDS: BandKindDef[] = [
  { id: 'wolves', name: 'Meute de loups', monsters: { wolf: 5 }, loot: { food: 120, wood: 60 }, minLevel: 1 },
  {
    id: 'goblins',
    name: 'Pillards gobelins',
    monsters: { goblin: 8, shaman: 1 },
    loot: { food: 100, wood: 100, gold: 25 },
    minLevel: 1,
  },
  {
    id: 'skeletons',
    name: 'Patrouille de squelettes',
    monsters: { skeleton: 10, shaman: 2 },
    loot: { stone: 120, gold: 40, mana: 20 },
    minLevel: 2,
  },
  {
    id: 'trolls',
    name: 'Bande de trolls',
    monsters: { troll: 1, goblin: 12 },
    loot: { food: 300, wood: 200, stone: 200, gold: 80, mana: 40 },
    minLevel: 4,
  },
]

export const MAX_BAND_LEVEL = 5
export const BAND_GROWTH = 1.45
export const BAND_LOOT_GROWTH = 1.6
/** Le niveau d'une bande dépend de sa distance à la cité : niveau 1 jusqu'à 335, puis un de plus tous les 135. */
export const BAND_LEVEL_START = 200
export const BAND_LEVEL_RING = 135
/** Une bande sur quatre a un niveau de plus que ne le voudrait sa distance. */
export const BAND_LEVEL_UP_CHANCE = 0.25
/** Rayon de la zone d'aggro d'une bande de niveau 1, et ce que chaque niveau y ajoute. */
export const BAND_AGGRO_RADIUS = 55
export const BAND_AGGRO_PER_LEVEL = 12
/** Les bandes présentes au début de la partie, et le maximum sur la carte. */
export const START_BANDS = 4
export const MAX_BANDS = 8
/** Tant qu'il reste de la place, une nouvelle bande apparaît toutes les 90 secondes. */
export const BAND_SPAWN_SECONDS = 90
/** Une bande fait des rondes autour de son repaire, sur une boucle de ce rayon, à cette vitesse (par seconde). */
export const PATROL_RADIUS = 60
export const PATROL_SPEED = 4

/** Les endroits où une bande peut installer son repaire, du plus près au plus loin de la cité. */
export const BAND_SPOTS: Point[] = [
  { x: 800, y: 380 },
  { x: 590, y: 760 },
  { x: 1020, y: 750 },
  { x: 1040, y: 560 },
  { x: 520, y: 600 },
  { x: 760, y: 880 },
  { x: 930, y: 210 },
  { x: 640, y: 230 },
  { x: 1260, y: 600 },
  { x: 360, y: 760 },
  { x: 900, y: 1060 },
  { x: 450, y: 360 },
  { x: 330, y: 470 },
  { x: 1350, y: 470 },
  { x: 1150, y: 1090 },
  { x: 1100, y: 100 },
  { x: 200, y: 560 },
  { x: 740, y: 1110 },
  { x: 1440, y: 330 },
  { x: 1460, y: 760 },
  { x: 300, y: 1120 },
  { x: 220, y: 200 },
  { x: 1490, y: 1090 },
  { x: 110, y: 110 },
  { x: 1490, y: 110 },
]

// --- Les gisements de ressources ---
// Des champs, des scieries, des carrières, des mines et des sources de mana, sur la carte des
// alentours. Une armée peut aller y récolter : chaque troupe récolte un peu chaque seconde, et
// l'armée rentre à la cité quand elle ne peut plus rien porter, ou que le gisement est épuisé.

export interface NodeKindDef {
  name: string
  icon: string
  /** Ce que contient un gisement de niveau 1 : chaque niveau au-dessus le multiplie par NODE_GROWTH. */
  amount: number
  /** Ce qu'une troupe récolte par seconde. */
  gatherRate: number
}

/** Une sorte de gisement par ressource. */
export const NODE_KINDS: Record<ResourceId, NodeKindDef> = {
  food: { name: 'Champs', icon: '🌾', amount: 1500, gatherRate: 0.3 },
  wood: { name: 'Scierie', icon: '🪵', amount: 1500, gatherRate: 0.3 },
  stone: { name: 'Carrière', icon: '🪨', amount: 1200, gatherRate: 0.25 },
  gold: { name: 'Mine d’or', icon: '⛏️', amount: 400, gatherRate: 0.1 },
  mana: { name: 'Source de mana', icon: '🔮', amount: 200, gatherRate: 0.06 },
}

export const NODE_GROWTH = 1.6
/** Les gisements présents au début de la partie, et le maximum sur la carte. */
export const START_NODES = 6
export const MAX_NODES = 10
/** Un gisement épuisé est remplacé : un nouveau apparaît toutes les 60 secondes, tant qu'il reste de la place. */
export const NODE_SPAWN_SECONDS = 60

/** Les endroits où un gisement peut apparaître. Leur niveau dépend aussi de la distance à la cité. */
export const NODE_SPOTS: Point[] = [
  { x: 680, y: 400 },
  { x: 980, y: 470 },
  { x: 900, y: 830 },
  { x: 600, y: 900 },
  { x: 420, y: 650 },
  { x: 1180, y: 700 },
  { x: 580, y: 1010 },
  { x: 780, y: 150 },
  { x: 1010, y: 1120 },
  { x: 520, y: 130 },
  { x: 270, y: 380 },
  { x: 1390, y: 620 },
  { x: 1000, y: 120 },
  { x: 120, y: 720 },
  { x: 1330, y: 1060 },
  { x: 1510, y: 480 },
]

/** Nombre de rapports de bataille conservés. */
export const MAX_REPORTS = 8

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
