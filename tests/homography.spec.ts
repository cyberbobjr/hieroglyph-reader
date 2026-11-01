import { describe, expect, it } from 'vitest'
import {
  applyHomography,
  computeHomography,
  isConvexQuad,
  rectCorners,
  rectifiedSize,
  warpPerspective,
} from '../src/core/homography'
import type { Quad } from '../src/types/models'

const skewed: Quad = [
  { x: 30, y: 20 },
  { x: 410, y: 60 },
  { x: 380, y: 300 },
  { x: 10, y: 250 },
]

describe('computeHomography', () => {
  it('envoie chaque coin source sur le coin destination', () => {
    const dst = rectCorners(400, 300)
    const H = computeHomography(skewed, dst)
    skewed.forEach((p, i) => {
      const q = applyHomography(H, p)
      expect(q.x).toBeCloseTo(dst[i].x, 6)
      expect(q.y).toBeCloseTo(dst[i].y, 6)
    })
  })

  it("donne l'identité quand source = destination", () => {
    const r = rectCorners(100, 50)
    const H = computeHomography(r, r)
    const q = applyHomography(H, { x: 37, y: 12 })
    expect(q.x).toBeCloseTo(37, 9)
    expect(q.y).toBeCloseTo(12, 9)
  })

  it('refuse des points alignés', () => {
    const line: Quad = [
      { x: 0, y: 0 },
      { x: 1, y: 1 },
      { x: 2, y: 2 },
      { x: 3, y: 3 },
    ]
    expect(() => computeHomography(line, rectCorners(10, 10))).toThrow()
  })
})

describe('isConvexQuad', () => {
  it('accepte un quadrilatère normal', () => expect(isConvexQuad(skewed)).toBe(true))
  it('refuse un quadrilatère croisé (« nœud papillon »)', () => {
    const bowtie: Quad = [skewed[0], skewed[2], skewed[1], skewed[3]]
    expect(isConvexQuad(bowtie)).toBe(false)
  })
})

describe('rectifiedSize', () => {
  it('prend les côtés les plus longs', () => {
    expect(rectifiedSize(rectCorners(200, 100))).toEqual({ width: 200, height: 100 })
  })
  it('réduit les très grandes images en gardant les proportions', () => {
    const s = rectifiedSize(rectCorners(8000, 4000), 1_000_000)
    expect(s.width * s.height).toBeLessThanOrEqual(1_000_000 + 8000)
    expect(s.width / s.height).toBeCloseTo(2, 2)
  })
})

describe('warpPerspective', () => {
  it("recopie l'image telle quelle avec les coins de l'image entière", () => {
    const w = 4
    const h = 3
    const data = new Uint8ClampedArray(w * h * 4)
    for (let i = 0; i < w * h; i++) data.set([i * 10, 255 - i * 10, i, 255], i * 4)
    const out = warpPerspective({ data, width: w, height: h }, rectCorners(w, h), w, h)
    expect(Array.from(out.data)).toEqual(Array.from(data))
  })

  it('extrait un sous-rectangle', () => {
    const w = 10
    const h = 10
    const data = new Uint8ClampedArray(w * h * 4)
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) data.set([x * 20, y * 20, 0, 255], (y * w + x) * 4)
    const corners: Quad = [
      { x: 2, y: 3 },
      { x: 6, y: 3 },
      { x: 6, y: 7 },
      { x: 2, y: 7 },
    ]
    const out = warpPerspective({ data, width: w, height: h }, corners, 4, 4)
    // Pixel (0,0) de la sortie = pixel (2,3) de la source.
    expect(out.data[0]).toBe(40)
    expect(out.data[1]).toBe(60)
  })
})
