// Les cartes du jeu : où se trouvent les bâtiments de la cité et les camps des alentours,
// et le décor (forêts, montagnes, rivière…). Ce sont des choix d'affichage, pas des règles.

import type { BuildingId, CampId } from '../game/config'

export interface Point {
  x: number
  y: number
}

export interface Mountain extends Point {
  /** Largeur de la base et hauteur, en unités de la carte. */
  w: number
  h: number
}

/** Des points répartis « au hasard », mais toujours les mêmes d'une partie à l'autre. */
function scatter(seed: number, count: number, x: number, y: number, w: number, h: number) {
  let s = seed
  const random = () => (s = (s * 16807) % 2147483647) / 2147483647
  return Array.from({ length: count }, () => ({ x: x + random() * w, y: y + random() * h, size: 0.8 + random() * 0.5 }))
}

function farFrom(points: Point[], distance: number) {
  return (p: Point) => points.every((q) => Math.hypot(p.x - q.x, p.y - q.y) > distance)
}

/** Les trois sommets d'une montagne, pour un <polygon>. */
export function mountainPoints(m: Mountain): string {
  return `${m.x - m.w / 2},${m.y} ${m.x},${m.y - m.h} ${m.x + m.w / 2},${m.y}`
}

/** Le versant éclairé d'une montagne. */
export function mountainLight(m: Mountain): string {
  return `${m.x},${m.y - m.h} ${m.x + m.w / 2},${m.y} ${m.x + m.w * 0.08},${m.y}`
}

// --- La cité ---

export const CITY_MAP = { width: 1400, height: 1000, center: { x: 700, y: 490 } }

export const CITY_PLOTS: Record<BuildingId, Point> = {
  castle: { x: 700, y: 450 },
  barracks: { x: 530, y: 345 },
  academy: { x: 870, y: 345 },
  farm: { x: 500, y: 580 },
  manaWell: { x: 700, y: 640 },
  goldMine: { x: 905, y: 585 },
  sawmill: { x: 340, y: 420 },
  quarry: { x: 1060, y: 440 },
}

/** L'enceinte de la cité : la Scierie et la Carrière sont dehors, près de la forêt et des montagnes. */
export const CITY_WALL = { cx: 700, cy: 485, rx: 300, ry: 225 }

/** Pas d'arbre dans l'enceinte de la cité. */
function outsideWall(p: Point) {
  const { cx, cy, rx, ry } = CITY_WALL
  return ((p.x - cx) / (rx + 40)) ** 2 + ((p.y - cy) / (ry + 40)) ** 2 > 1
}

export const CITY_DECOR = {
  river: 'M 0 800 C 300 740 560 880 780 830 S 1120 760 1400 820',
  fields: [
    { x: 400, y: 635, w: 120, h: 70 },
    { x: 530, y: 650, w: 80, h: 55 },
  ],
  mountains: [
    { x: 1100, y: 270, w: 170, h: 120 },
    { x: 1175, y: 350, w: 150, h: 140 },
    { x: 1185, y: 590, w: 150, h: 150 },
    { x: 1105, y: 710, w: 140, h: 100 },
    { x: 1300, y: 210, w: 200, h: 160 },
    { x: 1330, y: 480, w: 180, h: 170 },
    { x: 1290, y: 740, w: 200, h: 140 },
  ] as Mountain[],
  trees: [
    ...scatter(7, 70, 10, 40, 440, 900),
    ...scatter(13, 30, 450, 20, 640, 130),
    ...scatter(11, 18, 760, 880, 520, 110),
  ]
    .filter(outsideWall)
    .filter(farFrom([CITY_PLOTS.sawmill, CITY_PLOTS.quarry], 100))
    .sort((a, b) => a.y - b.y),
}

// --- Les alentours ---

export const WORLD_MAP = { width: 1600, height: 1200, center: { x: 800, y: 620 } }

export const WORLD_CITY: Point = { x: 800, y: 620 }

export const CAMP_SPOTS: Record<CampId, Point> = {
  wolfDen: { x: 560, y: 470 },
  goblinCamp: { x: 1110, y: 430 },
  hauntedRuins: { x: 1190, y: 870 },
  trollLair: { x: 360, y: 930 },
}

export const WORLD_DECOR = {
  river: 'M 660 0 C 620 120 540 210 430 250 S 170 330 0 370',
  lake: { cx: 1360, cy: 190, rx: 150, ry: 80 },
  marshes: [
    { cx: 1320, cy: 940, rx: 140, ry: 60 },
    { cx: 1140, cy: 1010, rx: 100, ry: 45 },
    { cx: 1400, cy: 820, rx: 80, ry: 35 },
  ],
  mountains: [
    { x: 1010, y: 330, w: 150, h: 95 },
    { x: 1250, y: 390, w: 170, h: 110 },
    { x: 1180, y: 300, w: 130, h: 80 },
    { x: 190, y: 900, w: 260, h: 210 },
    { x: 440, y: 1080, w: 240, h: 180 },
    { x: 150, y: 1130, w: 220, h: 160 },
    { x: 600, y: 1190, w: 200, h: 130 },
  ] as Mountain[],
  trees: [...scatter(3, 45, 330, 280, 420, 330), ...scatter(5, 30, 40, 40, 420, 230), ...scatter(9, 20, 900, 700, 260, 180)]
    .filter(farFrom([CAMP_SPOTS.wolfDen, WORLD_CITY, CAMP_SPOTS.hauntedRuins], 110))
    .sort((a, b) => a.y - b.y),
}
