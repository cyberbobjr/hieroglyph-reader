import { describe, expect, it } from 'vitest'
import { autoOrder, orderUnits } from '../src/core/readingOrder'
import { layoutOrder, layoutQuadrat, type LayoutNode } from '../src/core/quadratLayout'
import type { Group, Item, Line } from '../src/types/models'

const box = (x: number, y: number, w = 20, h = 20) => ({ x, y, w, h })
const item = (id: string, x: number, y: number, w = 20, h = 20): Item => ({ id, bbox: box(x, y, w, h), status: 'certain', note: '' })
const line = (items: Item[], direction: 'rtl' | 'ltr', orientation: 'row' | 'column' = 'row'): Line => ({
  id: 'L',
  number: 1,
  direction,
  orientation,
  geometry: { type: 'rect', rect: box(0, 0, 500, 100) },
  items,
  manualOrder: false,
})

// Une ligne type :   [a]   [b]   [c sur d]   [e]
//   a, b, e : signes hauts ; c au-dessus de d (empilés)
const row = [item('a', 0, 0, 20, 60), item('b', 30, 0, 20, 60), item('c', 60, 0, 30, 25), item('d', 60, 32, 30, 25), item('e', 100, 0, 20, 60)]

describe('ordre de lecture — lignes', () => {
  it('de gauche à droite, signes empilés de haut en bas', () => {
    expect(autoOrder(line(row, 'ltr'), [])).toEqual(['a', 'b', 'c', 'd', 'e'])
  })
  it('de droite à gauche, signes empilés toujours de haut en bas', () => {
    expect(autoOrder(line(row, 'rtl'), [])).toEqual(['e', 'c', 'd', 'b', 'a'])
  })
  it('deux petits signes côte à côte au-dessus d’un large : haut d’abord, dans le sens de lecture', () => {
    const q = [item('p', 0, 0, 14, 20), item('q', 18, 0, 14, 20), item('r', 0, 25, 32, 15)]
    expect(autoOrder(line(q, 'ltr'), [])).toEqual(['p', 'q', 'r'])
    expect(autoOrder(line(q, 'rtl'), [])).toEqual(['q', 'p', 'r'])
  })
  it('l’ordre de dessin des boîtes n’a pas d’importance', () => {
    const shuffled = [row[3], row[0], row[4], row[2], row[1]]
    expect(autoOrder(line(shuffled, 'ltr'), [])).toEqual(['a', 'b', 'c', 'd', 'e'])
  })
})

describe('ordre de lecture — colonnes', () => {
  it('de haut en bas ; deux signes côte à côte dans le sens de lecture', () => {
    const col = [item('a', 0, 0, 40, 20), item('b', 0, 30, 18, 20), item('c', 22, 30, 18, 20), item('d', 0, 60, 40, 20)]
    expect(autoOrder(line(col, 'ltr', 'column'), [])).toEqual(['a', 'b', 'c', 'd'])
    expect(autoOrder(line(col, 'rtl', 'column'), [])).toEqual(['a', 'c', 'b', 'd'])
  })
})

describe('ordre de lecture — carrés définis à la main', () => {
  it('un carré reste d’un seul tenant', () => {
    // b est un peu décalé : sans carré, il passerait entre a et c
    const items = [item('a', 0, 0), item('b', 40, 0), item('c', 25, 25, 30, 20), item('d', 80, 0)]
    const g: Group = { id: 'g', lineId: 'L', kind: 'quadrat', memberIds: ['b', 'c'] }
    const order = autoOrder(line(items, 'ltr'), [g])
    expect(order.indexOf('c') - order.indexOf('b')).toBe(1)
    expect(order[0]).toBe('a')
    expect(order.at(-1)).toBe('d')
  })
})

describe('orderUnits', () => {
  it('ne plante pas avec 0 ou 1 bloc', () => {
    expect(orderUnits([], 'row', 'rtl')).toEqual([])
    expect(orderUnits([{ box: box(0, 0) }], 'row', 'rtl')).toHaveLength(1)
  })
})

/** Petit utilitaire : arbre → texte lisible pour les tests (« : » empilé, « * » côte à côte). */
function show(n: LayoutNode): string {
  if (n.type === 'sign') return n.id
  const sep = n.type === 'stack' ? ':' : '*'
  return '(' + n.children.map(show).join(sep) + ')'
}

describe('disposition d’un carré', () => {
  it('deux signes empilés', () => {
    expect(show(layoutQuadrat([{ id: 'a', box: box(0, 0, 30, 10) }, { id: 'b', box: box(0, 14, 30, 10) }], 'ltr'))).toBe('(a:b)')
  })
  it('deux signes côte à côte, dans le sens de lecture', () => {
    const q = [{ id: 'a', box: box(0, 0, 10, 30) }, { id: 'b', box: box(14, 0, 10, 30) }]
    expect(show(layoutQuadrat(q, 'ltr'))).toBe('(a*b)')
    expect(show(layoutQuadrat(q, 'rtl'))).toBe('(b*a)')
  })
  it('deux petits côte à côte au-dessus d’un large', () => {
    const q = [{ id: 'a', box: box(0, 0, 14, 14) }, { id: 'b', box: box(18, 0, 14, 14) }, { id: 'c', box: box(0, 18, 32, 12) }]
    expect(show(layoutQuadrat(q, 'ltr'))).toBe('((a*b):c)')
  })
  it('un signe haut à côté de deux empilés', () => {
    const q = [{ id: 'a', box: box(0, 0, 12, 40) }, { id: 'b', box: box(16, 0, 20, 18) }, { id: 'c', box: box(16, 22, 20, 18) }]
    expect(show(layoutQuadrat(q, 'ltr'))).toBe('(a*(b:c))')
    expect(layoutOrder(layoutQuadrat(q, 'rtl'))).toEqual(['b', 'c', 'a'])
  })
  it('tolère un léger chevauchement des boîtes', () => {
    const q = [{ id: 'a', box: box(0, 0, 30, 12) }, { id: 'b', box: box(0, 10, 30, 12) }]
    expect(show(layoutQuadrat(q, 'ltr'))).toBe('(a:b)')
  })
  it('trois empilés donnent un seul niveau', () => {
    const q = [0, 12, 24].map((y, i) => ({ id: 'abc'[i], box: box(0, y, 30, 10) }))
    expect(show(layoutQuadrat(q, 'ltr'))).toBe('(a:b:c)')
  })
})

describe('layoutToText', async () => {
  const { layoutToText } = await import('../src/core/quadratLayout')
  const id = (x: string) => x
  it('empilement et juxtaposition', () => {
    const q = [{ id: 'a', box: box(0, 0, 14, 14) }, { id: 'b', box: box(18, 0, 14, 14) }, { id: 'c', box: box(0, 18, 32, 12) }]
    expect(layoutToText(layoutQuadrat(q, 'ltr'), id)).toBe('a*b:c')
  })
  it('parenthèses quand un empilement est à côté d’un signe', () => {
    const q = [{ id: 'a', box: box(0, 0, 12, 40) }, { id: 'b', box: box(16, 0, 20, 18) }, { id: 'c', box: box(16, 22, 20, 18) }]
    expect(layoutToText(layoutQuadrat(q, 'ltr'), id)).toBe('a*(b:c)')
    expect(layoutToText(layoutQuadrat(q, 'rtl'), id)).toBe('(b:c)*a')
  })
})
