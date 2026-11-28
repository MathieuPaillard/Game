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
  | 'dragonRoost'
  | 'warehouse'
  | 'hospital'

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
  /** Coût du niveau 1 (voir levelScale et COST_POWER pour les suivants). */
  baseCost: Partial<Resources>
  /** Durée du niveau 1, en secondes. Le niveau L dure L ^ DURATION_POWER fois plus. */
  baseDurationSeconds: number
  /** Un niveau maximum plus bas que MAX_LEVEL, quand les niveaux suivants ne changeraient plus rien. */
  maxLevel?: number
}

export const BUILDINGS: BuildingDef[] = [
  {
    id: 'castle',
    name: 'Château',
    icon: '🏰',
    description: 'Le cœur de ta cité. Aucun bâtiment ne peut dépasser son niveau.',
    unlockedAtCastleLevel: 0,
    baseCost: { food: 150, wood: 200, stone: 150, gold: 60, mana: 30 },
    baseDurationSeconds: 10,
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
    baseDurationSeconds: 3,
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
    baseDurationSeconds: 3,
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
    baseDurationSeconds: 3,
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
    baseDurationSeconds: 4,
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
    baseDurationSeconds: 5,
  },
  {
    id: 'barracks',
    name: 'Caserne',
    icon: '⚔️',
    description: 'Entraîne tes troupes. Chaque niveau débloque des troupes et accélère l’entraînement.',
    unlockedAtCastleLevel: 2,
    baseCost: { food: 120, wood: 160, stone: 100 },
    baseDurationSeconds: 6,
  },
  {
    id: 'academy',
    name: 'Académie',
    icon: '📜',
    description: 'Tes savants y mènent les recherches. Chaque niveau en débloque de nouvelles.',
    unlockedAtCastleLevel: 3,
    baseCost: { food: 250, wood: 300, stone: 250, gold: 120, mana: 40 },
    baseDurationSeconds: 12,
  },
  {
    id: 'mageTower',
    name: 'Tour des mages',
    icon: '🪄',
    description:
      'Tes mages y lancent des sorts : contre du mana, un bienfait de plusieurs dizaines de minutes, ou une défense pour toute une nuit d’absence. Chaque niveau en débloque un nouveau.',
    unlockedAtCastleLevel: 4,
    baseCost: { wood: 300, stone: 400, gold: 200, mana: 150 },
    baseDurationSeconds: 15,
    // Son dernier sort se débloque au niveau 7 : au-delà, rien ne changerait.
    maxLevel: 7,
  },
  {
    id: 'walls',
    name: 'Remparts',
    icon: '🧱',
    description: 'Ils défendent la cité contre les raids : des gardes y veillent, et tes troupes s’y battent mieux.',
    unlockedAtCastleLevel: 3,
    baseCost: { wood: 200, stone: 350, gold: 60 },
    baseDurationSeconds: 10,
  },
  {
    id: 'dragonRoost',
    name: 'Aire du dragon',
    icon: '🌋',
    description: 'Un œuf de dragon y éclôt, et le dragon y vit. Le dragon ne dépasse jamais le niveau de son aire.',
    unlockedAtCastleLevel: 6,
    baseCost: { wood: 900, stone: 1200, gold: 500, mana: 300 },
    baseDurationSeconds: 30,
    // Le dragon ne dépasse pas le niveau 10 (DRAGON_MAX_LEVEL) : l'aire non plus.
    maxLevel: 10,
  },
  {
    id: 'warehouse',
    name: 'Entrepôt',
    icon: '📦',
    description:
      'Il garde tes réserves. Quand une réserve est pleine, la production de cette ressource s’arrête : chaque niveau garde davantage.',
    unlockedAtCastleLevel: 1,
    baseCost: { wood: 120, stone: 100 },
    baseDurationSeconds: 4,
  },
  {
    id: 'hospital',
    name: 'Hôpital',
    icon: '🏥',
    description:
      'Une part des troupes qui tombent au combat n’est que blessée : elle y attend qu’on la soigne, s’il reste un lit. Chaque niveau ajoute des lits.',
    unlockedAtCastleLevel: 3,
    baseCost: { food: 150, wood: 200, stone: 150, gold: 50 },
    baseDurationSeconds: 8,
  },
]

// La progression se compte en mois, puis en années : cinquante niveaux. Les coûts, la production et
// la place des réserves grandissent comme ((niveau + LEVEL_OFFSET) / (1 + LEVEL_OFFSET)) ^ puissance :
// doucement au début, puis sans s'emballer (une croissance exponentielle exploserait sur 50 niveaux).
// Les durées, elles, grandissent comme niveau ^ DURATION_POWER : quelques secondes au début, des
// semaines vers la fin.

/** Niveau maximum des bâtiments. */
export const MAX_LEVEL = 50
/** Le décalage qui adoucit les premiers niveaux (voir levelScale). */
export const LEVEL_OFFSET = 4
/** Les coûts, et la place des réserves qui doit les contenir. */
export const COST_POWER = 3.3
/** Les durées des chantiers et des recherches : niveau ^ DURATION_POWER fois celle du niveau 1. */
export const DURATION_POWER = 3.4
/** La production des bâtiments, et les lits de l'hôpital (qui suivent le nombre de troupes). */
export const PRODUCTION_POWER = 2

// Les réserves ont une limite : ce que garde l'Entrepôt, la même pour chaque ressource. Au-delà, la
// production s'arrête ; ce que rapportent les armées, les objectifs et les sièges entre quand même.
/** Ce que les réserves gardent de chaque ressource, sans Entrepôt. */
export const STORAGE_BASE = 1000
// Chaque niveau d'Entrepôt garde autant de plus que grandissent les coûts : la place des réserves au
// niveau L est STORAGE_BASE × levelScale(L + 1, COST_POWER).

// L'hôpital : une part des troupes qui tombent au combat (dehors, pendant un siège ou dans un piège)
// n'est que blessée. Elle va à l'hôpital s'il y reste un lit ; les autres meurent. On l'y soigne contre
// des ressources et du temps, comme un entraînement, mais moins cher et plus vite.
/** La part des troupes tombées qui n'est que blessée (arrondie au-dessus). */
export const WOUNDED_SHARE = 0.5
/** Les lits de l'hôpital au niveau 1 ; ils grandissent comme la production (levelScale, PRODUCTION_POWER). */
export const HOSPITAL_BEDS_BASE = 50
/** Soigner une troupe coûte cette part de son entraînement… */
export const HEAL_COST_SHARE = 0.3
/** …et dure cette part de son temps d'entraînement. */
export const HEAL_TIME_SHARE = 0.3
/** Un seul chantier à la fois au début : un second s'ouvre à ce niveau du Château. */
export const SECOND_CONSTRUCTION_CASTLE_LEVEL = 5

// --- Les paliers ---
// Tous les 10 niveaux, une évolution majeure marque la différence. Les troupes gagnent un rang (de I à
// V), qui s'ouvre par une grande recherche de l'Académie, puis s'entraîne à la Caserne ; un nouveau
// cercle de recherches s'ouvre à l'Académie ; et les monstres grandissent. Le Château ne passe pas un
// palier (les niveaux 11, 21, 31 et 41) sans la grande recherche de son rang.

