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

export type BuildingId =
  | 'castle'
  | 'farm'
  | 'sawmill'
  | 'quarry'
  | 'goldMine'
  | 'manaWell'
  | 'barracks'
  | 'academy'
  | 'mageTower'
  | 'walls'

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
  {
    id: 'mageTower',
    name: 'Tour des mages',
    icon: '🪄',
    description: 'Tes mages y lancent des sorts : contre du mana, un bienfait de quelques minutes. Chaque niveau en débloque un nouveau.',
    unlockedAtCastleLevel: 4,
    baseCost: { wood: 300, stone: 400, gold: 200, mana: 150 },
    baseDurationSeconds: 30,
  },
  {
    id: 'walls',
    name: 'Remparts',
    icon: '🧱',
    description: 'Ils défendent la cité contre les raids : des gardes y veillent, et tes troupes s’y battent mieux.',
    unlockedAtCastleLevel: 3,
    baseCost: { wood: 200, stone: 350, gold: 60 },
    baseDurationSeconds: 20,
  },
]

/** Niveau maximum des bâtiments, pour l'instant. */
export const MAX_LEVEL = 10
/** Un seul chantier à la fois au début : un second s'ouvre à ce niveau du Château. */
export const SECOND_CONSTRUCTION_CASTLE_LEVEL = 5
/** Chaque niveau coûte 1,6 fois plus que le précédent. */
export const COST_GROWTH = 1.6
/** Chaque niveau dure 1,6 fois plus longtemps que le précédent. */
export const DURATION_GROWTH = 1.6
/** Chaque niveau produit 1,35 fois plus que le précédent. */
export const PRODUCTION_GROWTH = 1.35

// --- Sorts ---
// La Tour des mages lance des sorts : contre du mana, un bienfait pour toute la cité, ou pour
// toutes les armées, pendant quelques minutes. Un même sort ne se lance pas deux fois à la fois.

export type SpellId = 'harvest' | 'growth' | 'fury' | 'tailwind' | 'stoneskin'

/** Ce que fait un sort tant qu'il agit : 0.25 veut dire +25 %. */
export type SpellEffect =
  | { kind: 'production'; resources: ResourceId[]; amount: number }
  | { kind: 'attack'; amount: number }
  /** La vie des troupes, pour les batailles qui commencent pendant le sort. */
  | { kind: 'health'; amount: number }
  /** Temps de marche en moins. */
  | { kind: 'marchSpeed'; amount: number }

export interface SpellDef {
  id: SpellId
  name: string
  icon: string
  /** Son effet, tel qu'il est affiché au joueur. */
  description: string
  effect: SpellEffect
  /** Niveau de la Tour des mages nécessaire pour le lancer. */
  towerLevel: number
  cost: Partial<Resources>
  durationSeconds: number
}

export const SPELLS: SpellDef[] = [
  {
    id: 'harvest',
    name: 'Moisson abondante',
    icon: '🌾',
    description: '+25 % de nourriture',
    effect: { kind: 'production', resources: ['food'], amount: 0.25 },
    towerLevel: 1,
    cost: { mana: 60 },
    durationSeconds: 600,
  },
  {
    id: 'growth',
    name: 'Sève vive',
    icon: '🌳',
    description: '+25 % de bois et de pierre',
    effect: { kind: 'production', resources: ['wood', 'stone'], amount: 0.25 },
    towerLevel: 2,
    cost: { mana: 100 },
    durationSeconds: 600,
  },
  {
    id: 'fury',
    name: 'Fureur guerrière',
    icon: '🗡️',
    description: '+15 % d’attaque pour toutes tes armées',
    effect: { kind: 'attack', amount: 0.15 },
    towerLevel: 3,
    cost: { mana: 150 },
    durationSeconds: 300,
  },
  {
    id: 'tailwind',
    name: 'Vent porteur',
    icon: '🌬️',
    description: '−20 % de temps de marche pour toutes tes armées',
    effect: { kind: 'marchSpeed', amount: 0.2 },
    towerLevel: 4,
    cost: { mana: 150 },
    durationSeconds: 300,
  },
  {
    id: 'stoneskin',
    name: 'Peau de pierre',
    icon: '🗿',
    description: '+15 % de vie pour tes troupes, dans les batailles qui commencent',
    effect: { kind: 'health', amount: 0.15 },
    towerLevel: 5,
    cost: { mana: 200 },
    durationSeconds: 300,
  },
]

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

