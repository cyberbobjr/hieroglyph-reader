/**
 * Disposition des signes à l'intérieur d'un carré.
 *
 * On découpe le carré comme on découperait une image :
 *  - s'il existe des « étages » séparés verticalement, ils sont EMPILÉS
 *    (en MdC : « : ») ;
 *  - sinon, s'il existe des parties séparées horizontalement, elles sont
 *    CÔTE À CÔTE (en MdC : « * »), rangées dans le sens de lecture ;
 *  - et l'on recommence à l'intérieur de chaque partie.
 *
 * Exemple : deux petits signes côte à côte au-dessus d'un signe large donnent
 *   empilé( côte-à-côte(a, b), c )   →  en MdC « a*b:c »
 *
 * Le résultat est un petit arbre ; sa traduction en texte MdC se fait à l'export.
 */
import type { Direction, Rect } from '../types/models'

export type LayoutNode =
  | { type: 'sign'; id: string }
  | { type: 'stack'; children: LayoutNode[] } // de haut en bas
  | { type: 'row'; children: LayoutNode[] } // côte à côte, dans le sens de lecture

export interface LayoutBox {
  id: string
  box: Rect
}

/** Deux blocs dont le recouvrement dépasse cette fraction ne sont pas séparables. */
const TOLERANCE = 0.25

/** Coupe un ensemble de blocs en bandes séparées le long d'un axe. */
function bands(items: LayoutBox[], axis: 'x' | 'y'): LayoutBox[][] {
  const s = (b: Rect) => (axis === 'x' ? b.x : b.y)
  const len = (b: Rect) => (axis === 'x' ? b.w : b.h)
  const sorted = [...items].sort((a, b) => s(a.box) - s(b.box))
  const out: { items: LayoutBox[]; end: number; minLen: number }[] = []
  for (const it of sorted) {
    const g = out.at(-1)
    const a = s(it.box)
    const e = a + len(it.box)
    // Petit chevauchement toléré : les signes gravés débordent souvent un peu.
    if (g && g.end - a > TOLERANCE * Math.min(len(it.box), g.minLen)) {
      g.items.push(it)
      g.end = Math.max(g.end, e)
      g.minLen = Math.min(g.minLen, len(it.box))
    } else {
      out.push({ items: [it], end: e, minLen: len(it.box) })
    }
  }
  return out.map((g) => g.items)
}

export function layoutQuadrat(items: LayoutBox[], direction: Direction): LayoutNode {
  if (items.length === 1) return { type: 'sign', id: items[0].id }
  const floors = bands(items, 'y')
  if (floors.length > 1) {
    return flatten({ type: 'stack', children: floors.map((f) => layoutQuadrat(f, direction)) })
  }
  let cols = bands(items, 'x')
  if (cols.length > 1) {
    if (direction === 'rtl') cols = cols.reverse()
    return flatten({ type: 'row', children: cols.map((c) => layoutQuadrat(c, direction)) })
  }
  // Signes enchevêtrés, impossibles à séparer : on les met côte à côte dans l'ordre de lecture.
  const sorted = [...items].sort((a, b) =>
    direction === 'rtl' ? b.box.x + b.box.w / 2 - (a.box.x + a.box.w / 2) : a.box.x + a.box.w / 2 - (b.box.x + b.box.w / 2),
  )
  return { type: 'row', children: sorted.map((i) => ({ type: 'sign', id: i.id })) }
}

/** Évite les emboîtements inutiles : stack(stack(a,b),c) → stack(a,b,c). */
function flatten(node: LayoutNode): LayoutNode {
  if (node.type === 'sign') return node
  const children = node.children.flatMap((c) => (c.type === node.type ? c.children : [c]))
  return { type: node.type, children }
}

/** Liste des signes de l'arbre dans l'ordre de lecture. */
export function layoutOrder(node: LayoutNode): string[] {
  return node.type === 'sign' ? [node.id] : node.children.flatMap(layoutOrder)
}

/**
 * Écrit l'arbre en texte façon MdC : « : » empilé, « * » côte à côte.
 * En MdC, « * » est prioritaire sur « : » : un empilement placé à côté d'un
 * autre signe doit donc être mis entre parenthèses, ex. « (a:b)*c ».
 */
export function layoutToText(node: LayoutNode, label: (id: string) => string): string {
  if (node.type === 'sign') return label(node.id)
  if (node.type === 'stack') return node.children.map((c) => layoutToText(c, label)).join(':')
  return node.children
    .map((c) => (c.type === 'stack' ? `(${layoutToText(c, label)})` : layoutToText(c, label)))
    .join('*')
}
