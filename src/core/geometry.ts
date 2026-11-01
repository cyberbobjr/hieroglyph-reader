/**
 * Petits outils de géométrie, sans rapport avec l'interface (donc testables).
 * Toutes les coordonnées sont en pixels de l'image de travail.
 */
import type { LineGeometry, Point, Rect } from '../types/models'

/** Rectangle défini par deux coins opposés quelconques (dans n'importe quel ordre). */
export function rectFromPoints(a: Point, b: Point): Rect {
  return {
    x: Math.min(a.x, b.x),
    y: Math.min(a.y, b.y),
    w: Math.abs(a.x - b.x),
    h: Math.abs(a.y - b.y),
  }
}

/** Les 4 coins d'un rectangle : HG, HD, BD, BG. */
export function rectCornersOf(r: Rect): Point[] {
  return [
    { x: r.x, y: r.y },
    { x: r.x + r.w, y: r.y },
    { x: r.x + r.w, y: r.y + r.h },
    { x: r.x, y: r.y + r.h },
  ]
}

export function pointInRect(p: Point, r: Rect): boolean {
  return p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h
}

/**
 * Le point est-il dans le polygone ? Méthode du « rayon » : on trace une
 * demi-droite horizontale depuis le point et on compte combien de côtés elle
 * traverse. Nombre impair = dedans.
 */
export function pointInPolygon(p: Point, poly: Point[]): boolean {
  let inside = false
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i]
    const b = poly[j]
    if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) inside = !inside
  }
  return inside
}

/** Aire d'un polygone (formule du lacet), toujours positive. */
export function polygonArea(poly: Point[]): number {
  let s = 0
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) s += (poly[j].x + poly[i].x) * (poly[j].y - poly[i].y)
  return Math.abs(s) / 2
}

export function boundsOfPoints(pts: Point[]): Rect {
  const xs = pts.map((p) => p.x)
  const ys = pts.map((p) => p.y)
  const x = Math.min(...xs)
  const y = Math.min(...ys)
  return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y }
}

/** Points du contour d'une ligne (4 coins pour un rectangle). */
export function geometryPoints(g: LineGeometry): Point[] {
  return g.type === 'rect' ? rectCornersOf(g.rect) : g.points
}

export function geometryBounds(g: LineGeometry): Rect {
  return g.type === 'rect' ? { ...g.rect } : boundsOfPoints(g.points)
}

export function geometryArea(g: LineGeometry): number {
  return g.type === 'rect' ? g.rect.w * g.rect.h : polygonArea(g.points)
}

export function pointInGeometry(p: Point, g: LineGeometry): boolean {
  return g.type === 'rect' ? pointInRect(p, g.rect) : pointInPolygon(p, g.points)
}

export function translateGeometry(g: LineGeometry, dx: number, dy: number): LineGeometry {
  if (g.type === 'rect') return { type: 'rect', rect: { ...g.rect, x: g.rect.x + dx, y: g.rect.y + dy } }
  return { type: 'polygon', points: g.points.map((p) => ({ x: p.x + dx, y: p.y + dy })) }
}

/**
 * Déplace un sommet. Pour un rectangle, le coin opposé reste fixe : on peut
 * donc « retourner » le rectangle sans problème.
 */
export function moveVertex(g: LineGeometry, index: number, p: Point): LineGeometry {
  if (g.type === 'rect') {
    const corners = rectCornersOf(g.rect)
    const opposite = corners[(index + 2) % 4]
    return { type: 'rect', rect: rectFromPoints(opposite, p) }
  }
  const points = g.points.map((q, i) => (i === index ? { ...p } : { ...q }))
  return { type: 'polygon', points }
}

/** Retire un sommet d'un polygone (il en faut au moins 3). */
export function removeVertex(g: LineGeometry, index: number): LineGeometry {
  if (g.type === 'rect' || g.points.length <= 3) return g
  return { type: 'polygon', points: g.points.filter((_, i) => i !== index) }
}

/** Ajoute un sommet au milieu du côté qui part du sommet `index`. */
export function insertVertexAfter(g: LineGeometry, index: number): LineGeometry {
  const pts = geometryPoints(g).map((p) => ({ ...p }))
  const a = pts[index]
  const b = pts[(index + 1) % pts.length]
  pts.splice(index + 1, 0, { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 })
  return { type: 'polygon', points: pts }
}

/** Arrondit au dixième de pixel : fichiers plus courts, aucune perte visible. */
export function roundGeometry(g: LineGeometry): LineGeometry {
  const r = (v: number) => Math.round(v * 10) / 10
  if (g.type === 'rect') return { type: 'rect', rect: { x: r(g.rect.x), y: r(g.rect.y), w: r(g.rect.w), h: r(g.rect.h) } }
  return { type: 'polygon', points: g.points.map((p) => ({ x: r(p.x), y: r(p.y) })) }
}
