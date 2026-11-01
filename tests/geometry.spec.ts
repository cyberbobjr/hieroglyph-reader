import { describe, expect, it } from 'vitest'
import {
  geometryBounds,
  insertVertexAfter,
  moveVertex,
  pointInGeometry,
  pointInPolygon,
  polygonArea,
  rectFromPoints,
  removeVertex,
  translateGeometry,
} from '../src/core/geometry'
import type { LineGeometry } from '../src/types/models'

const square = [
  { x: 0, y: 0 },
  { x: 10, y: 0 },
  { x: 10, y: 10 },
  { x: 0, y: 10 },
]
// Polygone en « L » (concave)
const ell = [
  { x: 0, y: 0 },
  { x: 10, y: 0 },
  { x: 10, y: 4 },
  { x: 4, y: 4 },
  { x: 4, y: 10 },
  { x: 0, y: 10 },
]

describe('rectFromPoints', () => {
  it('fonctionne quel que soit l’ordre des coins', () => {
    expect(rectFromPoints({ x: 10, y: 8 }, { x: 2, y: 3 })).toEqual({ x: 2, y: 3, w: 8, h: 5 })
  })
})

describe('pointInPolygon', () => {
  it('reconnaît un point intérieur et extérieur', () => {
    expect(pointInPolygon({ x: 5, y: 5 }, square)).toBe(true)
    expect(pointInPolygon({ x: 15, y: 5 }, square)).toBe(false)
  })
  it('gère les polygones concaves', () => {
    expect(pointInPolygon({ x: 2, y: 8 }, ell)).toBe(true)
    expect(pointInPolygon({ x: 8, y: 8 }, ell)).toBe(false)
  })
})

describe('polygonArea', () => {
  it('calcule l’aire', () => {
    expect(polygonArea(square)).toBe(100)
    expect(polygonArea(ell)).toBe(64)
  })
})

describe('opérations sur une géométrie', () => {
  const rect: LineGeometry = { type: 'rect', rect: { x: 0, y: 0, w: 10, h: 5 } }
  it('translation', () => {
    expect(translateGeometry(rect, 3, 4)).toEqual({ type: 'rect', rect: { x: 3, y: 4, w: 10, h: 5 } })
  })
  it('déplacer un coin de rectangle garde le coin opposé', () => {
    // coin BD (index 2) déplacé ; le coin HG (0,0) reste
    expect(moveVertex(rect, 2, { x: 20, y: 9 })).toEqual({ type: 'rect', rect: { x: 0, y: 0, w: 20, h: 9 } })
    // on peut même « retourner » le rectangle
    expect(moveVertex(rect, 2, { x: -5, y: -5 })).toEqual({ type: 'rect', rect: { x: -5, y: -5, w: 5, h: 5 } })
  })
  it('déplacer un sommet de polygone', () => {
    const g = moveVertex({ type: 'polygon', points: square }, 1, { x: 12, y: -2 })
    expect(g.type === 'polygon' && g.points[1]).toEqual({ x: 12, y: -2 })
  })
  it('ajouter puis retirer un sommet', () => {
    const g = insertVertexAfter({ type: 'polygon', points: square }, 0)
    expect(g.type === 'polygon' && g.points[1]).toEqual({ x: 5, y: 0 })
    const back = removeVertex(g, 1)
    expect(back.type === 'polygon' && back.points).toEqual(square)
  })
  it('ne descend jamais sous 3 sommets', () => {
    const tri: LineGeometry = { type: 'polygon', points: square.slice(0, 3) }
    expect(removeVertex(tri, 0)).toBe(tri)
  })
  it('appartenance et boîte englobante', () => {
    const poly: LineGeometry = { type: 'polygon', points: ell }
    expect(pointInGeometry({ x: 1, y: 9 }, poly)).toBe(true)
    expect(geometryBounds(poly)).toEqual({ x: 0, y: 0, w: 10, h: 10 })
  })
})
