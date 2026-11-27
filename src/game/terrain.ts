// Le relief des alentours : les montagnes, et les portes fermées, que les armées ne peuvent pas
// traverser. Une armée qui ne peut pas aller tout droit les contourne par le plus court chemin : il
// passe d'un coin de montagne à l'autre (on relie chaque paire de coins qui se voient, puis on cherche
// le plus court trajet entre ces coins, comme sur une carte routière).
//
// Ce fichier ne fait que de la géométrie : ce sont les règles qui disent quelles montagnes comptent.

import type { Point } from './config.ts'

/** Une montagne : un polygone, ses coins dans l'ordre (sans répéter le premier). */
export type Polygon = Point[]

/** La taille de la carte : aucun chemin n'en sort (on ne fait pas le tour d'une montagne par-delà le bord). */
export interface Bounds {
  width: number
  height: number
}

/** Les chemins passent à cette distance des coins des montagnes, pour ne pas les frôler. */
const MARGIN = 10

function dist(a: Point, b: Point): number {
  // Math.sqrt, et pas Math.hypot : il donne le même résultat sur tous les navigateurs.
  const dx = a.x - b.x
  const dy = a.y - b.y
  return Math.sqrt(dx * dx + dy * dy)
}

/** De quel côté de la droite (o, a) se trouve b : positif d'un côté, négatif de l'autre, 0 dessus. */
function side(o: Point, a: Point, b: Point): number {
  return (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x)
}

/** Les segments [a, b] et [c, d] se croisent-ils franchement (et pas seulement en se touchant) ? */
function crosses(a: Point, b: Point, c: Point, d: Point): boolean {
  const s1 = side(c, d, a)
  const s2 = side(c, d, b)
  const s3 = side(a, b, c)
  const s4 = side(a, b, d)
  return ((s1 > 0 && s2 < 0) || (s1 < 0 && s2 > 0)) && ((s3 > 0 && s4 < 0) || (s3 < 0 && s4 > 0))
}

/** Le point est-il à l'intérieur du polygone ? */
export function inside(point: Point, polygon: Polygon): boolean {
  let result = false
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i]
    const b = polygon[j]
    if (a.y > point.y !== b.y > point.y && point.x < ((b.x - a.x) * (point.y - a.y)) / (b.y - a.y) + a.x) {
      result = !result
    }
  }
  return result
}

export function insideAny(point: Point, polygons: Polygon[]): boolean {
  return polygons.some((polygon) => inside(point, polygon))
}

/** Le cadre d'un polygone : pour écarter vite ceux qu'un segment ne peut pas toucher. */
interface Box {
  minX: number
  minY: number
  maxX: number
  maxY: number
}

const boxes = new WeakMap<Polygon, Box>()

function boxOf(polygon: Polygon): Box {
  let box = boxes.get(polygon)
  if (!box) {
    box = {
      minX: Math.min(...polygon.map((p) => p.x)),
      minY: Math.min(...polygon.map((p) => p.y)),
      maxX: Math.max(...polygon.map((p) => p.x)),
      maxY: Math.max(...polygon.map((p) => p.y)),
    }
    boxes.set(polygon, box)
  }
  return box
}