/** Le nombre de rangs de chaque troupe, et de cercles de recherches. */
export const MAX_RANK = 5
/** Un rang (et un cercle) tous les 10 niveaux : le rang II s'ouvre au niveau 10, le III au 20… */
export const RANK_STEP = 10
/** Les chiffres romains des rangs et des cercles. */
export const RANK_NUMERALS = ['I', 'II', 'III', 'IV', 'V']
/** Chaque rang au-dessus du premier multiplie l'attaque, la vie et les soins d'une troupe… */
export const RANK_STRENGTH = 2
/** … son coût et sa durée d'entraînement (un peu moins que sa force : un rang plus haut rapporte plus)… */
export const RANK_COST = 1.8
/** … et son entretien et sa charge. */
export const RANK_UPKEEP = 1.5
/**
 * Dans les cercles suivants, chaque niveau d'une recherche demande deux niveaux d'Académie de plus
 * (Forge II : Académie 10, 12, 14, 16 puis 18), et coûte et dure comme ce niveau d'Académie.
 */
export const CIRCLE_LEVEL_STEP = 2

// --- Sorts ---
// La Tour des mages lance des sorts : contre du mana, un bienfait pour toute la cité, ou pour
// toutes les armées, pendant plusieurs dizaines de minutes ; ou une défense qui veille sur la cité
// toute une nuit. Un même sort ne se lance pas deux fois à la fois.

export type SpellId = 'harvest' | 'growth' | 'fury' | 'tailwind' | 'stoneskin' | 'aegis' | 'mist'

/** Ce que fait un sort tant qu'il agit : 0.25 veut dire +25 %. */
export type SpellEffect =
  | { kind: 'production'; resources: ResourceId[]; amount: number }
  | { kind: 'attack'; amount: number }
  /** La vie des troupes, pour les batailles qui commencent pendant le sort. */
  | { kind: 'health'; amount: number }
  /** Temps de marche en moins. */
  | { kind: 'marchSpeed'; amount: number }
  /** La vie des défenseurs de la cité (troupes, gardes, dragon), pour les sièges qui commencent pendant le sort. */
  | { kind: 'siegeHealth'; amount: number }
  /** Aucun raid ne part vers la cité tant que le sort agit (ceux qui marchent déjà arrivent quand même). */
  | { kind: 'noRaids' }

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
  /** Un sort de défense, fait pour durer pendant que le joueur est absent (une nuit). */
  absence?: true
  /** Une fois le sort fini, le temps qu'il faut avant de pouvoir le relancer (rien : tout de suite). */
  rechargeSeconds?: number
}

/** Les sorts de la Tour des mages durent plusieurs dizaines de minutes ; ceux de défense, toute une nuit. */
const MINUTE = 60
const HOUR = 60 * MINUTE

export const SPELLS: SpellDef[] = [
  {
    id: 'harvest',
    name: 'Moisson abondante',
    icon: '🌾',
    description: '+25 % de nourriture',
    effect: { kind: 'production', resources: ['food'], amount: 0.25 },
    towerLevel: 1,
    cost: { mana: 180 },
    durationSeconds: 40 * MINUTE,
  },
  {
    id: 'growth',
    name: 'Sève vive',
    icon: '🌳',
    description: '+25 % de bois et de pierre',
    effect: { kind: 'production', resources: ['wood', 'stone'], amount: 0.25 },
    towerLevel: 2,
    cost: { mana: 300 },
    durationSeconds: 40 * MINUTE,
  },
  {
    id: 'fury',
    name: 'Fureur guerrière',
    icon: '🗡️',
    description: '+15 % d’attaque pour toutes tes armées',
    effect: { kind: 'attack', amount: 0.15 },
    towerLevel: 3,
    cost: { mana: 600 },
    durationSeconds: 30 * MINUTE,
  },
  {
    id: 'tailwind',
    name: 'Vent porteur',
    icon: '🌬️',
    description: '−20 % de temps de marche pour toutes tes armées',
    effect: { kind: 'marchSpeed', amount: 0.2 },
    towerLevel: 4,
    cost: { mana: 600 },
    durationSeconds: 30 * MINUTE,
  },
  {
    id: 'stoneskin',
    name: 'Peau de pierre',
    icon: '🗿',
    description: '+15 % de vie pour tes troupes, dans les batailles qui commencent',
    effect: { kind: 'health', amount: 0.15 },
    towerLevel: 5,
    cost: { mana: 800 },
    durationSeconds: 30 * MINUTE,
  },
  // Pour les absences : on les lance avant de partir, ils veillent toute la nuit.
  {
    id: 'aegis',
    name: 'Égide des remparts',
    icon: '🛡️',
    description: '+30 % de vie pour les défenseurs de la cité (troupes, gardes, dragon) pendant les sièges',
    effect: { kind: 'siegeHealth', amount: 0.3 },
    towerLevel: 6,
    cost: { mana: 1500 },
    durationSeconds: 8 * HOUR,
    absence: true,
  },
  {
    id: 'mist',
    name: 'Brume d’oubli',
    icon: '🌫️',
    description:
      'Une brume cache la cité : aucun raid ne part l’attaquer (ceux déjà en marche arrivent quand même). Dissipée, elle met 16 h à se reformer',
    effect: { kind: 'noRaids' },
    towerLevel: 7,
    cost: { mana: 2500, gold: 500 },
    durationSeconds: 8 * HOUR,
    absence: true,
    // Une nuit par jour, pas tout le temps : sinon les raids disparaîtraient du jeu.
    rechargeSeconds: 16 * HOUR,
  },
]

// --- Recherches ---

/** Les domaines du premier cercle qui reviennent, plus puissants, dans chacun des cercles suivants. */
export type CircleDomain = 'agriculture' | 'tools' | 'alchemy' | 'forge' | 'armor' | 'stewardship'

export type TechId =
  | 'agriculture'
  | 'tools'
  | 'forge'
  | 'command'
  | 'alchemy'
  | 'armor'
  | 'masonry'
  | 'forcedMarch'
  | 'stewardship'
  // Les cercles suivants : les mêmes domaines (Forge II, `forge2`…), et quelques recherches nouvelles.
  | `${CircleDomain}${2 | 3 | 4 | 5}`
  | 'masonry2'
  | 'medicine'
  | 'drill'
  | 'logistics'
  | 'prospecting'
  | 'herbalism'
  | 'fortification'
  | 'vaults'
  | 'command2'
  // Les grandes recherches qui ouvrent un rang de troupes (`rank2` : le rang II).
  | `rank${2 | 3 | 4 | 5}`

