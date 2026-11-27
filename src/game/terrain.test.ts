import { describe, expect, it } from 'vitest'
import { clear, findRoute, inside, routeLength, walk, type Polygon } from './terrain.ts'

/** Un rectangle, de (x1, y1) à (x2, y2). */
function rect(x1: number, y1: number, x2: number, y2: number): Polygon {
  return [
    { x: x1, y: y1 },
    { x: x2, y: y1 },
    { x: x2, y: y2 },
    { x: x1, y: y2 },
  ]
}

/** Chaque tronçon du chemin passe-t-il à côté des montagnes ? */
function routeIsClear(route: { x: number; y: number }[], polygons: Polygon[]): boolean {
  return route.every((point, i) => i === 0 || clear(route[i - 1], point, polygons))
}

describe('le relief', () => {
  const wall = rect(100, 0, 140, 300)

  it('sait si un chemin droit traverse une montagne', () => {
    expect(clear({ x: 0, y: 100 }, { x: 300, y: 100 }, [wall])).toBe(false)
    expect(clear({ x: 0, y: 400 }, { x: 300, y: 400 }, [wall])).toBe(true)
    // Tout entier dedans : bloqué aussi.
    expect(clear({ x: 110, y: 50 }, { x: 130, y: 60 }, [wall])).toBe(false)
    expect(inside({ x: 120, y: 10 }, wall)).toBe(true)
    expect(inside({ x: 160, y: 10 }, wall)).toBe(false)
  })

  it('contourne une montagne par le plus court chemin', () => {
    const from = { x: 0, y: 250 }
    const to = { x: 300, y: 250 }
    const route = findRoute(from, to, [wall])!
    expect(route[0]).toEqual(from)
    expect(route[route.length - 1]).toEqual(to)
    expect(routeIsClear(route, [wall])).toBe(true)
    // Par le bas du mur (le plus proche), et pas par le haut.
    expect(Math.max(...route.map((p) => p.y))).toBeGreaterThan(300)
    expect(routeLength(route)).toBeGreaterThan(300)
    expect(routeLength(route)).toBeLessThan(500)
  })

  it('va tout droit quand rien ne gêne', () => {
    expect(findRoute({ x: 0, y: 400 }, { x: 300, y: 400 }, [wall])).toEqual([
      { x: 0, y: 400 },
      { x: 300, y: 400 },
    ])
  })

  it('ne trouve aucun chemin vers un lieu enfermé, et en trouve un quand la porte s’ouvre', () => {
    // Une enceinte de quatre murs autour de (200, 200) ; le mur de droite est une porte.
    const walls = [rect(100, 100, 300, 120), rect(100, 280, 300, 300), rect(100, 100, 120, 300)]
    const door = rect(280, 100, 300, 300)
    const from = { x: 500, y: 200 }
    const to = { x: 200, y: 200 }
    expect(findRoute(from, to, [...walls, door])).toBeNull()
    const route = findRoute(from, to, walls)!
    expect(routeIsClear(route, walls)).toBe(true)
  })

  it('refuse d’aller dans une montagne, mais laisse en sortir', () => {
    expect(findRoute({ x: 0, y: 100 }, { x: 120, y: 100 }, [wall])).toBeNull()
    expect(findRoute({ x: 120, y: 100 }, { x: 300, y: 100 }, [wall])).toEqual([
      { x: 120, y: 100 },
      { x: 300, y: 100 },
    ])
  })

  it('ne fait jamais le tour d’une montagne par-delà le bord de la carte', () => {
    // Un mur qui barre la carte de haut en bas, et dépasse en haut et en bas.
    const barrier = rect(100, -50, 140, 350)
    expect(findRoute({ x: 0, y: 150 }, { x: 300, y: 150 }, [barrier], { width: 400, height: 300 })).toBeNull()
    expect(findRoute({ x: 0, y: 150 }, { x: 300, y: 150 }, [barrier])).not.toBeNull()
  })

  it('avance le long d’un chemin coudé', () => {
    const route = [
      { x: 0, y: 0 },
      { x: 30, y: 0 },
      { x: 30, y: 40 },
    ]
    expect(walk(route, 10)).toEqual({ x: 10, y: 0 })
    expect(walk(route, 50)).toEqual({ x: 30, y: 20 })
    expect(walk(route, 500)).toEqual({ x: 30, y: 40 })
  })
})
