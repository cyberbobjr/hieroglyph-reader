/**
 * Opérations sur les boîtes de signes (« items ») et leurs groupes.
 * Ces fonctions modifient directement le projet reçu : on les appelle
 * toujours à l'intérieur de `store.mutate(...)`, ce qui les rend annulables.
 */
import type { Group, Item, Line, Project, Rect, SignStatus } from '../types/models'
import { autoOrder } from './readingOrder'
import { geometryArea, pointInGeometry } from './geometry'
import { newId } from './ids'
import { sortByNumber } from './lines'

export function findItem(p: Project, itemId: string): { line: Line; item: Item; index: number } | null {
  for (const line of p.lines) {
    const index = line.items.findIndex((i) => i.id === itemId)
    if (index >= 0) return { line, item: line.items[index], index }
  }
  return null
}

/** Ligne qui contient le centre de la boîte (la plus petite en cas de chevauchement). */
export function lineForBox(p: Project, box: Rect): Line | undefined {
  const c = { x: box.x + box.w / 2, y: box.y + box.h / 2 }
  return p.lines
    .filter((l) => pointInGeometry(c, l.geometry))
    .sort((a, b) => geometryArea(a.geometry) - geometryArea(b.geometry))[0]
}

/** Remet les boîtes d'une ligne dans l'ordre de lecture automatique (sauf si l'ordre est manuel). */
export function reorderLine(p: Project, line: Line, force = false) {
  if (line.manualOrder && !force) return
  const order = autoOrder(line, p.groups)
  const byId = new Map(line.items.map((i) => [i.id, i]))
  line.items = order.map((id) => byId.get(id)!).filter(Boolean)
  if (force) line.manualOrder = false
}

export function addItem(p: Project, line: Line, box: Rect, init: Partial<Item> = {}): Item {
  const r = (v: number) => Math.round(v * 10) / 10
  const item: Item = {
    id: newId('i_'),
    bbox: { x: r(box.x), y: r(box.y), w: r(box.w), h: r(box.h) },
    status: 'certain',
    note: '',
    ...init,
  }
  if (line.manualOrder) {
    // Ordre manuel : on insère la boîte juste après celle qui la précède dans l'ordre automatique.
    const tmp = { ...line, items: [...line.items, item] }
    const auto = autoOrder(tmp, p.groups)
    const prevId = auto[auto.indexOf(item.id) - 1]
    const at = prevId ? line.items.findIndex((i) => i.id === prevId) + 1 : 0
    line.items.splice(at, 0, item)
  } else {
    line.items.push(item)
    reorderLine(p, line)
  }
  return item
}

/** Supprime des boîtes et nettoie les groupes devenus vides ou inutiles. */
export function deleteItems(p: Project, ids: string[]) {
  const gone = new Set(ids)
  for (const line of p.lines) line.items = line.items.filter((i) => !gone.has(i.id))
  for (const g of p.groups) g.memberIds = g.memberIds.filter((id) => !gone.has(id))
  cleanGroups(p)
}

function cleanGroups(p: Project) {
  const removed = p.groups.filter((g) => (g.kind === 'quadrat' ? g.memberIds.length < 2 : g.memberIds.length < 1))
  if (!removed.length) return
  const removedIds = new Set(removed.map((g) => g.id))
  p.groups = p.groups.filter((g) => !removedIds.has(g.id))
  for (const line of p.lines) for (const it of line.items) if (it.groupId && removedIds.has(it.groupId)) delete it.groupId
}

/** Vérifie que des boîtes sont toutes dans la même ligne. */
function sameLine(p: Project, ids: string[]): Line {
  const found = ids.map((id) => findItem(p, id))
  if (found.some((f) => !f)) throw new Error('Boîte introuvable.')
  const line = found[0]!.line
  if (found.some((f) => f!.line.id !== line.id)) throw new Error('Les signes doivent être dans la même ligne.')
  return line
}

/** Rend des boîtes contiguës dans l'ordre (utile en ordre manuel), à la place de la première. */
function makeContiguous(line: Line, ids: string[]) {
  const set = new Set(ids)
  const first = line.items.findIndex((i) => set.has(i.id))
  const members = line.items.filter((i) => set.has(i.id))
  const rest = line.items.filter((i) => !set.has(i.id))
  const before = line.items.slice(0, first).filter((i) => !set.has(i.id)).length
  line.items = [...rest.slice(0, before), ...members, ...rest.slice(before)]
}

/** Groupe des boîtes en un carré. Un signe ne peut appartenir qu'à un seul carré. */
export function groupQuadrat(p: Project, ids: string[]): Group {
  if (ids.length < 2) throw new Error('Sélectionnez au moins 2 signes pour former un carré.')
  const line = sameLine(p, ids)
  // Si certains signes étaient déjà dans un carré, on fusionne.
  const old = new Set(ids.map((id) => findItem(p, id)!.item.groupId).filter((g): g is string => !!g))
  const members = new Set(ids)
  for (const g of p.groups) if (old.has(g.id)) g.memberIds.forEach((m) => members.add(m))
  p.groups = p.groups.filter((g) => !old.has(g.id))
  const group: Group = { id: newId('g_'), lineId: line.id, kind: 'quadrat', memberIds: [...members] }
  p.groups.push(group)
  for (const it of line.items) if (members.has(it.id)) it.groupId = group.id
  if (line.manualOrder) {
    // On garde l'ordre automatique à l'intérieur du carré.
    const inner = autoOrder({ ...line, items: line.items.filter((i) => members.has(i.id)) }, [])
    makeContiguous(line, inner)
    const byId = new Map(line.items.map((i) => [i.id, i]))
    const start = line.items.findIndex((i) => members.has(i.id))
    line.items.splice(start, inner.length, ...inner.map((id) => byId.get(id)!))
  } else reorderLine(p, line)
  return group
}