/** Ce que rapporte chaque niveau d'une recherche. */
export type TechEffect =
  | { kind: 'production'; resources: ResourceId[]; perLevel: number }
  | { kind: 'attack'; perLevel: number }
  | { kind: 'health'; perLevel: number }
  | { kind: 'armies'; perLevel: number }
  | { kind: 'marchSpeed'; perLevel: number }
  | { kind: 'constructionSpeed'; perLevel: number }
  /** Place en plus dans les réserves (voir STORAGE_BASE). */
  | { kind: 'storage'; perLevel: number }
  /** Lits en plus à l'hôpital. */
  | { kind: 'beds'; perLevel: number }
  /** Entraînement (et soins) plus rapides. */
  | { kind: 'training'; perLevel: number }
  /** Charge en plus pour chaque troupe : le butin et la récolte. */
  | { kind: 'load'; perLevel: number }
  /** Récolte plus rapide sur les gisements. */
  | { kind: 'gather'; perLevel: number }
  /** Soins en plus pour les soigneurs, à chaque manche. */
  | { kind: 'heal'; perLevel: number }
  /** Gardes en plus sur les Remparts. */
  | { kind: 'guards'; perLevel: number }
  /** Réserves en plus à l'abri des pillards (voir PROTECTED_BASE). */
  | { kind: 'protected'; perLevel: number }
  /** Une grande recherche : elle ouvre ce rang de troupes, et le palier du Château qui va avec. */
  | { kind: 'rank'; rank: number }

export interface TechDef {
  id: TechId
  name: string
  icon: string
  /** L'effet d'un niveau, tel qu'il est affiché au joueur. */
  description: string
  effect: TechEffect
  maxLevel: number
  /** Son cercle, de 1 à MAX_RANK : le premier, puis un nouveau tous les RANK_STEP niveaux d'Académie. */
  circle: number
  /** Niveau d'Académie nécessaire pour commencer cette recherche. */
  unlockedAtAcademyLevel: number
  /** Une grande recherche demande aussi la Caserne à ce niveau. */
  barracksLevel?: number
  /** Coût du niveau 1 (voir levelScale et COST_POWER pour les suivants). */
  baseCost: Partial<Resources>
  /** Durée du niveau 1, en secondes. Le niveau L dure L ^ DURATION_POWER fois plus. */
  baseDurationSeconds: number
}

// Le premier cercle : une recherche ne peut pas dépasser le niveau de l'Académie.
const FIRST_CIRCLE: Omit<TechDef, 'circle'>[] = [
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
  {
    id: 'stewardship',
    name: 'Intendance',
    icon: '🧮',
    description: '+10 % de place dans les réserves, par niveau',
    effect: { kind: 'storage', perLevel: 0.1 },
    maxLevel: 5,
    unlockedAtAcademyLevel: 2,
    baseCost: { wood: 200, stone: 200, gold: 60 },
    baseDurationSeconds: 25,
  },
]

// Les cercles suivants s'ouvrent tous les RANK_STEP niveaux d'Académie. Chaque niveau y demande
// CIRCLE_LEVEL_STEP niveaux d'Académie de plus, et coûte et dure comme ce niveau-là : des heures au
// deuxième cercle, des semaines au cinquième. Faire le tour de tous les cercles prend des années.

/** La durée d'un niveau 1 dans les cercles suivants, en secondes (avant la croissance des durées). */
const CIRCLE_DURATION_SECONDS = 3

/** Ce que rapporte un niveau de chaque domaine du premier cercle, du deuxième cercle au cinquième. */
const CIRCLE_POWER: Record<CircleDomain, number[]> = {
  agriculture: [0.12, 0.14, 0.16, 0.18],
  tools: [0.12, 0.14, 0.16, 0.18],
  alchemy: [0.12, 0.14, 0.16, 0.18],
  forge: [0.06, 0.07, 0.08, 0.09],
  armor: [0.06, 0.07, 0.08, 0.09],
  stewardship: [0.12, 0.14, 0.16, 0.18],
}

/** Le niveau d'Académie où s'ouvre ce cercle (le premier s'ouvre avec l'Académie). */
function circleStart(circle: number): number {
  return Math.max(1, RANK_STEP * (circle - 1))
}

/** Une recherche d'un cercle suivant, de la même famille qu'une autre : seuls son effet et ses durées changent. */
function circleTech(base: Omit<TechDef, 'circle'>, circle: number, id: TechId, perLevel: number): TechDef {
  const percent = `${Math.round(perLevel * 100)} %`
  return {
    ...base,
    id,
    name: `${base.name} ${RANK_NUMERALS[circle - 1]}`,
    description: base.description.replace(/\d+ %/, percent),
    effect: { ...base.effect, perLevel } as TechEffect,
    circle,
    unlockedAtAcademyLevel: circleStart(circle),
    baseDurationSeconds: CIRCLE_DURATION_SECONDS,
  }
}

function firstCircle(id: TechId): Omit<TechDef, 'circle'> {
  const tech = FIRST_CIRCLE.find((t) => t.id === id)
  if (!tech) throw new Error(`Recherche inconnue : ${id}`)
  return tech
}

/** Les six domaines qui reviennent, à ce cercle. */
function domains(circle: number): TechDef[] {
  return (Object.keys(CIRCLE_POWER) as CircleDomain[]).map((domain) =>
    circleTech(firstCircle(domain), circle, `${domain}${circle}` as TechId, CIRCLE_POWER[domain][circle - 2]),
  )
}

/** Une recherche nouvelle d'un cercle suivant. */
function newTech(circle: number, tech: Omit<TechDef, 'circle' | 'unlockedAtAcademyLevel' | 'baseDurationSeconds'>): TechDef {
  return { ...tech, circle, unlockedAtAcademyLevel: circleStart(circle), baseDurationSeconds: CIRCLE_DURATION_SECONDS }
}

/**
 * La grande recherche d'un rang : elle demande l'Académie et la Caserne au niveau du palier, ouvre
 * ce rang pour toutes les troupes, et laisse le Château passer le palier.
 */
function rankTech(rank: number, name: string): TechDef {
  const level = RANK_STEP * (rank - 1)
  return {
    id: `rank${rank}` as TechId,
    name,
    icon: '🎖️',
    description: `Ouvre le rang ${RANK_NUMERALS[rank - 1]} de toutes tes troupes, deux fois plus fortes, à la Caserne niveau ${level}. Sans elle, le Château ne dépasse pas le niveau ${level}`,
    effect: { kind: 'rank', rank },
    maxLevel: 1,
    circle: rank,
    unlockedAtAcademyLevel: level,
    barracksLevel: level,
    baseCost: { food: 300, wood: 250, stone: 250, gold: 150, mana: 100 },
    baseDurationSeconds: 10,
  }
}

