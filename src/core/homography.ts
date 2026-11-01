/**
 * Correction de perspective (homographie).
 *
 * Une homographie est une formule qui transforme un quadrilatère quelconque
 * (la stèle photographiée de biais) en un autre quadrilatère (un rectangle
 * bien droit). Elle s'écrit avec 8 nombres h0…h7 :
 *
 *        h0·x + h1·y + h2              h3·x + h4·y + h5
 *   X = ------------------      Y = ------------------
 *        h6·x + h7·y + 1               h6·x + h7·y + 1
 *
 * Les 4 paires de points (coin photo ↔ coin du rectangle) donnent
 * 8 équations : on les résout comme un système linéaire classique.
 */
import type { Point, Quad } from '../types/models'

/** Matrice 3×3 rangée ligne par ligne (9 nombres, le dernier vaut 1). */
export type Matrix3 = [number, number, number, number, number, number, number, number, number]

/** Résout A·x = b par élimination de Gauss avec pivot partiel. */
function solveLinear(A: number[][], b: number[]): number[] {
  const n = b.length
  const M = A.map((row, i) => [...row, b[i]])
  for (let col = 0; col < n; col++) {
    let pivot = col
    for (let r = col + 1; r < n; r++) {
      if (Math.abs(M[r][col]) > Math.abs(M[pivot][col])) pivot = r
    }
    if (Math.abs(M[pivot][col]) < 1e-12) {
      throw new Error('Points alignés : impossible de calculer la perspective.')
    }
    ;[M[col], M[pivot]] = [M[pivot], M[col]]
    for (let r = 0; r < n; r++) {
      if (r === col) continue
      const f = M[r][col] / M[col][col]
      for (let c = col; c <= n; c++) M[r][c] -= f * M[col][c]
    }
  }
  return M.map((row, i) => row[n] / row[i])
}

/** Homographie qui envoie src[i] sur dst[i] (4 points chacun). */
export function computeHomography(src: Quad | Point[], dst: Quad | Point[]): Matrix3 {
  const A: number[][] = []
  const b: number[] = []
  for (let i = 0; i < 4; i++) {
    const { x, y } = src[i]
    const { x: X, y: Y } = dst[i]
    A.push([x, y, 1, 0, 0, 0, -x * X, -y * X])
    b.push(X)
    A.push([0, 0, 0, x, y, 1, -x * Y, -y * Y])
    b.push(Y)
  }
  const h = solveLinear(A, b)
  return [h[0], h[1], h[2], h[3], h[4], h[5], h[6], h[7], 1]
}

/** Applique une homographie à un point. */
export function applyHomography(H: Matrix3, p: Point): Point {
  const w = H[6] * p.x + H[7] * p.y + H[8]
  return {
    x: (H[0] * p.x + H[1] * p.y + H[2]) / w,
    y: (H[3] * p.x + H[4] * p.y + H[5]) / w,
  }
}

const dist = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y)

/**
 * Estime les VRAIES proportions (largeur ÷ hauteur) de la stèle à partir de
 * sa forme sur la photo.
 *
 * Pourquoi c'est nécessaire : avec une perspective prononcée, le côté le plus
 * éloigné de l'appareil paraît bien plus court qu'il ne l'est. Se fier à la
 * longueur des côtés donnerait une stèle redressée écrasée.
 *
 * Méthode (Zhang & He, 2006, « Whiteboard scanning ») : on suppose que le
 * centre optique est au centre de la photo, on retrouve la distance focale
 * de l'appareil à partir des 4 coins, puis on en déduit le rapport réel.
 * Quand la focale n'est pas mesurable (par ex. la stèle n'est inclinée que
 * sur un seul axe), on utilise la focale typique d'un appareil photo.
 *
 * @param q   coins HG, HD, BD, BG dans la photo
 * @param imageWidth, imageHeight  taille de la photo (pour trouver son centre)
 */
export function estimateAspectRatio(q: Quad, imageWidth: number, imageHeight: number): number {
  const u0 = imageWidth / 2
  const v0 = imageHeight / 2
  // Notation de l'article : m1 = HG, m2 = HD, m3 = BG, m4 = BD (coordonnées homogènes).
  const m1 = [q[0].x, q[0].y, 1]
  const m2 = [q[1].x, q[1].y, 1]
  const m3 = [q[3].x, q[3].y, 1]
  const m4 = [q[2].x, q[2].y, 1]
  const cross = (a: number[], b: number[]) => [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ]
  const dot = (a: number[], b: number[]) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
  const k2 = dot(cross(m1, m4), m3) / dot(cross(m2, m4), m3)
  const k3 = dot(cross(m1, m4), m2) / dot(cross(m3, m4), m2)
  const n2 = [k2 * m2[0] - m1[0], k2 * m2[1] - m1[1], k2 * m2[2] - m1[2]]
  const n3 = [k3 * m3[0] - m1[0], k3 * m3[1] - m1[1], k3 * m3[2] - m1[2]]

  // Repli : estimation « à plat », correcte quand la perspective est faible.
  const flat = Math.hypot(n2[0], n2[1]) / Math.hypot(n3[0], n3[1])

  const scaleRef = Math.max(imageWidth, imageHeight)
  // Focale « typique » : un objectif standard de téléphone (≈ 26 mm équivalent)
  // correspond à environ 0,6 × la diagonale de la photo en pixels.
  const typicalF2 = (0.6 * Math.hypot(imageWidth, imageHeight)) ** 2
  let f2 = typicalF2
  // Si les DEUX paires de côtés convergent, on peut mesurer la focale réelle.
  if (Math.abs(n2[2] * n3[2]) > 1e-12) {
    const measured =
      -((n2[0] - n2[2] * u0) * (n3[0] - n3[2] * u0) + (n2[1] - n2[2] * v0) * (n3[1] - n3[2] * v0)) /
      (n2[2] * n3[2])
    // On ne garde la mesure que si elle est vraisemblable (sinon calcul instable).
    if (measured > 0 && Math.sqrt(measured) > scaleRef * 0.2 && Math.sqrt(measured) < scaleRef * 20) {
      f2 = measured
    }
  }
  const norm = (n: number[]) => ((n[0] - n[2] * u0) ** 2 + (n[1] - n[2] * v0) ** 2) / f2 + n[2] ** 2
  return finiteOr(Math.sqrt(norm(n2) / norm(n3)), finiteOr(flat, 1))
}

