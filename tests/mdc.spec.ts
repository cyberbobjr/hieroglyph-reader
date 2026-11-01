import { describe, expect, it } from 'vitest'
import { addItem, groupQuadrat, makeCartouche } from '../src/core/items'
import { lineSignList, lineToMdc, lineToUnicode, projectToMdc, stats, UNI_CARTOUCHE_BEGIN, UNI_CARTOUCHE_END, UNI_LOST } from '../src/core/mdc'
import { buildPrompt, FINAL_INSTRUCTION } from '../src/core/promptBuilder'
import { unicodeFor } from '../src/core/gardiner'
import seed from '../src/data/signs.seed.json'
import type { Direction, Item, Project, Sign } from '../src/types/models'
import { emptyProjectForTests } from './helpers'

const lib = new Map((seed.signs as Sign[]).map((s) => [s.gardiner, s]))
const lookup = (c: string) => lib.get(c)

/**
 * Fabrique une ligne. Chaque signe : [code, x, y, w, h] ; code null = non identifié,
 * code '//' = lacune. Les boîtes sont données de gauche à droite sur la photo.
 */
function makeLine(p: Project, signs: [string | null, number, number, number, number][], direction: Direction = 'ltr', y0 = 0) {
  const line = {
    id: `L${p.lines.length + 1}`,
    number: p.lines.length + 1,
    direction,
    orientation: 'row' as const,
    manualOrder: false,
    items: [] as Item[],
    geometry: { type: 'rect' as const, rect: { x: 0, y: y0, w: 1000, h: 100 } },
  }
  p.lines.push(line)
  const ids: string[] = []
  for (const [code, x, y, w, h] of signs) {
    const lac = code === '//'
    const it = addItem(p, line, { x, y: y + y0, w, h }, lac ? { status: 'lacune' } : code ? { signCode: code } : {})
    ids.push(it.id)
  }
  return { line, ids }
}

describe('MdC — signes simples et sens de lecture', () => {
  it('sépare les signes par « - », dans l’ordre de lecture gauche → droite', () => {
    const p = emptyProjectForTests()
    const { line } = makeLine(p, [['G17', 0, 10, 40, 60], ['D21', 50, 10, 40, 60], ['X1', 100, 10, 40, 60]], 'ltr')
    expect(lineToMdc(line, p.groups)).toBe('G17-D21-X1')
  })
  it('lit de droite à gauche : le signe de droite vient en premier', () => {
    const p = emptyProjectForTests()
    const { line } = makeLine(p, [['G17', 0, 10, 40, 60], ['D21', 50, 10, 40, 60], ['X1', 100, 10, 40, 60]], 'rtl')
    expect(lineToMdc(line, p.groups)).toBe('X1-D21-G17')
  })
})

describe('MdC — carrés', () => {
  it('deux signes empilés : « : »', () => {
    const p = emptyProjectForTests()
    const { line, ids } = makeLine(p, [['G17', 0, 10, 40, 60], ['X1', 50, 10, 40, 25], ['N35', 50, 45, 40, 25]])
    groupQuadrat(p, [ids[1], ids[2]])
    expect(lineToMdc(line, p.groups)).toBe('G17-X1:N35')
  })
  it('côte à côte au-dessus d’un large : « a*b:c », dans le sens de lecture', () => {
    const p = emptyProjectForTests()
    const { line, ids } = makeLine(p, [['D21', 0, 10, 18, 25], ['Z1', 22, 10, 18, 25], ['N35', 0, 45, 40, 20]], 'ltr')
    groupQuadrat(p, ids)
    expect(lineToMdc(line, p.groups)).toBe('D21*Z1:N35')
    const q = emptyProjectForTests()
    const r = makeLine(q, [['D21', 0, 10, 18, 25], ['Z1', 22, 10, 18, 25], ['N35', 0, 45, 40, 20]], 'rtl')
    groupQuadrat(q, r.ids)
    expect(lineToMdc(r.line, q.groups)).toBe('Z1*D21:N35')
  })
  it('un empilement à côté d’un signe prend des parenthèses', () => {
    const p = emptyProjectForTests()
    const { line, ids } = makeLine(p, [['M17', 0, 10, 15, 60], ['X1', 20, 10, 30, 25], ['N35', 20, 45, 30, 25]])
    groupQuadrat(p, ids)
    expect(lineToMdc(line, p.groups)).toBe('M17*(X1:N35)')
  })
  it('une disposition saisie à la main remplace le calcul', () => {
    const p = emptyProjectForTests()
    const { line, ids } = makeLine(p, [['X1', 0, 10, 40, 25], ['N35', 0, 45, 40, 25]])
    const g = groupQuadrat(p, ids)
    g.layoutOverride = 'X1*N35'
    expect(lineToMdc(line, p.groups)).toBe('X1*N35')
  })
})