/** Les quatre familles de troupes, chacune avec ses forces et ses faiblesses. */
export type Family = 'warrior' | 'archer' | 'rider' | 'mage'
/** Les troupes : une par famille, plus une troupe propre à chaque race. */
export type UnitId = Family | 'paladin' | 'crossbowman' | 'wolfRider' | 'druid'
/** Un nombre de troupes pour chaque type de troupe. */
export type Army = Record<UnitId, number>

export const UNIT_IDS: UnitId[] = ['warrior', 'archer', 'rider', 'mage', 'paladin', 'crossbowman', 'wolfRider', 'druid']

export interface UnitDef {
  id: UnitId
  name: string
  icon: string
  description: string
  /** La famille dont elle a les forces et les faiblesses. */
  family: Family
  /** Une troupe propre à une race : elle seule peut l'entraîner. */
  race?: RaceId
  attack: number
  health: number
  /** Famille à laquelle cette troupe inflige COUNTER_BONUS fois plus de dégâts. */
  strongAgainst: Family
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
    family: 'warrior',
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
    family: 'archer',
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
    family: 'rider',
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
    family: 'mage',
    attack: 24,
    health: 25,
    strongAgainst: 'warrior',
    cost: { food: 30, gold: 10, mana: 20 },
    trainingSeconds: 6,
    barracksLevel: 3,
    upkeepPerHour: 6,
    load: 10,
  },
  // Les troupes propres à chaque race : plus fortes que celles de leur famille, mais plus chères.
  {
    id: 'paladin',
    name: 'Paladins',
    icon: '⚜️',
    description: 'Les chevaliers sacrés des Humains : lourdement armés, ils tiennent la ligne comme personne.',
    family: 'warrior',
    race: 'humans',
    attack: 16,
    health: 90,
    strongAgainst: 'rider',
    cost: { food: 60, wood: 20, gold: 20, mana: 5 },
    trainingSeconds: 6,
    barracksLevel: 4,
    upkeepPerHour: 7,
    load: 25,
  },
  {
    id: 'crossbowman',
    name: 'Arbalétriers nains',
    icon: '⚙️',
    description: 'Leurs arbalètes à manivelle percent les armures et abattent les mages de très loin.',
    family: 'archer',
    race: 'dwarves',
    attack: 22,
    health: 50,
    strongAgainst: 'mage',
    cost: { food: 40, wood: 40, stone: 20, gold: 10 },
    trainingSeconds: 6,
    barracksLevel: 4,
    upkeepPerHour: 6,
    load: 25,
  },
  {
    id: 'wolfRider',
    name: 'Chevaucheurs de loups',
    icon: '🐾',
    description: 'Des orcs juchés sur des loups géants : ils fondent sur les archers avant qu’ils ne tirent.',
    family: 'rider',
    race: 'orcs',
    attack: 26,
    health: 95,
    strongAgainst: 'archer',
    cost: { food: 90, wood: 15, gold: 30 },
    trainingSeconds: 8,
    barracksLevel: 4,
    upkeepPerHour: 12,
    load: 30,
  },
  {
    id: 'druid',
    name: 'Druides',
    icon: '🌿',
    description: 'Les gardiens de la forêt elfique : leurs ronces et leur foudre brisent les rangs des guerriers.',
    family: 'mage',
    race: 'elves',
    attack: 36,
    health: 45,
    strongAgainst: 'warrior',
    cost: { food: 45, wood: 20, gold: 15, mana: 35 },
    trainingSeconds: 9,
    barracksLevel: 4,
    upkeepPerHour: 8,
    load: 10,
  },
]

/** Une troupe inflige 1,5 fois plus de dégâts à la famille qu'elle domine. */
export const COUNTER_BONUS = 1.5
/** Quand les réserves de nourriture sont vides, les troupes ont faim : 0.3 = 30 % d'attaque en moins. */
export const STARVATION_ATTACK_MALUS = 0.3
/** Une manche de bataille se joue toutes les 2 secondes : une bataille dure un moment. */
export const BATTLE_ROUND_SECONDS = 2
/**
 * À chaque manche, une troupe n'inflige que cette part de son attaque (0.15 = 15 %) : les coups
 * se répartissent sur plusieurs manches. Les deux camps sont ralentis de la même façon, la bataille
 * dure plus longtemps sans changer qui l'emporte.
 */
export const BATTLE_DAMAGE_SCALE = 0.15
/**
 * Une bataille dure au moins ce nombre de manches : en une manche, un camp ne perd jamais plus
 * d'un dixième de sa vie du début. Même une armée écrasante met un moment à finir le combat.
 */