/** Le segment [a, b] traverse-t-il ce polygone ? */
function blocks(polygon: Polygon, a: Point, b: Point): boolean {
  const box = boxOf(polygon)
  if (Math.max(a.x, b.x) < box.minX || Math.min(a.x, b.x) > box.maxX) return false
  if (Math.max(a.y, b.y) < box.minY || Math.min(a.y, b.y) > box.maxY) return false
  for (let i = 0; i < polygon.length; i++) {
    if (crosses(a, b, polygon[i], polygon[(i + 1) % polygon.length])) return true
  }
  // Un segment qui passe par deux coins, ou qui est tout entier dedans, ne croise aucun bord : son milieu le dit.
  return inside({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, polygon)
}

/** Peut-on aller tout droit de `a` à `b`, sans traverser de montagne ? */
export function clear(a: Point, b: Point, polygons: Polygon[]): boolean {
  return polygons.every((polygon) => !blocks(polygon, a, b))
}

/** La longueur d'un chemin. */
export function routeLength(route: Point[]): number {
  let length = 0
  for (let i = 1; i < route.length; i++) length += dist(route[i - 1], route[i])
  return length
}

/** Où l'on se trouve après avoir parcouru `step` le long du chemin (au bout, s'il est plus court). */
export function walk(route: Point[], step: number): Point {
  let left = step
  for (let i = 1; i < route.length; i++) {
    const from = route[i - 1]
    const to = route[i]
    const length = dist(from, to)
    if (left < length) {
      const t = left / length
      return { x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t }
    }
    left -= length
  }
  return { ...route[route.length - 1] }
}

// --- Le plus court chemin ---

/** Les coins par où passer, et lesquels se voient deux à deux (avec la distance qui les sépare). */
interface Graph {
  corners: Point[]
  links: { to: number; length: number }[][]
}

const graphs = new WeakMap<Polygon[], Graph>()

/**
 * Les coins saillants des montagnes, poussés un peu vers l'extérieur : c'est par là que passent les
 * chemins. Un coin rentrant ne sert jamais de détour ; un coin enfoui dans une autre montagne non plus.
 */
function corners(polygons: Polygon[], bounds?: Bounds): Point[] {
  const result: Point[] = []
  for (const polygon of polygons) {
    // Le sens dans lequel le polygone tourne, pour savoir quels coins sont saillants.
    let area = 0
    for (let i = 0; i < polygon.length; i++) area += side({ x: 0, y: 0 }, polygon[i], polygon[(i + 1) % polygon.length])
    const turn = Math.sign(area)
    for (let i = 0; i < polygon.length; i++) {
      const before = polygon[(i + polygon.length - 1) % polygon.length]
      const corner = polygon[i]
      const after = polygon[(i + 1) % polygon.length]
      if (Math.sign(side(before, corner, after)) !== turn) continue
      // Vers l'extérieur : à l'opposé de la moyenne des deux côtés qui partent de ce coin.
      const u = dist(before, corner) || 1
      const v = dist(after, corner) || 1
      const ox = (corner.x - before.x) / u + (corner.x - after.x) / v
      const oy = (corner.y - before.y) / u + (corner.y - after.y) / v
      const norm = Math.sqrt(ox * ox + oy * oy) || 1
      const point = { x: corner.x + (ox / norm) * MARGIN, y: corner.y + (oy / norm) * MARGIN }
      const onMap = !bounds || (point.x >= 0 && point.x <= bounds.width && point.y >= 0 && point.y <= bounds.height)
      if (onMap && !insideAny(point, polygons)) result.push(point)
    }
  }
  return result
}

function graphOf(polygons: Polygon[], bounds?: Bounds): Graph {
  let graph = graphs.get(polygons)
  if (!graph) {
    const points = corners(polygons, bounds)
    const links: Graph['links'] = points.map(() => [])
    for (let i = 0; i < points.length; i++) {
      for (let j = i + 1; j < points.length; j++) {
        if (!clear(points[i], points[j], polygons)) continue
        const length = dist(points[i], points[j])
        links[i].push({ to: j, length })
        links[j].push({ to: i, length })
      }
    }
    graph = { corners: points, links }
    graphs.set(polygons, graph)
  }
  return graph
}

/**
 * Le plus court chemin de `from` à `to` qui ne traverse aucune montagne : [from, …coins, to], ou null
 * si aucun chemin n'y mène (une porte fermée…). Une armée qui se trouverait dans une montagne (une
 * vieille partie, d'avant ce relief) en sort tout droit. (Pour un même tableau de montagnes, les
 * coins et leurs liens sont calculés une fois : `bounds` doit donc rester le même.)
 */
export function findRoute(from: Point, to: Point, polygons: Polygon[], bounds?: Bounds): Point[] | null {
  if (polygons.length === 0 || clear(from, to, polygons) || insideAny(from, polygons)) return [{ ...from }, { ...to }]
  if (insideAny(to, polygons)) return null
  const { corners: points, links } = graphOf(polygons, bounds)
  // Dijkstra : les coins, puis le départ (n) et l'arrivée (n + 1).
  const n = points.length
  const start = n
  const goal = n + 1
  const best = new Array<number>(n + 2).fill(Infinity)
  const previous = new Array<number>(n + 2).fill(-1)
  const done = new Array<boolean>(n + 2).fill(false)
  const toGoal = points.map((point) => (clear(point, to, polygons) ? dist(point, to) : Infinity))
  best[start] = 0
  for (;;) {
    let current = -1
    for (let i = 0; i < n + 2; i++) if (!done[i] && best[i] < Infinity && (current < 0 || best[i] < best[current])) current = i
    if (current < 0) return null
    if (current === goal) break
    done[current] = true
    const neighbours =
      current === start
        ? points.flatMap((point, i) => (clear(from, point, polygons) ? [{ to: i, length: dist(from, point) }] : []))
        : links[current]
    for (const { to: next, length } of neighbours) {
      if (best[current] + length < best[next]) {
        best[next] = best[current] + length
        previous[next] = current
      }
    }
    if (current !== start && toGoal[current] < Infinity && best[current] + toGoal[current] < best[goal]) {
      best[goal] = best[current] + toGoal[current]
      previous[goal] = current
    }
  }
  const route: Point[] = [{ ...to }]
  for (let i = previous[goal]; i !== start && i >= 0; i = previous[i]) route.unshift({ ...points[i] })
  route.unshift({ ...from })
  return route
}