export const TECHS: TechDef[] = [
  ...FIRST_CIRCLE.map((tech) => ({ ...tech, circle: 1 })),
  // Le deuxième cercle (Académie 10).
  rankTech(2, 'Rang II : les vétérans'),
  ...domains(2),
  circleTech(firstCircle('masonry'), 2, 'masonry2', 0.03),
  newTech(2, {
    id: 'medicine',
    name: 'Médecine',
    icon: '🩺',
    description: '+10 % de lits à l’Hôpital, par niveau',
    effect: { kind: 'beds', perLevel: 0.1 },
    maxLevel: 5,
    baseCost: { food: 200, gold: 100, mana: 50 },
  }),
  newTech(2, {
    id: 'drill',
    name: 'Instruction',
    icon: '🎯',
    description: '−5 % de durée d’entraînement et de soins, par niveau',
    effect: { kind: 'training', perLevel: 0.05 },
    maxLevel: 5,
    baseCost: { food: 250, wood: 150, gold: 80 },
  }),
  // Le troisième cercle (Académie 20).
  rankTech(3, 'Rang III : les maîtres d’armes'),
  ...domains(3),
  newTech(3, {
    id: 'logistics',
    name: 'Logistique',
    icon: '🎒',
    description: '+10 % de charge pour toutes les troupes, par niveau',
    effect: { kind: 'load', perLevel: 0.1 },
    maxLevel: 5,
    baseCost: { food: 200, wood: 200, gold: 80 },
  }),
  newTech(3, {
    id: 'prospecting',
    name: 'Prospection',
    icon: '⛏️',
    description: '+10 % de vitesse de récolte sur les gisements, par niveau',
    effect: { kind: 'gather', perLevel: 0.1 },
    maxLevel: 5,
    baseCost: { wood: 200, stone: 200, gold: 80 },
  }),
  // Le quatrième cercle (Académie 30).
  rankTech(4, 'Rang IV : les champions'),
  ...domains(4),
  newTech(4, {
    id: 'herbalism',
    name: 'Herboristerie',
    icon: '🌼',
    description: '+10 % de soins pour les soigneurs, par niveau',
    effect: { kind: 'heal', perLevel: 0.1 },
    maxLevel: 5,
    baseCost: { food: 200, gold: 100, mana: 80 },
  }),
  newTech(4, {
    id: 'fortification',
    name: 'Fortification',
    icon: '🏯',
    description: '+10 % de gardes sur les Remparts, par niveau',
    effect: { kind: 'guards', perLevel: 0.1 },
    maxLevel: 5,
    baseCost: { wood: 200, stone: 300, gold: 80 },
  }),
  // Le cinquième cercle (Académie 40).
  rankTech(5, 'Rang V : les légendes'),
  ...domains(5),
  newTech(5, {
    id: 'vaults',
    name: 'Coffres-forts',
    icon: '🔐',
    description: '+10 % de réserves à l’abri des pillards, par niveau',
    effect: { kind: 'protected', perLevel: 0.1 },
    maxLevel: 5,
    baseCost: { stone: 300, gold: 150 },
  }),
  newTech(5, {
    ...firstCircle('command'),
    id: 'command2',
    name: 'Commandement II',
    maxLevel: 1,
  }),
]

// --- Troupes ---

/** Les quatre familles de troupes, chacune avec ses forces et ses faiblesses. */
export type Family = 'warrior' | 'archer' | 'rider' | 'mage'
/**
 * Les troupes de base : une par famille, plus, pour chaque race, une troupe de combat et des soigneurs
 * qui lui sont propres. Chacune a MAX_RANK rangs : `warrior` est le rang I des Guerriers, `warrior2`
 * leur rang II (les Porte-boucliers)… jusqu'à `warrior5`.
 */
export type LineId =
  | Family
  | 'paladin'
  | 'crossbowman'
  | 'wolfRider'
  | 'druid'
  | 'arcanist'
  | 'priest'
  | 'orcShaman'
  | 'runist'
/** Une troupe : une troupe de base (son rang I), ou l'un de ses rangs suivants. */
export type UnitId = LineId | `${LineId}${2 | 3 | 4 | 5}`
/** Un nombre de troupes pour chaque type de troupe. */
export type Army = Record<UnitId, number>

export interface UnitDef {
  id: UnitId
  name: string
  icon: string
  description: string
  /** La troupe de base dont elle est un rang, et ce rang (de 1 à MAX_RANK). */
  line: LineId
  rank: number
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
  /** Niveau de Caserne nécessaire pour l'entraîner (un rang suivant demande aussi sa grande recherche). */
  barracksLevel: number
  /** Entretien : nourriture mangée par heure par une troupe, dans la cité comme sur la carte. */
  upkeepPerHour: number
  /** Ressources qu'une troupe peut porter : le butin et la récolte rapportés à la cité. */
  load: number
  /**
   * Un soigneur : la vie qu'il rend à son armée à chaque manche, avant les Armures, le héros et les
   * sorts (qui la grandissent comme la vie des troupes). Il se bat à peine.
   */
  heal?: number
}

/** Une troupe de base : son rang I, et les noms de ses rangs II à V. */
type LineDef = Omit<UnitDef, 'id' | 'line' | 'rank'> & { id: LineId; rankNames: [string, string, string, string] }

// Les forces et faiblesses forment un cycle :
// Guerriers > Cavaliers > Archers > Mages > Guerriers.
/**
 * Les soigneurs de chaque race (Prêtres, Chamans, Druides, Runistes) ont les mêmes chiffres : ils se
 * battent à peine, mais rendent de la vie à leur armée à chaque manche (voir UnitDef.heal).
 */
const HEALER: Omit<LineDef, 'id' | 'name' | 'rankNames' | 'icon' | 'description' | 'race'> = {
  family: 'mage',
  attack: 4,
  health: 40,
  strongAgainst: 'warrior',
  cost: { food: 40, gold: 20, mana: 25 },
  trainingSeconds: 7,
  barracksLevel: 3,
  upkeepPerHour: 6,
  load: 10,
  heal: 3,
}