export function ungroup(p: Project, groupId: string) {
  const g = p.groups.find((x) => x.id === groupId)
  if (!g) return
  p.groups = p.groups.filter((x) => x.id !== groupId)
  for (const line of p.lines) for (const it of line.items) if (it.groupId === groupId) delete it.groupId
  const line = p.lines.find((l) => l.id === g.lineId)
  if (line) reorderLine(p, line)
}

/**
 * Crée un cartouche. Il englobe tous les signes entre le premier et le
 * dernier signe choisis (dans l'ordre de lecture), carrés compris.
 */
export function makeCartouche(p: Project, ids: string[]): Group {
  if (!ids.length) throw new Error('Sélectionnez les signes du cartouche.')
  const line = sameLine(p, ids)
  const idx = ids.map((id) => line.items.findIndex((i) => i.id === id))
  let from = Math.min(...idx)
  let to = Math.max(...idx)
  // On ne coupe jamais un carré en deux.
  const quadOf = (k: number) => line.items[k]?.groupId
  while (from > 0 && quadOf(from) && quadOf(from - 1) === quadOf(from)) from--
  while (to < line.items.length - 1 && quadOf(to) && quadOf(to + 1) === quadOf(to)) to++
  const span = line.items.slice(from, to + 1).map((i) => i.id)
  const inCartouche = new Set(p.groups.filter((g) => g.kind === 'cartouche').flatMap((g) => g.memberIds))
  if (span.some((id) => inCartouche.has(id))) throw new Error('Un de ces signes est déjà dans un cartouche.')
  const group: Group = { id: newId('c_'), lineId: line.id, kind: 'cartouche', memberIds: span }
  p.groups.push(group)
  return group
}

export function removeGroup(p: Project, groupId: string) {
  const g = p.groups.find((x) => x.id === groupId)
  if (!g) return
  if (g.kind === 'quadrat') ungroup(p, groupId)
  else p.groups = p.groups.filter((x) => x.id !== groupId)
}

export function cartoucheOf(p: Project, itemId: string): Group | undefined {
  return p.groups.find((g) => g.kind === 'cartouche' && g.memberIds.includes(itemId))
}

/**
 * Déplace une boîte dans l'ordre de lecture (delta = -1 : plus tôt, +1 : plus tard).
 * Un carré se déplace d'un bloc. L'ordre de la ligne devient « manuel ».
 */
export function moveInOrder(p: Project, itemId: string, delta: -1 | 1): boolean {
  const f = findItem(p, itemId)
  if (!f) return false
  const { line, item } = f
  // Blocs : un carré = un bloc, sinon un signe = un bloc.
  const blocks: string[][] = []
  for (const it of line.items) {
    const last = blocks.at(-1)
    const lastGroup = last && line.items.find((i) => i.id === last[0])?.groupId
    if (it.groupId && last && lastGroup === it.groupId) last.push(it.id)
    else blocks.push([it.id])
  }
  // Dans un carré, on déplace le signe à l'intérieur du carré.
  const bi = blocks.findIndex((b) => b.includes(itemId))
  const block = blocks[bi]
  if (item.groupId && block.length > 1) {
    const k = block.indexOf(itemId)
    const j = k + delta
    if (j < 0 || j >= block.length) return false
    ;[block[k], block[j]] = [block[j], block[k]]
  } else {
    const j = bi + delta
    if (j < 0 || j >= blocks.length) return false
    ;[blocks[bi], blocks[j]] = [blocks[j], blocks[bi]]
  }
  const byId = new Map(line.items.map((i) => [i.id, i]))
  line.items = blocks.flat().map((id) => byId.get(id)!)
  line.manualOrder = true
  return true
}

/** Toutes les boîtes de la stèle, dans l'ordre : ligne 1, ligne 2… */
export function allItemsInOrder(p: Project): { line: Line; item: Item; index: number }[] {
  return sortByNumber(p.lines).flatMap((line) => line.items.map((item, index) => ({ line, item, index })))
}

/** Boîte suivante (ou précédente) dans l'ordre de lecture de toute la stèle. */
export function neighbourItem(p: Project, itemId: string, delta: -1 | 1): Item | null {
  const all = allItemsInOrder(p)
  const i = all.findIndex((x) => x.item.id === itemId)
  return all[i + delta]?.item ?? null
}

/** Première boîte sans signe attribué à partir d'une position (pour enchaîner la saisie). */
export function nextUnassigned(p: Project, afterItemId: string | null): Item | null {
  const all = allItemsInOrder(p)
  const start = afterItemId ? all.findIndex((x) => x.item.id === afterItemId) + 1 : 0
  return all.slice(start).find((x) => !x.item.signCode && x.item.status !== 'lacune')?.item ?? null
}

export function setStatus(p: Project, ids: string[], status: SignStatus) {
  for (const id of ids) {
    const f = findItem(p, id)
    if (f) f.item.status = status
  }
}