export const MIN_BATTLE_ROUNDS = 10
/** Au-delà de ce nombre de manches, les deux camps se séparent sans vainqueur. */
export const MAX_BATTLE_ROUNDS = 150
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
  | { kind: 'familyAttack'; family: Family; perLevel: number }
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
        description: '+6 % d’attaque de la famille des Guerriers, par niveau',
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
        description: '+6 % d’attaque de la famille des Archers, par niveau',
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
        description: '+6 % d’attaque de la famille des Cavaliers, par niveau',
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
        description: '+6 % d’attaque de la famille des Mages, par niveau',
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
  family: Family
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

// --- Les raids et la défense de la cité ---
// Quand la cité a grandi, des monstres viennent la piller : un raid part du bord de la carte et
// marche droit sur elle. On peut l'intercepter avec une armée ; sinon, il assiège la cité, que
// défendent les troupes présentes et les gardes des Remparts.

/** Les raids commencent quand le Château atteint ce niveau. */
export const RAID_CASTLE_LEVEL = 3
/** Le premier raid part ce temps après, puis les suivants à cet intervalle (en secondes). */
export const RAID_FIRST_SECONDS = 5 * 60
export const RAID_INTERVAL_SECONDS = 30 * 60
/** Après un pillage, les monstres laissent la cité tranquille pendant ce temps (en secondes). */
export const RAID_RESPITE_SECONDS = 2 * 60 * 60
/** Vitesse de marche d'un raid, en unités de carte par seconde : on a le temps de le voir venir. */
export const RAID_SPEED = 6
/** Un raid compte une fois et demie plus de monstres qu'une bande du même niveau, et rapporte autant de plus. */
export const RAID_SIZE = 1.5
/** D'où partent les raids : des points au bord de la carte. */
export const RAID_GATES: Point[] = [
  { x: 60, y: 70 },
  { x: 800, y: 30 },
  { x: 1540, y: 80 },
  { x: 1550, y: 1130 },
  { x: 800, y: 1170 },
  { x: 60, y: 1140 },
]

/** Chaque niveau de Remparts ajoute ce nombre de gardes, qui défendent la cité à chaque siège. */
export const WALL_GUARDS_PER_LEVEL = 8
/** Un garde des Remparts : il tire du haut des murs, comme un archer. */
export const WALL_GUARD: { attack: number; health: number; family: Family } = {
  attack: 12,
  health: 45,
  family: 'archer',
}
/** Chaque niveau de Remparts donne ce bonus de vie aux troupes qui défendent la cité (0.05 = +5 %). */
export const WALL_HEALTH_PER_LEVEL = 0.05
/** On soigne les défenseurs dans la cité : cette part des troupes tombées pendant un siège se relève ensuite. */
export const SIEGE_HEALED_SHARE = 0.5
/** Un seul siège à la fois : un raid qui arrive pendant un siège attend ce temps aux portes (en secondes). */
export const SIEGE_WAIT_SECONDS = 10

/** Un raid victorieux emporte cette part des réserves… */
export const RAID_PLUNDER_SHARE = 0.2
/** … sauf ce que le Château met à l'abri : autant de chaque ressource, par niveau du Château. */
export const PROTECTED_PER_CASTLE_LEVEL = 300
/** Et chaque monstre encore debout ne peut emporter que cette quantité. */
export const RAID_LOAD_PER_MONSTER = 40

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

// --- Quêtes ---
// Une suite d'objectifs qui guide le joueur, du premier chantier aux grandes batailles : un
// objectif à la fois, dans l'ordre de la liste. Chaque objectif atteint rapporte une récompense.

export type QuestGoal =
  /** Un bâtiment atteint ce niveau. */
  | { kind: 'building'; building: BuildingId; level: number }
  /** Autant de troupes de cette famille, dans la cité et dehors. */
  | { kind: 'troops'; unit: UnitId; count: number }
  /** Autant de héros recrutés. */
  | { kind: 'heroes'; count: number }
  /** Un héros atteint ce niveau. */
  | { kind: 'heroLevel'; level: number }
  /** Autant de niveaux de recherche, toutes recherches confondues. */
  | { kind: 'research'; levels: number }
  /** Autant de batailles remportées. */
  | { kind: 'victories'; count: number }
  /** Autant de bandes de monstres vaincues. */
  | { kind: 'bands'; count: number }
  /** Autant de ressources récoltées sur les gisements. */
  | { kind: 'gathered'; amount: number }
  /** Autant de raids repoussés aux portes de la cité. */
  | { kind: 'raids'; count: number }