const LINES: LineDef[] = [
  {
    id: 'warrior',
    name: 'Guerriers',
    rankNames: ['Porte-boucliers', 'Lances de fer', 'Gardes d’acier', 'Remparts vivants'],
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
    rankNames: ['Arcs-longs', 'Flèches noires', 'Yeux-de-faucon', 'Archers de l’aube'],
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
    rankNames: ['Coursiers', 'Lances d’argent', 'Cuirassiers', 'Cavaliers du tonnerre'],
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
    rankNames: ['Invocateurs', 'Sorciers des braises', 'Mages de guerre', 'Maîtres des arcanes'],
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
    rankNames: ['Paladins du serment', 'Lames bénies', 'Gardiens sacrés', 'Champions de lumière'],
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
    rankNames: ['Arbalètes de forge', 'Tireurs runiques', 'Balistiers', 'Foudres de la montagne'],
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
    rankNames: ['Chevaucheurs sauvages', 'Hurleurs', 'Fléaux des plaines', 'Rois-loups'],
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
    rankNames: ['Druides des sources', 'Gardiens des bosquets', 'Chantres de la sève', 'Druides anciens'],
    icon: '🌿',
    description: 'Les gardiens de la forêt elfique : pendant les batailles, leur sève et leurs chants referment les plaies de ton armée.',
    ...HEALER,
    race: 'elves',
  },
  {
    id: 'arcanist',
    name: 'Arcanistes',
    rankNames: ['Tisseurs de lumière', 'Mages astraux', 'Veilleurs des étoiles', 'Lumières anciennes'],
    icon: '💫',
    description: 'Des mages elfes qui tissent la lumière en traits brûlants : ils brisent les rangs des guerriers.',
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
  {
    id: 'priest',
    name: 'Prêtres',
    rankNames: ['Chapelains', 'Prieurs', 'Hauts-prêtres', 'Saints guérisseurs'],
    icon: '🕯️',
    description: 'Leurs prières referment les plaies de ton armée pendant les batailles.',
    ...HEALER,
    race: 'humans',
  },
  {
    id: 'orcShaman',
    name: 'Chamans',
    rankNames: ['Diseurs d’os', 'Voix des ancêtres', 'Chamans du sang', 'Grands chamans'],
    icon: '🪶',
    description: 'Leurs chants et leurs os sacrés remettent les orcs debout au cœur de la bataille.',
    ...HEALER,
    race: 'orcs',
  },
  {
    id: 'runist',
    name: 'Runistes',
    rankNames: ['Graveurs de runes', 'Maîtres des runes', 'Sages des profondeurs', 'Anciens des runes'],
    icon: '💠',
    description: 'Ils gravent des runes de guérison sur les armures et les boucliers de ton armée.',
    ...HEALER,
    race: 'dwarves',
  },
]


/**
 * Un rang d'une troupe de base. Chaque rang au-dessus du premier multiplie son attaque, sa vie et ses
 * soins par RANK_STRENGTH, son coût et sa durée d'entraînement par RANK_COST, son entretien et sa
 * charge par RANK_UPKEEP. Il s'entraîne à partir de la Caserne niveau RANK_STEP × (rang − 1).
 */
function rankOf(line: LineDef, rank: number): UnitDef {
  const { rankNames, ...base } = line
  if (rank === 1) return { ...base, line: line.id, rank }
  const grown = (value: number, factor: number) => value * factor ** (rank - 1)
  const cost: Partial<Resources> = {}
  for (const id of RESOURCE_IDS) {
    const each = line.cost[id]
    if (each) cost[id] = Math.round(grown(each, RANK_COST))
  }
  return {
    ...base,
    id: `${line.id}${rank}` as UnitId,
    name: rankNames[rank - 2],
    line: line.id,
    rank,
    attack: grown(line.attack, RANK_STRENGTH),
    health: grown(line.health, RANK_STRENGTH),
    ...(line.heal === undefined ? {} : { heal: grown(line.heal, RANK_STRENGTH) }),
    cost,
    trainingSeconds: Math.round(grown(line.trainingSeconds, RANK_COST) * 10) / 10,
    barracksLevel: RANK_STEP * (rank - 1),
    upkeepPerHour: Math.round(grown(line.upkeepPerHour, RANK_UPKEEP)),
    load: Math.round(grown(line.load, RANK_UPKEEP)),
  }
}

/** Toutes les troupes : les rangs de chaque troupe de base, à la suite (Guerriers, Porte-boucliers… puis Archers…). */
export const UNITS: UnitDef[] = LINES.flatMap((line) =>
  Array.from({ length: MAX_RANK }, (_, i) => rankOf(line, i + 1)),
)

export const UNIT_IDS: UnitId[] = UNITS.map((unit) => unit.id)

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
/**
 * Une bataille est une mêlée : chaque troupe (une armée, une bande, un camp) frappe une seule cible,
 * mais plusieurs troupes peuvent frapper la même cible à la fois. Seul l'encombrement les limite :
 * autour d'une troupe, il n'y a de place que pour huit assaillants, un dans chaque direction
 * (devant, derrière, sur les côtés et en biais). La cité, elle, se défend derrière ses murs.
 */
export const MAX_ATTACKERS = 8
/** Frapper une troupe de côté, ou de dos, donne un bonus d'attaque (0.15 = 15 % de plus). */
export const SIDE_ATTACK_BONUS = 0.15
export const REAR_ATTACK_BONUS = 0.3
/**
 * Une troupe attaquée d'au moins ENCIRCLED_SIDES côtés (devant, à gauche, à droite, derrière) est
 * encerclée : elle perd cette part de son attaque.
 */
export const ENCIRCLED_SIDES = 3
export const ENCIRCLED_ATTACK_MALUS = 0.25
/** Troupes maximum par entraînement, pour chaque niveau de Caserne. */
export const TRAINING_BATCH_PER_LEVEL = 20
/**
 * Chaque niveau de Caserne au-delà du premier accélère l'entraînement : il dure 1 / (1 + 0,1 × (niveau − 1))
 * de son temps (deux fois plus vite au niveau 11, six fois au niveau 51).
 */
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

/**
 * La carte des alentours : sa taille, et la cité. À l'est, au-delà d'une barrière de montagnes et du
 * grand campement qu'elle abrite, s'étend une région nouvelle.
 */
export const WORLD: { width: number; height: number; city: Point } = {
  width: 3000,
  height: 1200,
  city: { x: 800, y: 620 },
}

// --- Le relief : une barrière de montagnes, et le grand campement ---

/**
 * Le grand campement : un cirque au cœur d'une barrière de montagnes infranchissables, qui coupe la
 * carte du nord au sud (de `barrier.west` à `barrier.east`). Le cercle du cirque a `sides` pans,
 * comptés depuis l'est dans le sens des aiguilles d'une montre : le col qui y entre part du pan
 * `entrance` (au sud-ouest, vers la cité), et la porte ferme le pan `gate` (à l'est), qui mène à la
 * région d'au-delà.
 */
export const ENCAMPMENT = {
  name: 'Le campement des Crocs',
  center: { x: 1900, y: 520 },
  radius: 300,
  barrier: { west: 1560, east: 2320 },
  sides: 16,
  entrance: 6,
  gate: 0,
  /** L'épaisseur de la porte, en unités de carte. */
  gateDepth: 26,
}

/** Le coin `i` (pas forcément entier) du cercle du cirque. Arrondi : le même sur tous les navigateurs. */
function cirqueCorner(i: number): Point {
  const { center, radius, sides } = ENCAMPMENT
  const angle = ((i - 0.5) * 2 * Math.PI) / sides
  return { x: Math.round(center.x + radius * Math.cos(angle)), y: Math.round(center.y + radius * Math.sin(angle)) }
}

/** Les bords de la barrière (au-delà du haut et du bas de la carte, pour qu'on ne puisse pas en faire le tour). */
const BARRIER_TOP = -60
const BARRIER_BOTTOM = 1260

/**
 * Le point où le rayon parti du centre du cirque, passant par `point`, sort de la barrière, et le
 * bord par lequel il sort : 0 en haut, 1 à l'est, 2 en bas, 3 à l'ouest.
 */
function barrierExit(point: Point): { point: Point; side: number } {
  const { center, barrier } = ENCAMPMENT
  const dx = point.x - center.x
  const dy = point.y - center.y
  const exits = [
    { t: dy < 0 ? (BARRIER_TOP - center.y) / dy : Infinity, side: 0 },
    { t: dx > 0 ? (barrier.east - center.x) / dx : Infinity, side: 1 },
    { t: dy > 0 ? (BARRIER_BOTTOM - center.y) / dy : Infinity, side: 2 },
    { t: dx < 0 ? (barrier.west - center.x) / dx : Infinity, side: 3 },
  ]
  const exit = exits.reduce((a, b) => (b.t < a.t ? b : a))
  const x = Math.round(center.x + dx * exit.t)
  const y = Math.round(center.y + dy * exit.t)
  // Les faces ouest et est de la barrière ne sont pas droites : elles avancent et reculent un peu.
  const jag = exit.side === 1 || exit.side === 3 ? ((((Math.round(y / 45) % 3) + 3) % 3) - 1) * 16 : 0
  return { point: { x: x + jag, y }, side: exit.side }
}

/**
 * Les montagnes de la barrière : un massif pour chaque pan du cirque, du pan jusqu'au bord de la
 * barrière, sauf le col et la porte. Les massifs voisins se chevauchent un peu, pour ne laisser aucune
 * fente entre eux.
 */
function barrierMountains(): Point[][] {
  const { sides, entrance, gate, barrier } = ENCAMPMENT
  // Les coins de la barrière, dans le sens des aiguilles d'une montre : celui qui suit chaque bord.
  const corners = [
    { x: barrier.east, y: BARRIER_TOP },
    { x: barrier.east, y: BARRIER_BOTTOM },
    { x: barrier.west, y: BARRIER_BOTTOM },
    { x: barrier.west, y: BARRIER_TOP },
  ]
  const mountains: Point[][] = []
  for (let k = 0; k < sides; k++) {
    if (k === entrance || k === gate) continue
    const a = cirqueCorner(k - 0.03)
    const b = cirqueCorner(k + 1.03)
    const exitA = barrierExit(a)
    const exitB = barrierExit(b)
    const corner = exitA.side === exitB.side ? [] : [corners[exitA.side]]
    mountains.push([a, b, exitB.point, ...corner, exitA.point])
  }
  return mountains
}

/** Les montagnes qu'aucune armée ne peut traverser. */
export const MOUNTAINS: Point[][] = barrierMountains()

/** La porte du campement, entre deux massifs : fermée, elle barre le chemin de la région d'au-delà. */
export const ENCAMPMENT_GATE: Point[] = (() => {
  const { center, gate, gateDepth } = ENCAMPMENT
  const outward = (point: Point) => {
    const dx = point.x - center.x
    const dy = point.y - center.y
    const length = Math.sqrt(dx * dx + dy * dy)
    return { x: Math.round(point.x + (dx / length) * gateDepth), y: Math.round(point.y + (dy / length) * gateDepth) }
  }
  const a = cirqueCorner(gate - 0.08)
  const b = cirqueCorner(gate + 1.08)
  return [a, b, outward(b), outward(a)]
})()

/** Vitesse de marche des armées, en unités de carte par seconde (Marche forcée l'augmente). */
export const MARCH_SPEED = 10
/** Tant que des armées sont dehors, le monde avance par pas d'une seconde. */
export const WORLD_TICK_SECONDS = 1

// --- Monstres et camps ---

export type MonsterId = 'wolf' | 'goblin' | 'skeleton' | 'shaman' | 'troll' | 'boar' | 'wyvern'

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
  // Les monstres de la fin de partie : des sangliers énormes, qui chargent comme des cavaliers, et
  // les vouivres, des serpents ailés des vieilles légendes, dont le venin agit comme une magie.
  { id: 'boar', name: 'Sangliers géants', icon: '🐗', family: 'rider', attack: 20, health: 110, xp: 10 },
  { id: 'wyvern', name: 'Vouivres', icon: '🐍', family: 'mage', attack: 55, health: 260, xp: 40 },
]