function finiteOr(v: number, fallback: number): number {
  return Number.isFinite(v) && v > 0 ? v : fallback
}

/**
 * Taille en pixels du rectangle redressé.
 * On respecte les proportions demandées (aspect = largeur ÷ hauteur) tout en
 * gardant au moins la résolution du plus grand côté visible sur la photo,
 * puis on réduit si l'image dépasse maxPixels (limite mémoire des tablettes).
 */
export function rectifiedSize(
  q: Quad,
  aspect?: number,
  maxPixels = 12_000_000,
): { width: number; height: number } {
  const sideW = Math.max(dist(q[0], q[1]), dist(q[3], q[2]))
  const sideH = Math.max(dist(q[0], q[3]), dist(q[1], q[2]))
  let width: number
  let height: number
  if (aspect && aspect > 0) {
    width = Math.max(sideW, sideH * aspect)
    height = width / aspect
  } else {
    width = sideW
    height = sideH
  }
  const scale = Math.min(1, Math.sqrt(maxPixels / Math.max(1, width * height)))
  width = Math.max(1, Math.round(width * scale))
  height = Math.max(1, Math.round(height * scale))
  return { width, height }
}

/** Les 4 coins d'un rectangle w×h, dans l'ordre HG, HD, BD, BG. */
export function rectCorners(width: number, height: number): Quad {
  return [
    { x: 0, y: 0 },
    { x: width, y: 0 },
    { x: width, y: height },
    { x: 0, y: height },
  ]
}

/**
 * Vérifie que le quadrilatère est convexe et non croisé
 * (sinon le redressement n'a pas de sens).
 */
export function isConvexQuad(q: Quad): boolean {
  let sign = 0
  for (let i = 0; i < 4; i++) {
    const a = q[i]
    const b = q[(i + 1) % 4]
    const c = q[(i + 2) % 4]
    const cross = (b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x)
    if (Math.abs(cross) < 1e-9) return false
    const s = Math.sign(cross)
    if (sign === 0) sign = s
    else if (s !== sign) return false
  }
  return true
}

export interface PixelBuffer {
  data: Uint8ClampedArray
  width: number
  height: number
}

/**
 * Redresse l'image : pour chaque pixel du rectangle de sortie, on cherche
 * (homographie inverse) d'où il vient dans la photo, puis on mélange les
 * 4 pixels voisins (interpolation « bilinéaire ») pour un rendu lisse.
 */
export function warpPerspective(
  src: PixelBuffer,
  corners: Quad,
  outWidth: number,
  outHeight: number,
): PixelBuffer {
  // On calcule directement la transformation sortie → source.
  const H = computeHomography(rectCorners(outWidth, outHeight), corners)
  const out = new Uint8ClampedArray(outWidth * outHeight * 4)
  const sw = src.width
  const sh = src.height
  const s = src.data
  for (let y = 0; y < outHeight; y++) {
    const py = y + 0.5
    for (let x = 0; x < outWidth; x++) {
      const px = x + 0.5
      const w = H[6] * px + H[7] * py + H[8]
      const sx = (H[0] * px + H[1] * py + H[2]) / w - 0.5
      const sy = (H[3] * px + H[4] * py + H[5]) / w - 0.5
      const o = (y * outWidth + x) * 4
      if (sx < -0.5 || sy < -0.5 || sx > sw - 0.5 || sy > sh - 0.5) {
        out[o + 3] = 0 // hors de la photo : transparent
        continue
      }
      const x0 = Math.max(0, Math.min(sw - 1, Math.floor(sx)))
      const y0 = Math.max(0, Math.min(sh - 1, Math.floor(sy)))
      const x1 = Math.min(sw - 1, x0 + 1)
      const y1 = Math.min(sh - 1, y0 + 1)
      const fx = Math.max(0, Math.min(1, sx - x0))
      const fy = Math.max(0, Math.min(1, sy - y0))
      const i00 = (y0 * sw + x0) * 4
      const i10 = (y0 * sw + x1) * 4
      const i01 = (y1 * sw + x0) * 4
      const i11 = (y1 * sw + x1) * 4
      for (let c = 0; c < 4; c++) {
        const top = s[i00 + c] + (s[i10 + c] - s[i00 + c]) * fx
        const bottom = s[i01 + c] + (s[i11 + c] - s[i01 + c]) * fx
        out[o + c] = top + (bottom - top) * fy
      }
    }
  }
  return { data: out, width: outWidth, height: outHeight }
}
