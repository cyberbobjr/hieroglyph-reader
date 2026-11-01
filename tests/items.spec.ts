import { describe, expect, it } from 'vitest'
import { addItem, deleteItems, groupQuadrat, lineForBox, makeCartouche, moveInOrder, nextUnassigned, neighbourItem, reorderLine, ungroup } from '../src/core/items'
import { emptyProjectForTests } from './helpers'

function setup(direction: 'rtl' | 'ltr' = 'ltr') {
  const p = emptyProjectForTests()
  p.lines.push({
    id: 'L1', number: 1, direction, orientation: 'row', manualOrder: false, items: [],
    geometry: { type: 'rect', rect: { x: 0, y: 0, w: 400, h: 60 } },
  })
  p.lines.push({
    id: 'L2', number: 2, direction, orientation: 'row', manualOrder: false, items: [],
    geometry: { type: 'rect', rect: { x: 0, y: 100, w: 400, h: 60 } },
  })
  const [l1, l2] = p.lines
  const ids = [10, 50, 90, 130].map((x) => addItem(p, l1, { x, y: 10, w: 30, h: 40 }).id)
  const second = addItem(p, l2, { x: 10, y: 110, w: 30, h: 40 }).id
  return { p, l1, l2, ids, second }
}

describe('boîtes', () => {
  it('trouve la ligne qui contient la boîte', () => {
    const { p } = setup()
    expect(lineForBox(p, { x: 20, y: 120, w: 10, h: 10 })?.id).toBe('L2')
    expect(lineForBox(p, { x: 20, y: 70, w: 10, h: 10 })).toBeUndefined()
  })
  it('range automatiquement selon le sens', () => {
    const { p, l1, ids } = setup('rtl')
    expect(l1.items.map((i) => i.id)).toEqual([...ids].reverse())
    void p
  })
  it('passe à la boîte suivante, y compris sur la ligne suivante', () => {
    const { p, ids, second } = setup()
    expect(neighbourItem(p, ids[3], 1)?.id).toBe(second)
    expect(neighbourItem(p, ids[0], -1)).toBeNull()
  })
  it('trouve la prochaine boîte sans signe', () => {
    const { p, l1, ids } = setup()
    l1.items[1].signCode = 'G17'
    expect(nextUnassigned(p, ids[0])?.id).toBe(ids[2])
  })
  it('supprime une boîte et nettoie le carré devenu inutile', () => {
    const { p, ids } = setup()
    groupQuadrat(p, [ids[0], ids[1]])
    deleteItems(p, [ids[0]])
    expect(p.groups).toHaveLength(0)
    expect(p.lines[0].items.find((i) => i.id === ids[1])?.groupId).toBeUndefined()
  })
})

describe('carrés et cartouches', () => {
  it('forme et défait un carré', () => {
    const { p, l1, ids } = setup()
    const g = groupQuadrat(p, [ids[1], ids[2]])
    expect(l1.items.filter((i) => i.groupId === g.id)).toHaveLength(2)
    ungroup(p, g.id)
    expect(p.groups).toHaveLength(0)
    expect(l1.items.some((i) => i.groupId)).toBe(false)
  })
  it('refuse un carré à cheval sur deux lignes', () => {
    const { p, ids, second } = setup()
    expect(() => groupQuadrat(p, [ids[0], second])).toThrow()
  })
  it('un cartouche englobe tout l’intervalle et ne coupe pas un carré', () => {
    const { p, ids } = setup()
    groupQuadrat(p, [ids[2], ids[3]])
    const c = makeCartouche(p, [ids[1], ids[2]])
    expect(c.memberIds).toEqual([ids[1], ids[2], ids[3]])
    expect(() => makeCartouche(p, [ids[3]])).toThrow()
  })
})

describe('ordre manuel', () => {
  it('déplace un signe et fige l’ordre', () => {
    const { p, l1, ids } = setup()
    moveInOrder(p, ids[2], -1)
    expect(l1.items.map((i) => i.id)).toEqual([ids[0], ids[2], ids[1], ids[3]])
    expect(l1.manualOrder).toBe(true)
    // une nouvelle boîte s'insère à sa place logique sans tout recalculer
    const n = addItem(p, l1, { x: 170, y: 10, w: 30, h: 40 })
    expect(l1.items.at(-1)?.id).toBe(n.id)
    expect(l1.items[1].id).toBe(ids[2])
    // recalcul forcé
    reorderLine(p, l1, true)
    expect(l1.items.map((i) => i.id).slice(0, 4)).toEqual(ids)
    expect(l1.manualOrder).toBe(false)
  })
  it('déplace un carré d’un bloc', () => {
    const { p, l1, ids } = setup()
    groupQuadrat(p, [ids[1], ids[2]])
    moveInOrder(p, ids[0], 1) // a passe après le carré
    expect(l1.items.map((i) => i.id)).toEqual([ids[1], ids[2], ids[0], ids[3]])
  })
})