export type CampId = 'wolfDen' | 'goblinCamp' | 'hauntedRuins' | 'trollLair' | 'wyvernNest'

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
  {
    // Le plus redoutable des camps, de l'autre côté de la rivière : les vouivres y gardent leur nid.
    id: 'wyvernNest',
    name: 'Nid de la vouivre',
    level: 5,
    position: { x: 230, y: 160 },
    defenders: { wyvern: 4, boar: 16, troll: 3 },
    loot: { food: 1500, wood: 1500, stone: 1500, gold: 800, mana: 500 },
  },
]

/**
 * Un camp vaincu reste vide un moment, puis ses monstres reviennent : toutes les 2 heures pendant
 * les essais (toutes les 8 heures une fois le jeu en ligne).
 */
export const CAMP_RESPAWN_SECONDS = 2 * 60 * 60

/**
 * Le mode d'essai, pour tester seul ce qui demande normalement plusieurs joueurs : les troupes du
 * joueur et son dragon frappent et encaissent autant de fois plus. Seulement sans compte.
 */
export const TRIAL_BOOST = 10

// --- Les bandes de monstres ---
// Elles apparaissent peu à peu sur la carte des alentours, d'autant plus fortes qu'elles sont loin
// de la cité, et patrouillent autour de leur repaire. Chacune a une zone autour d'elle (sa zone
// d'aggro) : elle attaque toute armée qui y entre.

export type BandKindId =
  | 'wolves'
  | 'goblins'
  | 'skeletons'
  | 'trolls'
  | 'boars'
  | 'wyverns'
  // Celles du grand campement, qu'on ne croise nulle part ailleurs.
  | 'crocs'
  | 'keeper'
  | 'eliteGuard'
  | 'warlord'
  | 'watchtower'

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
  {
    id: 'boars',
    name: 'Harde de sangliers',
    monsters: { boar: 4 },
    loot: { food: 260, wood: 120 },
    minLevel: 3,
  },
  {
    id: 'wyverns',
    name: 'Vol de vouivres',
    monsters: { wyvern: 1, boar: 3 },
    loot: { stone: 150, gold: 150, mana: 120 },
    minLevel: 5,
  },
  // Le grand campement : ses patrouilles et ses chefs. Ils n'apparaissent que là (d'où leur niveau
  // minimal, qu'aucune bande n'atteint ailleurs), et sont faits pour plusieurs armées à la fois.
  {
    id: 'crocs',
    name: 'Patrouille des Crocs',
    monsters: { troll: 1, boar: 3, wolf: 6 },
    loot: { food: 80, wood: 80, stone: 50, gold: 20 },
    minLevel: 99,
  },
  {
    id: 'keeper',
    name: 'Gardien de la clef',
    monsters: { troll: 3, wyvern: 1, goblin: 10 },
    loot: { gold: 60, mana: 30 },
    minLevel: 99,
  },
  {
    id: 'eliteGuard',
    name: 'Garde d’élite',
    monsters: { troll: 4, boar: 4 },
    loot: { food: 120, wood: 120, stone: 120 },
    minLevel: 99,
  },
  {
    id: 'warlord',
    name: 'Seigneur des Crocs',
    monsters: { troll: 6, wyvern: 3, boar: 6 },
    loot: { food: 300, wood: 300, stone: 300, gold: 150, mana: 80 },
    minLevel: 99,
  },
  {
    // Des archers postés sur une tour, qui voient venir de loin (WATCH_RADIUS).
    id: 'watchtower',
    name: 'Tour de guet',
    monsters: { skeleton: 6, goblin: 2 },
    loot: { wood: 100, stone: 100, gold: 20 },
    minLevel: 99,
  },
]

