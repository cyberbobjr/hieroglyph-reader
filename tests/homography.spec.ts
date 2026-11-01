import { describe, expect, it } from 'vitest'
import {
  applyHomography,
  computeHomography,
  estimateAspectRatio,
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
    const s = rectifiedSize(rectCorners(8000, 4000), undefined, 1_000_000)
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

/**
 * Simule un vrai appareil photo : on « photographie » un rectangle de
 * proportions connues, très incliné, puis on vérifie qu'on retrouve ces
 * proportions à partir des 4 coins seulement.
 */
function photograph(rw: number, rh: number, yawDeg: number, pitchDeg: number, f: number, W: number, H: number): Quad {
  const yaw = (yawDeg * Math.PI) / 180
  const pitch = (pitchDeg * Math.PI) / 180
  const pts = [
    [-rw / 2, -rh / 2],
    [rw / 2, -rh / 2],
    [rw / 2, rh / 2],
    [-rw / 2, rh / 2],
  ]
  return pts.map(([x, y]) => {
    // rotation autour de l'axe vertical puis horizontal, puis recul de la caméra
    let X = x * Math.cos(yaw)
    let Z = x * Math.sin(yaw)
    let Y = y * Math.cos(pitch) - Z * Math.sin(pitch)
    Z = y * Math.sin(pitch) + Z * Math.cos(pitch)
    Z += 3
    return { x: W / 2 + (f * X) / Z, y: H / 2 + (f * Y) / Z }
  }) as Quad
}

describe('estimateAspectRatio', () => {
  const W = 4000
  const H = 3000
  it('retrouve les proportions avec une perspective prononcée (55°)', () => {
    const q = photograph(1.5, 1, 55, 0, 3000, W, H) // focale typique ≈ 0,6 × 5000
    expect(estimateAspectRatio(q, W, H)).toBeCloseTo(1.5, 2)
    // la méthode simple se tromperait nettement :
    const naive = rectifiedSize(q)
    expect(Math.abs(naive.width / naive.height - 1.5)).toBeGreaterThan(0.3)
  })
  it('retrouve les proportions avec une inclinaison combinée', () => {
    const q = photograph(0.6, 1, 35, 40, 2500, W, H)
    expect(estimateAspectRatio(q, W, H)).toBeCloseTo(0.6, 2)
  })
  it('se replie proprement sans perspective', () => {
    expect(estimateAspectRatio(rectCorners(300, 200), W, H)).toBeCloseTo(1.5, 6)
  })
})

describe('rectifiedSize avec proportions', () => {
  it('respecte le rapport demandé', () => {
    const s = rectifiedSize(rectCorners(400, 400), 2)
    expect(s.width / s.height).toBeCloseTo(2, 2)
    expect(s.width).toBeGreaterThanOrEqual(400)
  })
})

describe('estimateAspectRatio — robustesse', () => {
  it('reste meilleure que la méthode simple si la focale réelle diffère de la focale typique', () => {
    // Photo au téléobjectif (focale double), inclinaison sur un seul axe :
    // cas difficile, d'où le réglage manuel des proportions dans l'interface.
    const q = photograph(1.5, 1, 50, 0, 6000, 4000, 3000)
    const r = estimateAspectRatio(q, 4000, 3000)
    const naive = rectifiedSize(q)
    expect(Math.abs(r - 1.5)).toBeLessThan(Math.abs(naive.width / naive.height - 1.5))
  })
  it('stèle verticale (plus haute que large) inclinée vers l’arrière', () => {
    const q = photograph(0.5, 1, 0, 50, 3000, 4000, 3000)
    expect(estimateAspectRatio(q, 4000, 3000)).toBeCloseTo(0.5, 2)
  })
})
