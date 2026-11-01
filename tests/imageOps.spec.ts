import { describe, expect, it } from 'vitest'
import { autoContrast, boxBlurLuma, cssFilterString, enhanceRelief } from '../src/core/imageOps'
import { DEFAULT_FILTERS } from '../src/types/models'

function gray(values: number[], width: number) {
  const data = new Uint8ClampedArray(values.length * 4)
  values.forEach((v, i) => data.set([v, v, v, 255], i * 4))
  return { data, width, height: values.length / width }
}

describe('autoContrast', () => {
  it("étire l'histogramme de 100–150 vers 0–255", () => {
    const src = gray([100, 110, 120, 130, 140, 150], 6)
    const out = autoContrast(src, 0)
    expect(out.data[0]).toBe(0)
    expect(out.data[5 * 4]).toBe(255)
  })
  it("ne modifie pas l'image d'origine", () => {
    const src = gray([100, 150], 2)
    autoContrast(src, 0)
    expect(src.data[0]).toBe(100)
  })
  it('laisse une image unie intacte', () => {
    const out = autoContrast(gray([80, 80, 80, 80], 2), 0)
    expect(out.data[0]).toBe(80)
  })
})

describe('boxBlurLuma', () => {
  it('garde une image unie inchangée', () => {
    const l = new Float32Array(25).fill(42)
    const b = boxBlurLuma(l, 5, 5, 2)
    expect(Array.from(b).every((v) => Math.abs(v - 42) < 1e-4)).toBe(true)
  })
})

describe('enhanceRelief', () => {
  it("n'agit pas avec une intensité nulle", () => {
    const src = gray([10, 200, 10, 200], 2)
    const out = enhanceRelief(src, 0, 'unsharp')
    expect(Array.from(out.data)).toEqual(Array.from(src.data))
  })
  it("accentue l'écart entre un point clair et son voisinage", () => {
    const values = new Array(81).fill(100)
    values[40] = 150
    const out = enhanceRelief(gray(values, 9), 2, 'unsharp')
    expect(out.data[40 * 4]).toBeGreaterThan(150)
  })
  it('produit une image grise en lumière rasante', () => {
    const out = enhanceRelief(gray(new Array(16).fill(90), 4), 1, 'emboss')
    expect(out.data[0]).toBe(128)
  })
})

describe('cssFilterString', () => {
  it('renvoie none pour les réglages par défaut', () => expect(cssFilterString(DEFAULT_FILTERS)).toBe('none'))
  it('combine les réglages', () => {
    expect(cssFilterString({ ...DEFAULT_FILTERS, grayscale: true, invert: true, contrast: 150 })).toBe(
      'grayscale(1) contrast(150%) invert(1)',
    )
  })
})
