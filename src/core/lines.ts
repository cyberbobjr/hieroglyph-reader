/**
 * Règles de gestion des lignes de texte (création, numérotation, ordre).
 * Fonctions « pures » : elles reçoivent des données et en renvoient de
 * nouvelles, sans toucher à l'interface. Elles sont testées dans tests/lines.spec.ts.
 */
import type { Direction, Line, LineGeometry, Orientation, Point } from '../types/models'
import { geometryArea, geometryBounds, pointInGeometry, roundGeometry } from './geometry'
import { newId } from './ids'

/**
 * Devine si c'est une ligne ou une colonne d'après la forme tracée :
 * nettement plus haute que large → colonne.
 */
export function guessOrientation(g: LineGeometry): Orientation {
  const b = geometryBounds(g)
  return b.h > b.w * 1.3 ? 'column' : 'row'
}

export function nextLineNumber(lines: Line[]): number {
  return lines.reduce((m, l) => Math.max(m, l.number), 0) + 1
}

export function createLine(
  lines: Line[],
  geometry: LineGeometry,
  defaults: { direction: Direction; orientation?: Orientation },
): Line {
  return {
    id: newId('l_'),
    number: nextLineNumber(lines),
    direction: defaults.direction,
    orientation: defaults.orientation ?? guessOrientation(geometry),
    geometry: roundGeometry(geometry),
    items: [],
    manualOrder: false,
  }
}

export function sortByNumber(lines: Line[]): Line[] {
  return [...lines].sort((a, b) => a.number - b.number)
}

/** Renumérote 1, 2, 3… en gardant l'ordre actuel. */
export function renumber(lines: Line[]): void {
  sortByNumber(lines).forEach((l, i) => (l.number = i + 1))
}

/**
 * Renumérote d'après la position sur la stèle :
 *  - lignes horizontales : de haut en bas ;
 *  - colonnes : dans le sens de lecture (de droite à gauche si rtl).
 * Si la stèle mélange lignes et colonnes, les lignes (souvent le cintre
 * ou l'en-tête) passent d'abord.
 */
export function renumberByPosition(lines: Line[]): void {
  const center = (l: Line) => {
    const b = geometryBounds(l.geometry)
    return { x: b.x + b.w / 2, y: b.y + b.h / 2 }
  }
  const sorted = [...lines].sort((a, b) => {
    if (a.orientation !== b.orientation) return a.orientation === 'row' ? -1 : 1
    const ca = center(a)
    const cb = center(b)
    if (a.orientation === 'row') return ca.y - cb.y || ca.x - cb.x
    // colonnes : on suit le sens de lecture de la première colonne
    return a.direction === 'rtl' ? cb.x - ca.x || ca.y - cb.y : ca.x - cb.x || ca.y - cb.y
  })
  sorted.forEach((l, i) => (l.number = i + 1))
}

/** Échange le numéro d'une ligne avec sa voisine (delta = -1 : monter, +1 : descendre). */
export function moveLine(lines: Line[], id: string, delta: -1 | 1): boolean {
  const sorted = sortByNumber(lines)
  const i = sorted.findIndex((l) => l.id === id)
  const j = i + delta
  if (i < 0 || j < 0 || j >= sorted.length) return false
  const n = sorted[i].number
  sorted[i].number = sorted[j].number
  sorted[j].number = n
  return true
}

/** Donne un numéro précis à une ligne ; si une autre l'avait, elles échangent. */
export function setLineNumber(lines: Line[], id: string, number: number): void {
  const line = lines.find((l) => l.id === id)
  if (!line || !Number.isInteger(number) || number < 1) return
  const other = lines.find((l) => l.number === number && l.id !== id)
  if (other) other.number = line.number
  line.number = number
}

/**
 * Quelle ligne se trouve sous ce point ? En cas de chevauchement, la plus
 * petite gagne (c'est presque toujours celle qu'on vise).
 */
export function lineAtPoint(lines: Line[], p: Point): Line | undefined {
  return lines
    .filter((l) => pointInGeometry(p, l.geometry))
    .sort((a, b) => geometryArea(a.geometry) - geometryArea(b.geometry))[0]
}

/**
 * Flèche qui montre le sens de lecture, en coordonnées image :
 *  - ligne : traverse horizontalement, vers la gauche si rtl ;
 *  - colonne : de haut en bas (on lit toujours une colonne vers le bas).
 */
export function readingArrow(l: Line): { from: Point; to: Point } {
  const b = geometryBounds(l.geometry)
  const cx = b.x + b.w / 2
  const cy = b.y + b.h / 2
  if (l.orientation === 'column') {
    return { from: { x: cx, y: b.y + b.h * 0.15 }, to: { x: cx, y: b.y + b.h * 0.85 } }
  }
  const left = { x: b.x + b.w * 0.15, y: cy }
  const right = { x: b.x + b.w * 0.85, y: cy }
  return l.direction === 'rtl' ? { from: right, to: left } : { from: left, to: right }
}

export function directionLabel(l: Pick<Line, 'direction' | 'orientation'>): string {
  const dir = l.direction === 'rtl' ? 'droite → gauche' : 'gauche → droite'
  return l.orientation === 'column' ? `colonne ↓, ordre ${dir}` : `ligne, ${dir}`
}