/** Une bande du grand campement : sa sorte, son repaire, son niveau, et si elle garde sa place. */
export interface EncampmentBandDef {
  kind: BandKindId
  home: Point
  level: number
  /** Un chef immobile : il attaque toute armée qui l'approche, mais ne fait pas de ronde. */
  still: boolean
}

/**
 * Ce que contient le grand campement : cinq patrouilles qui font leur ronde dans le cirque, le gardien
 * de la clef (à l'ouest), la tour de guet (au nord-ouest), et au centre le Seigneur des Crocs, flanqué
 * de deux gardes d'élite. Tout revient toutes les CAMP_RESPAWN_SECONDS.
 */
export const ENCAMPMENT_BANDS: EncampmentBandDef[] = [
  { kind: 'crocs', home: { x: 1850, y: 330 }, level: 6, still: false },
  { kind: 'crocs', home: { x: 2020, y: 360 }, level: 6, still: false },
  { kind: 'crocs', home: { x: 2060, y: 610 }, level: 6, still: false },
  { kind: 'crocs', home: { x: 1860, y: 700 }, level: 6, still: false },
  { kind: 'crocs', home: { x: 1700, y: 600 }, level: 6, still: false },
  { kind: 'keeper', home: { x: 1690, y: 450 }, level: 6, still: true },
  { kind: 'eliteGuard', home: { x: 1790, y: 560 }, level: 6, still: true },
  { kind: 'eliteGuard', home: { x: 2010, y: 560 }, level: 6, still: true },
  { kind: 'warlord', home: { x: 1900, y: 470 }, level: 7, still: true },
  { kind: 'watchtower', home: { x: 1725, y: 350 }, level: 6, still: true },
]

/** Le seuil de la porte, dans le cirque : l'armée qui porte la clef l'ouvre en arrivant à GATE_REACH de là. */
export const ENCAMPMENT_GATE_FRONT: Point = { x: ENCAMPMENT.center.x + ENCAMPMENT.radius - 45, y: ENCAMPMENT.center.y }
export const GATE_REACH = 60

/**
 * La tour de guet voit loin : tant qu'elle tient, toute armée qu'elle aperçoit à cette distance (sans
 * montagne entre elles) met les patrouilles du campement en alerte, et elles accourent.
 */
export const WATCH_RADIUS = 260

/**
 * Les pièges du grand campement, cachés sur ses passages : à la sortie du col (presque tous les chemins
 * y passent), sur le chemin du gardien de la clef et de la tour de guet, et devant la porte. Chacun
 * blesse la première armée qui passe à TRAP_RADIUS de lui, puis reste désarmé jusqu'au repeuplement.
 */
export const ENCAMPMENT_TRAPS: Point[] = [
  { x: 1668, y: 700 },
  { x: 1676, y: 600 },
  { x: 2105, y: 520 },
]
export const TRAP_RADIUS = 30
/** Les dégâts d'un piège, répartis entre les troupes de l'armée selon leur nombre (le dragon s'envole à temps). */
export const TRAP_DAMAGE = 2000

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
/**
 * Une bande en patrouille voit plus loin que sa zone d'aggro (de ce facteur) : quand elle aperçoit
 * une armée, elle quitte sa ronde, la prend en chasse, et l'attaque en l'atteignant. Les chefs du
 * grand campement gardent leur place, et les raids leur route vers la cité.
 */
export const BAND_SIGHT_FACTOR = 1.6
/** Une bande qui poursuit une armée, ou qui regagne sa ronde, court à cette vitesse (par seconde) : un peu plus vite qu'une armée. */
export const CHASE_SPEED = 11
/** Une bande renonce à sa poursuite quand elle s'éloigne autant de son repaire : l'armée l'a semée. */
export const CHASE_LEASH = 220

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
  { x: 1450, y: 1090 },
  { x: 110, y: 110 },
  { x: 1450, y: 110 },
  // La région d'au-delà du grand campement.
  { x: 2560, y: 420 },
  { x: 2800, y: 220 },
  { x: 2700, y: 840 },
  { x: 2480, y: 1010 },
]

// --- Les créatures légendaires : le dragon ---
// Un œuf de dragon se gagne par une quête. Couvé dans l'Aire du dragon, il éclôt. Le dragon grandit
// en combattant (jamais au-delà du niveau de son aire), accompagne une armée ou défend la cité.
// Blessé, il regagne son aire et s'y repose un moment ; il ne meurt jamais.

/** Couver l'œuf coûte autant, et dure autant (en secondes). */
export const DRAGON_HATCH_COST: Partial<Resources> = { food: 800, mana: 600 }
export const DRAGON_HATCH_SECONDS = 15 * 60
/** Le dragon au niveau 1 : son attaque et sa vie. Chaque niveau les multiplie par DRAGON_GROWTH. */
export const DRAGON_ATTACK = 400
export const DRAGON_HEALTH = 3000
export const DRAGON_GROWTH = 1.3
/** Il crache le feu : il se bat avec les forces et les faiblesses des mages (les archers le dominent). */
export const DRAGON_FAMILY: Family = 'mage'
/** L'expérience pour passer au niveau 2, puis 1,6 fois plus à chaque niveau, jusqu'au niveau 10. */
export const DRAGON_BASE_XP = 300
export const DRAGON_XP_GROWTH = 1.6
export const DRAGON_MAX_LEVEL = 10
/** Blessé au combat, il se repose ce temps dans son aire (en secondes). */
export const DRAGON_REST_SECONDS = 20 * 60
/** Il mange autant de nourriture par heure, pour chacun de ses niveaux. */
export const DRAGON_UPKEEP_PER_LEVEL = 25
/** Son icône, pour l'œuf et pour le dragon. */
export const DRAGON_ICON = '🐉'
export const DRAGON_EGG_ICON = '🥚'

/** Toutes les DRAGON_BREATH_EVERY manches de son combat, au lieu de mordre, le dragon crache un cône de flammes. */
export const DRAGON_BREATH_EVERY = 3
/** Le cône frappe chaque adversaire touché de cette part de l'attaque du dragon (1.5 = 150 %)… */
export const DRAGON_BREATH_POWER = 1.5
/** …et touche, en plus de la cible de son armée, jusqu'à ce nombre d'autres adversaires de la mêlée, les plus proches. */
export const DRAGON_BREATH_TARGETS = 2

/** La nature d'un dragon, tirée au sort quand l'œuf éclôt : elle lui donne des bonus et des malus. */
export type DragonNature = 'ember' | 'frost' | 'storm' | 'scale'