export interface QuestDef {
  id: string
  name: string
  /** Ce qu'il faut faire, tel qu'il est affiché au joueur. */
  description: string
  goal: QuestGoal
  reward: Partial<Resources>
}

export const QUESTS: QuestDef[] = [
  {
    id: 'goldMine',
    name: 'De l’or sous la colline',
    description: 'Construis la Mine d’or.',
    goal: { kind: 'building', building: 'goldMine', level: 1 },
    reward: { food: 150, wood: 150, gold: 60 },
  },
  {
    id: 'castle2',
    name: 'Un château qui grandit',
    description: 'Améliore le Château au niveau 2.',
    goal: { kind: 'building', building: 'castle', level: 2 },
    reward: { food: 250, wood: 250, stone: 150 },
  },
  {
    id: 'farm2',
    name: 'Des greniers pleins',
    description: 'Améliore la Ferme au niveau 2.',
    goal: { kind: 'building', building: 'farm', level: 2 },
    reward: { wood: 200, stone: 150 },
  },
  {
    id: 'barracks',
    name: 'Une caserne pour la garde',
    description: 'Construis la Caserne.',
    goal: { kind: 'building', building: 'barracks', level: 1 },
    reward: { food: 400, wood: 200 },
  },
  {
    id: 'warriors',
    name: 'Lever une garde',
    description: 'Rassemble 20 Guerriers.',
    goal: { kind: 'troops', unit: 'warrior', count: 20 },
    reward: { food: 500, wood: 100 },
  },
  {
    id: 'hero',
    name: 'Un chef pour tes troupes',
    description: 'Recrute un héros, dans l’onglet Héros.',
    goal: { kind: 'heroes', count: 1 },
    reward: { gold: 150 },
  },
  {
    id: 'victory',
    name: 'Premier sang',
    description: 'Remporte une bataille aux alentours.',
    goal: { kind: 'victories', count: 1 },
    reward: { food: 300, wood: 300, stone: 200 },
  },
  {
    id: 'gather',
    name: 'Les richesses des alentours',
    description: 'Récolte 500 ressources sur les gisements.',
    goal: { kind: 'gathered', amount: 500 },
    reward: { gold: 200 },
  },
  {
    id: 'castle3',
    name: 'La cité s’étend',
    description: 'Améliore le Château au niveau 3.',
    goal: { kind: 'building', building: 'castle', level: 3 },
    reward: { stone: 500, gold: 200 },
  },
  {
    id: 'walls',
    name: 'Des murs pour la cité',
    description: 'Construis les Remparts : des monstres viendront bientôt piller ta cité.',
    goal: { kind: 'building', building: 'walls', level: 1 },
    reward: { wood: 300, stone: 300 },
  },
  {
    id: 'academy',
    name: 'La maison des savants',
    description: 'Construis l’Académie.',
    goal: { kind: 'building', building: 'academy', level: 1 },
    reward: { gold: 250, mana: 50 },
  },
  {
    id: 'research',
    name: 'Première découverte',
    description: 'Termine une recherche.',
    goal: { kind: 'research', levels: 1 },
    reward: { food: 500, wood: 500 },
  },
  {
    id: 'bands',
    name: 'Chasseurs de monstres',
    description: 'Vaincs 3 bandes de monstres.',
    goal: { kind: 'bands', count: 3 },
    reward: { gold: 400, mana: 100 },
  },
  {
    id: 'heroLevel',
    name: 'Un héros aguerri',
    description: 'Fais monter un héros au niveau 3.',
    goal: { kind: 'heroLevel', level: 3 },
    reward: { gold: 500 },
  },
  {
    id: 'raid',
    name: 'La cité tient bon',
    description: 'Repousse un raid de monstres : aux portes de la cité, ou en l’arrêtant en chemin.',
    goal: { kind: 'raids', count: 1 },
    reward: { food: 600, stone: 600, gold: 300 },
  },
  {
    id: 'castle5',
    name: 'Une cité florissante',
    description: 'Améliore le Château au niveau 5 : un second chantier s’ouvrira.',
    goal: { kind: 'building', building: 'castle', level: 5 },
    reward: { food: 1500, wood: 1500, stone: 1500, gold: 600, mana: 200 },
  },
  {
    id: 'victories',
    name: 'Seigneur de guerre',
    description: 'Remporte 10 batailles.',
    goal: { kind: 'victories', count: 10 },
    reward: { gold: 1000, mana: 300 },
  },
]

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
  mageTower: 0,
  walls: 0,
}
