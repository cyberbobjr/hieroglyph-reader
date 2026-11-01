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
 * Taille « naturelle » du rectangle redressé : on prend le plus long des
 * deux côtés opposés, puis on réduit si l'image dépasse maxPixels
 * (les tablettes limitent la taille des images en mémoire).
 */
export function rectifiedSize(q: Quad, maxPixels = 12_000_000): { width: number; height: number } {
  let width = Math.max(dist(q[0], q[1]), dist(q[3], q[2]))
  let height = Math.max(dist(q[0], q[3]), dist(q[1], q[2]))
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
