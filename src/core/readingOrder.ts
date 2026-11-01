/**
 * Ordre de lecture automatique des signes d'une ligne.
 *
 * Rappel des règles égyptiennes :
 *  - on lit vers le côté que regardent les signes (sens de la ligne) ;
 *  - à l'intérieur d'un « carré », on lit de haut en bas, et deux signes
 *    côte à côte se lisent dans le sens de la ligne.
 *
 * Méthode pour une ligne horizontale :
 *  1. on regroupe les signes qui se recouvrent horizontalement (signes
 *     empilés) en « paquets » ;
 *  2. on range les paquets dans le sens de lecture (droite → gauche ou l'inverse) ;
 *  3. dans chaque paquet, on range par « étages » de haut en bas, et dans un
 *     étage dans le sens de lecture.
 * Pour une colonne, on fait la même chose en échangeant horizontal et vertical.
 *
 * Les carrés définis à la main (groupes) sont traités comme un seul bloc,
 * puis leurs signes sont rangés avec la même méthode.
 */
import type { Direction, Group, Line, Orientation, Rect } from '../types/models'

interface Unit {
  ids: string[]
  box: Rect
}

/** Seuil de recouvrement (fraction de la plus petite taille) pour dire que deux blocs se superposent. */
const OVERLAP = 0.3

function union(boxes: Rect[]): Rect {
  const x = Math.min(...boxes.map((b) => b.x))
  const y = Math.min(...boxes.map((b) => b.y))
  const r = Math.max(...boxes.map((b) => b.x + b.w))
  const bt = Math.max(...boxes.map((b) => b.y + b.h))
  return { x, y, w: r - x, h: bt - y }
}

type Axis = 'x' | 'y'
const start = (b: Rect, a: Axis) => (a === 'x' ? b.x : b.y)
const size = (b: Rect, a: Axis) => (a === 'x' ? b.w : b.h)
const center = (b: Rect, a: Axis) => start(b, a) + size(b, a) / 2

/** Regroupe les blocs qui se recouvrent sur l'axe donné. */
function cluster<T extends { box: Rect }>(units: T[], axis: Axis): T[][] {
  const sorted = [...units].sort((p, q) => start(p.box, axis) - start(q.box, axis))
  const groups: { items: T[]; from: number; to: number }[] = []
  for (const u of sorted) {
    const s = start(u.box, axis)
    const e = s + size(u.box, axis)
    const g = groups.at(-1)
    if (g) {
      const overlap = Math.min(e, g.to) - Math.max(s, g.from)
      const minLen = Math.max(1e-6, Math.min(e - s, g.to - g.from))
      if (overlap / minLen >= OVERLAP) {
        g.items.push(u)
        g.to = Math.max(g.to, e)
        g.from = Math.min(g.from, s)
        continue
      }
    }
    groups.push({ items: [u], from: s, to: e })
  }
  return groups.map((g) => g.items)
}

/** Range des blocs dans l'ordre de lecture. */
export function orderUnits<T extends { box: Rect }>(units: T[], orientation: Orientation, direction: Direction): T[] {
  if (units.length <= 1) return [...units]
  // Axe principal : celui le long duquel on avance dans la ligne.
  const main: Axis = orientation === 'row' ? 'x' : 'y'
  const cross: Axis = main === 'x' ? 'y' : 'x'
  // Sens de progression sur chaque axe : y toujours vers le bas ; x selon le sens.
  const sign = (a: Axis) => (a === 'y' ? 1 : direction === 'rtl' ? -1 : 1)
  const byCenter = (a: Axis) => (p: { box: Rect }, q: { box: Rect }) => sign(a) * (center(p.box, a) - center(q.box, a))

  const packets = cluster(units, main).sort((p, q) =>
    byCenter(main)({ box: union(p.map((u) => u.box)) }, { box: union(q.map((u) => u.box)) }),
  )
  const out: T[] = []
  for (const packet of packets) {
    // Dans un paquet : d'abord l'axe vertical (haut → bas) pour une ligne,
    // l'axe horizontal (dans le sens de lecture) pour une colonne.
    const floors = cluster(packet, cross).sort((p, q) =>
      byCenter(cross)({ box: union(p.map((u) => u.box)) }, { box: union(q.map((u) => u.box)) }),
    )
    for (const f of floors) out.push(...[...f].sort(byCenter(main)))
  }
  return out
}

/** Ordre de lecture automatique des boîtes d'une ligne (liste d'identifiants). */
export function autoOrder(line: Line, groups: Group[]): string[] {
  const quadrats = groups.filter((g) => g.lineId === line.id && g.kind === 'quadrat')
  const byId = new Map(line.items.map((i) => [i.id, i]))
  const grouped = new Set<string>()
  const units: Unit[] = []
  for (const g of quadrats) {
    const members = g.memberIds.map((id) => byId.get(id)).filter((i): i is NonNullable<typeof i> => !!i)
    if (!members.length) continue
    members.forEach((m) => grouped.add(m.id))
    const inner = orderUnits(
      members.map((m) => ({ ids: [m.id], box: m.bbox })),
      line.orientation,
      line.direction,
    )
    units.push({ ids: inner.flatMap((u) => u.ids), box: union(members.map((m) => m.bbox)) })
  }
  for (const it of line.items) if (!grouped.has(it.id)) units.push({ ids: [it.id], box: it.bbox })
  return orderUnits(units, line.orientation, line.direction).flatMap((u) => u.ids)
}
