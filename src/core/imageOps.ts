/**
 * Traitements d'image « lourds », calculés pixel par pixel dans un Web Worker.
 * Les réglages simples (gris, inversion, luminosité, contraste) sont faits
 * par le navigateur via un filtre CSS, ce qui est instantané.
 *
 * Toutes les fonctions renvoient une NOUVELLE image : l'originale n'est
 * jamais modifiée.
 */
import type { PixelBuffer } from './homography'
import type { ReliefMode } from '../types/models'

const luminance = (r: number, g: number, b: number) => 0.299 * r + 0.587 * g + 0.114 * b

/**
 * Contraste automatique : on cherche les valeurs les plus sombres et les plus
 * claires (en ignorant 0,5 % d'extrêmes, souvent du bruit) et on étire
 * l'histogramme pour qu'elles deviennent noir pur et blanc pur.
 */
export function autoContrast(src: PixelBuffer, clip = 0.005): PixelBuffer {
  const { data, width, height } = src
  const hist = new Uint32Array(256)
  let count = 0
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] === 0) continue
    hist[Math.round(luminance(data[i], data[i + 1], data[i + 2]))]++
    count++
  }
  const limit = count * clip
  let lo = 0
  let hi = 255
  for (let acc = 0; lo < 255; lo++) {
    acc += hist[lo]
    if (acc > limit) break
  }
  for (let acc = 0; hi > 0; hi--) {
    acc += hist[hi]
    if (acc > limit) break
  }
  const out = new Uint8ClampedArray(data.length)
  if (hi <= lo) {
    out.set(data)
    return { data: out, width, height }
  }
  const scale = 255 / (hi - lo)
  for (let i = 0; i < data.length; i += 4) {
    out[i] = (data[i] - lo) * scale
    out[i + 1] = (data[i + 1] - lo) * scale
    out[i + 2] = (data[i + 2] - lo) * scale
    out[i + 3] = data[i + 3]
  }
  return { data: out, width, height }
}

/**
 * Flou « boîte » rapide sur la luminance (un canal), en deux passes
 * horizontale puis verticale grâce aux sommes cumulées.
 */
export function boxBlurLuma(luma: Float32Array, width: number, height: number, radius: number): Float32Array {
  const tmp = new Float32Array(luma.length)
  const out = new Float32Array(luma.length)
  const r = Math.max(1, Math.round(radius))
  for (let y = 0; y < height; y++) {
    const row = y * width
    let acc = 0
    for (let x = -r; x <= r; x++) acc += luma[row + Math.min(width - 1, Math.max(0, x))]
    for (let x = 0; x < width; x++) {
      tmp[row + x] = acc / (2 * r + 1)
      const add = Math.min(width - 1, x + r + 1)
      const sub = Math.max(0, x - r)
      acc += luma[row + add] - luma[row + sub]
    }
  }
  for (let x = 0; x < width; x++) {
    let acc = 0
    for (let y = -r; y <= r; y++) acc += tmp[Math.min(height - 1, Math.max(0, y)) * width + x]
    for (let y = 0; y < height; y++) {
      out[y * width + x] = acc / (2 * r + 1)
      const add = Math.min(height - 1, y + r + 1)
      const sub = Math.max(0, y - r)
      acc += tmp[add * width + x] - tmp[sub * width + x]
    }
  }
  return out
}

function lumaOf(src: PixelBuffer): Float32Array {
  const { data } = src
  const l = new Float32Array(src.width * src.height)
  for (let i = 0, p = 0; i < data.length; i += 4, p++) l[p] = luminance(data[i], data[i + 1], data[i + 2])
  return l
}

/**
 * Accentuation du relief.
 *  - « unsharp » (masque flou) : on renforce les différences entre chaque
 *    pixel et son voisinage ; les creux gravés ressortent, les couleurs restent.
 *  - « emboss » (lumière rasante) : on simule un éclairage venant du haut à
 *    gauche ; l'image devient grise et le relief apparaît en ombres portées.
 */
export function enhanceRelief(src: PixelBuffer, amount: number, mode: ReliefMode): PixelBuffer {
  const { data, width, height } = src
  const out = new Uint8ClampedArray(data.length)
  if (amount <= 0) {
    out.set(data)
    return { data: out, width, height }
  }
  const luma = lumaOf(src)
  if (mode === 'unsharp') {
    // Rayon proportionnel à la taille de l'image : environ 0,4 % de sa largeur.
    const radius = Math.max(2, Math.round(Math.max(width, height) * 0.004))
    const blur = boxBlurLuma(luma, width, height, radius)
    for (let i = 0, p = 0; i < data.length; i += 4, p++) {
      const delta = (luma[p] - blur[p]) * amount
      out[i] = data[i] + delta
      out[i + 1] = data[i + 1] + delta
      out[i + 2] = data[i + 2] + delta
      out[i + 3] = data[i + 3]
    }
  } else {
    const smooth = boxBlurLuma(luma, width, height, 1)
    const d = Math.max(1, Math.round(Math.max(width, height) * 0.0015))
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const p = y * width + x
        const a = smooth[Math.max(0, y - d) * width + Math.max(0, x - d)]
        const b = smooth[Math.min(height - 1, y + d) * width + Math.min(width - 1, x + d)]
        const v = 128 + (b - a) * amount * 1.5
        const i = p * 4
        out[i] = v
        out[i + 1] = v
        out[i + 2] = v
        out[i + 3] = data[i + 3]
      }
    }
  }
  return { data: out, width, height }
}

/** Filtre CSS équivalent aux réglages « légers ». */
export function cssFilterString(f: {
  grayscale: boolean
  invert: boolean
  brightness: number
  contrast: number
}): string {
  const parts: string[] = []
  if (f.grayscale) parts.push('grayscale(1)')
  if (f.brightness !== 100) parts.push(`brightness(${f.brightness}%)`)
  if (f.contrast !== 100) parts.push(`contrast(${f.contrast}%)`)
  if (f.invert) parts.push('invert(1)')
  return parts.length ? parts.join(' ') : 'none'
}
