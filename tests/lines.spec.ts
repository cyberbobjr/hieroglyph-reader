import { describe, expect, it } from 'vitest'
import {
  createLine,
  guessOrientation,
  lineAtPoint,
  moveLine,
  readingArrow,
  renumber,
  renumberByPosition,
  setLineNumber,
  sortByNumber,
} from '../src/core/lines'
import type { Line, LineGeometry } from '../src/types/models'

const rect = (x: number, y: number, w: number, h: number): LineGeometry => ({ type: 'rect', rect: { x, y, w, h } })

function make(specs: [number, number, number, number][], direction: 'rtl' | 'ltr' = 'rtl'): Line[] {
  const lines: Line[] = []
  for (const s of specs) lines.push(createLine(lines, rect(...s), { direction }))
  return lines
}

describe('createLine', () => {
  it('numérote à la suite', () => {
    const lines = make([
      [0, 0, 100, 20],
      [0, 30, 100, 20],
    ])
    expect(lines.map((l) => l.number)).toEqual([1, 2])
  })
  it('devine l’orientation', () => {
    expect(guessOrientation(rect(0, 0, 100, 20))).toBe('row')
    expect(guessOrientation(rect(0, 0, 20, 100))).toBe('column')
  })
  it('respecte le sens demandé', () => {
    expect(make([[0, 0, 10, 10]], 'ltr')[0].direction).toBe('ltr')
  })
})

describe('numérotation', () => {
  it('renumber comble les trous', () => {
    const lines = make([
      [0, 0, 100, 20],
      [0, 30, 100, 20],
      [0, 60, 100, 20],
    ])
    lines[1].number = 7
    lines[2].number = 4
    renumber(lines)
    expect(sortByNumber(lines).map((l) => l.number)).toEqual([1, 2, 3])
    expect(lines[2].number).toBe(2)
  })
  it('renumberByPosition : lignes de haut en bas', () => {
    const lines = make([
      [0, 60, 100, 20],
      [0, 0, 100, 20],
      [0, 30, 100, 20],
    ])
    renumberByPosition(lines)
    expect(lines.map((l) => l.number)).toEqual([3, 1, 2])
  })
  it('renumberByPosition : colonnes de droite à gauche en rtl, en-tête d’abord', () => {
    const lines = make([
      [0, 50, 20, 200], // colonne à gauche
      [100, 50, 20, 200], // colonne à droite
      [0, 0, 120, 30], // ligne d'en-tête
    ])
    renumberByPosition(lines)
    expect(lines.map((l) => l.number)).toEqual([3, 2, 1])
  })
  it('moveLine échange avec la voisine', () => {
    const lines = make([
      [0, 0, 100, 20],
      [0, 30, 100, 20],
    ])
    expect(moveLine(lines, lines[1].id, -1)).toBe(true)
    expect(lines.map((l) => l.number)).toEqual([2, 1])
    expect(moveLine(lines, lines[1].id, -1)).toBe(false)
  })
  it('setLineNumber échange les numéros en conflit', () => {
    const lines = make([
      [0, 0, 100, 20],
      [0, 30, 100, 20],
      [0, 60, 100, 20],
    ])
    setLineNumber(lines, lines[2].id, 1)
    expect(lines.map((l) => l.number)).toEqual([3, 2, 1])
  })
})

describe('lineAtPoint', () => {
  it('choisit la plus petite ligne sous le point', () => {
    const lines = make([
      [0, 0, 200, 200],
      [10, 10, 50, 20],
    ])
    expect(lineAtPoint(lines, { x: 20, y: 15 })?.id).toBe(lines[1].id)
    expect(lineAtPoint(lines, { x: 150, y: 150 })?.id).toBe(lines[0].id)
    expect(lineAtPoint(lines, { x: 500, y: 500 })).toBeUndefined()
  })
})

describe('readingArrow', () => {
  it('pointe vers la gauche en rtl et vers la droite en ltr', () => {
    const [rtl] = make([[0, 0, 100, 20]], 'rtl')
    const a = readingArrow(rtl)
    expect(a.to.x).toBeLessThan(a.from.x)
    const [ltr] = make([[0, 0, 100, 20]], 'ltr')
    const b = readingArrow(ltr)
    expect(b.to.x).toBeGreaterThan(b.from.x)
  })
  it('descend pour une colonne', () => {
    const [col] = make([[0, 0, 20, 100]])
    const a = readingArrow(col)
    expect(a.to.y).toBeGreaterThan(a.from.y)
  })
})