export interface DragonNatureDef {
  id: DragonNature
  name: string
  icon: string
  /** Ses bonus et ses malus, tels qu'ils sont affichés au joueur. */
  description: string
  /** Multiplie la force de son cône. */
  breath: number
  /** Les adversaires que son cône touche en plus. */
  extraTargets: number
  /** Multiplie sa vie ; `homeHealth` la multiplie encore quand il défend la cité. */
  health: number
  homeHealth: number
  /** Les monstres que touche son cône perdent cette part de leur attaque à la manche suivante. */
  chill: number
}

export const DRAGON_NATURES: DragonNatureDef[] = [
  {
    id: 'ember',
    name: 'Braise',
    icon: '🔥',
    description: 'Son cône brûle plus fort (+30 %), mais il a moins de vie (−15 %).',
    breath: 1.3,
    extraTargets: 0,
    health: 0.85,
    homeHealth: 1,
    chill: 0,
  },
  {
    id: 'frost',
    name: 'Givre',
    icon: '❄️',
    description:
      'Les monstres que touche son cône perdent 30 % de leur attaque à la manche suivante, mais son cône est moins fort (−15 %).',
    breath: 0.85,
    extraTargets: 0,
    health: 1,
    homeHealth: 1,
    chill: 0.3,
  },
  {
    id: 'storm',
    name: 'Orage',
    icon: '⚡',
    description: 'Son cône touche un adversaire de plus, mais chaque coup est un peu plus faible (−15 %).',
    breath: 0.85,
    extraTargets: 1,
    health: 1,
    homeHealth: 1,
    chill: 0,
  },
  {
    id: 'scale',
    name: 'Écaille',
    icon: '🦎',
    description: 'Il a plus de vie (+30 %), et plus encore quand il défend la cité (+25 %), mais son cône est plus faible (−20 %).',
    breath: 0.8,
    extraTargets: 0,
    health: 1.3,
    homeHealth: 1.25,
    chill: 0,
  },
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
  { x: 1500, y: 80 },
  { x: 1500, y: 1130 },
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
/**
 * Le bonus de vie des troupes qui défendent la cité : WALL_HEALTH_MAX × niveau / (niveau +
 * WALL_HEALTH_HALF_LEVEL). Il grandit de moins en moins vite : la moitié du maximum au niveau 15.
 */
export const WALL_HEALTH_MAX = 1
export const WALL_HEALTH_HALF_LEVEL = 15
/** Un seul siège à la fois : un raid qui arrive pendant un siège attend ce temps aux portes (en secondes). */
export const SIEGE_WAIT_SECONDS = 10

/** Un raid victorieux emporte cette part des réserves… */
export const RAID_PLUNDER_SHARE = 0.2
/** … sauf ce que le Château met à l'abri : autant de chaque ressource au niveau 1, puis comme les coûts. */
export const PROTECTED_BASE = 300
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
  // La région d'au-delà du grand campement.
  { x: 2470, y: 260 },
  { x: 2620, y: 650 },
  { x: 2870, y: 440 },
  { x: 2560, y: 940 },
  { x: 2860, y: 980 },
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
  /** Autant de victoires contre ce camp de monstres. */
  | { kind: 'camp'; camp: CampId; count: number }
  /** Le dragon atteint ce niveau (le niveau 1 : il vient d'éclore). */
  | { kind: 'dragonLevel'; level: number }

export interface QuestDef {
  id: string
  name: string
  /** Ce qu'il faut faire, tel qu'il est affiché au joueur. */
  description: string
  goal: QuestGoal
  reward: Partial<Resources>
  /** Un présent de plus : un œuf de dragon. */
  gift?: 'dragonEgg'
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
    id: 'warehouse',
    name: 'Un entrepôt pour tes réserves',
    description: 'Construis l’Entrepôt : quand une réserve est pleine, sa production s’arrête.',
    goal: { kind: 'building', building: 'warehouse', level: 1 },
    reward: { wood: 200, stone: 200 },
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
    description: 'Recrute un héros : touche « Héros », en bas à droite.',
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
    id: 'manaWell',
    name: 'La source des mages',
    description: 'Construis le Puits de mana : le Château niveau 3 demande du mana.',
    goal: { kind: 'building', building: 'manaWell', level: 1 },
    reward: { food: 200, wood: 200, mana: 40 },
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
    id: 'hospital',
    name: 'Un hôpital pour tes blessés',
    description: 'Construis l’Hôpital : une part des troupes qui tombent au combat n’y sera que blessée.',
    goal: { kind: 'building', building: 'hospital', level: 1 },
    reward: { food: 300, wood: 200 },
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
  // La légende du dragon : de nouveaux défis, jusqu'à la première créature légendaire.
  {
    id: 'castle6',
    name: 'Une cité prospère',
    description: 'Améliore le Château au niveau 6 : on parle de toi jusque dans les montagnes.',
    goal: { kind: 'building', building: 'castle', level: 6 },
    reward: { wood: 2000, stone: 2000, gold: 800 },
  },
  {
    id: 'trollLair',
    name: 'L’Antre du troll',
    description: 'Remporte une victoire contre l’Antre du troll.',
    goal: { kind: 'camp', camp: 'trollLair', count: 1 },
    reward: { food: 1500, gold: 600 },
  },
  {
    id: 'walls3',
    name: 'Des murs de pierre',
    description: 'Améliore les Remparts au niveau 3.',
    goal: { kind: 'building', building: 'walls', level: 3 },
    reward: { stone: 1500, gold: 500 },
  },
  {
    id: 'dragonEgg',
    name: 'La légende du dragon',
    description:
      'Les anciens parlent d’un œuf de dragon, gardé par les vouivres. Va le chercher au Nid de la vouivre, de l’autre côté de la rivière.',
    goal: { kind: 'camp', camp: 'wyvernNest', count: 1 },
    reward: { gold: 1000, mana: 800 },
    gift: 'dragonEgg',
  },
  {
    id: 'dragonRoost',
    name: 'Un nid pour le dragon',
    description: 'Construis l’Aire du dragon, pour y couver l’œuf.',
    goal: { kind: 'building', building: 'dragonRoost', level: 1 },
    reward: { food: 1500, mana: 600 },
  },
  {
    id: 'dragonHatch',
    name: 'L’éclosion',
    description: 'Couve l’œuf dans l’Aire du dragon : un dragon va naître.',
    goal: { kind: 'dragonLevel', level: 1 },
    reward: { gold: 1000 },
  },
  {
    id: 'raids3',
    name: 'Les gardiens de la cité',
    description: 'Repousse 3 raids de monstres.',
    goal: { kind: 'raids', count: 3 },
    reward: { food: 2000, stone: 2000 },
  },
  {
    id: 'dragonLevel3',
    name: 'Le dragon grandit',
    description: 'Le dragon grandit en combattant, mais jamais au-delà du niveau de son aire : mène-le au niveau 3.',
    goal: { kind: 'dragonLevel', level: 3 },
    reward: { wood: 3000, stone: 3000, gold: 1500, mana: 1000 },
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
  dragonRoost: 0,
  warehouse: 0,
  hospital: 0,
}