describe('MdC — cartouches', () => {
  it('« <- … -> » autour des signes du cartouche', () => {
    const p = emptyProjectForTests()
    const { line, ids } = makeLine(p, [['M23', 0, 10, 40, 60], ['N5', 50, 10, 40, 60], ['Y5', 100, 10, 40, 60], ['L1', 150, 10, 40, 60]])
    makeCartouche(p, [ids[1], ids[3]])
    expect(lineToMdc(line, p.groups)).toBe('M23-<-N5-Y5-L1->')
  })
  it('cartouche contenant un carré, suivi d’un autre signe', () => {
    const p = emptyProjectForTests()
    const { line, ids } = makeLine(p, [['N5', 0, 10, 40, 60], ['X1', 50, 10, 40, 25], ['N35', 50, 45, 40, 25], ['G17', 100, 10, 40, 60]])
    groupQuadrat(p, [ids[1], ids[2]])
    makeCartouche(p, [ids[0], ids[2]])
    expect(lineToMdc(line, p.groups)).toBe('<-N5-X1:N35->-G17')
  })
  it('deux cartouches qui se suivent', () => {
    const p = emptyProjectForTests()
    const { line, ids } = makeLine(p, [['N5', 0, 10, 40, 60], ['Y5', 50, 10, 40, 60]])
    makeCartouche(p, [ids[0]])
    makeCartouche(p, [ids[1]])
    expect(lineToMdc(line, p.groups)).toBe('<-N5->-<-Y5->')
  })
})

describe('MdC — lacunes et signes non identifiés', () => {
  it('lacune « // », signe restitué « #b-…-#e », non identifié « ? »', () => {
    const p = emptyProjectForTests()
    const { line, ids } = makeLine(p, [['G17', 0, 10, 40, 60], ['//', 50, 10, 40, 60], ['D21', 100, 10, 40, 60], [null, 150, 10, 40, 60]])
    // signe restitué dans une lacune
    line.items.find((i) => i.id === ids[2])!.status = 'lacune'
    expect(lineToMdc(line, p.groups)).toBe('G17-//-#b-D21-#e-?')
  })
  it('lacune dans un carré : « // » à sa place', () => {
    const p = emptyProjectForTests()
    const { line, ids } = makeLine(p, [['X1', 0, 10, 40, 25], ['//', 0, 45, 40, 25]])
    groupQuadrat(p, ids)
    expect(lineToMdc(line, p.groups)).toBe('X1://')
  })
})

describe('MdC — plusieurs lignes', () => {
  it('lignes séparées par « ! », dans l’ordre des numéros, lignes vides ignorées', () => {
    const p = emptyProjectForTests()
    makeLine(p, [['G17', 0, 10, 40, 60]], 'ltr', 0)
    makeLine(p, [], 'ltr', 200)
    makeLine(p, [['D21', 0, 10, 40, 60]], 'ltr', 400)
    expect(projectToMdc(p)).toBe('G17-!\nD21')
  })
})

describe('Unicode', () => {
  it('chaîne linéaire avec cartouche et signe perdu', () => {
    const p = emptyProjectForTests()
    const { line, ids } = makeLine(p, [['G17', 0, 10, 40, 60], ['N5', 50, 10, 40, 60], ['//', 100, 10, 40, 60]])
    makeCartouche(p, [ids[1]])
    expect(lineToUnicode(line, p.groups, lookup)).toBe(unicodeFor('G17') + UNI_CARTOUCHE_BEGIN + unicodeFor('N5') + UNI_CARTOUCHE_END + UNI_LOST)
  })
})

describe('liste des signes', () => {
  it('codes, valeurs, statuts, groupes et notes', () => {
    const p = emptyProjectForTests()
    const { line, ids } = makeLine(p, [['G17', 0, 10, 40, 60], ['X1', 50, 10, 40, 25], ['N35', 50, 45, 40, 25]])
    groupQuadrat(p, [ids[1], ids[2]])
    const it = line.items.find((i) => i.id === ids[0])!
    it.status = 'incertain'
    it.note = 'bec abîmé'
    expect(lineSignList(line, p.groups, lookup)).toBe('1. G17 [m] incertain (note : bec abîmé) ; 2. X1 [t] certain — carré ; 3. N35 [n] certain — carré')
  })
})

describe('« Copier pour Claude »', () => {
  function sample() {
    const p = emptyProjectForTests()
    p.name = 'Stèle de test'
    p.notes = 'Calcaire, Moyen Empire (?)'
    const a = makeLine(p, [['G17', 0, 10, 40, 60], ['//', 50, 10, 40, 60]], 'rtl', 0)
    const b = makeLine(p, [['D21', 0, 10, 40, 60], [null, 50, 10, 40, 60]], 'rtl', 200)
    a.line.items.find((i) => i.signCode === 'G17')!.status = 'probable'
    void b
    return p
  }
  it('contient le contexte, chaque ligne et la consigne finale', () => {
    const p = sample()
    const text = buildPrompt(p, lookup)
    expect(text).toContain('Stèle : Stèle de test')
    expect(text).toContain('Calcaire, Moyen Empire (?)')
    expect(text).toContain('Nombre de lignes : 2')
    expect(text).toContain('droite → gauche pour toutes les lignes')
    expect(text).toContain('1 lacune (signe détruit)')
    expect(text).toContain('1 signe non identifié')
    expect(text).toContain('### Ligne 1 (ligne horizontale, droite → gauche)')
    expect(text).toContain('MdC : //-G17')
    expect(text).toContain('Ligne 1, signe 2 : G17, probable')
    expect(text.trim().endsWith(FINAL_INSTRUCTION)).toBe(true)
  })
  it('les statistiques comptent juste', () => {
    const s = stats(sample())
    expect(s).toMatchObject({ lines: 2, signs: 4, unidentified: 1 })
    expect(s.byStatus.lacune).toBe(1)
    expect(s.byStatus.probable).toBe(1)
  })
})
