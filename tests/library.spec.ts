import { describe, expect, it } from 'vitest'
import { compareCodes, normalizeCode, unicodeFor, allUnicodeCodes, categoryOf } from '../src/core/gardiner'
import { foldTranslit, mdcToUnicode, parseTranslitInput, unicodeToMdc } from '../src/core/translit'
import { searchSigns } from '../src/core/search'
import seed from '../src/data/signs.seed.json'
import type { Sign } from '../src/types/models'

const signs = seed.signs as Sign[]
const codes = (q: string, n = 5, f = {}) => searchSigns(signs, q, f).slice(0, n).map((r) => r.sign.gardiner)

describe('codes Gardiner', () => {
  it('normalise la saisie', () => {
    expect(normalizeCode('g17')).toBe('G17')
    expect(normalizeCode('G017')).toBe('G17')
    expect(normalizeCode('aa1')).toBe('Aa1')
    expect(normalizeCode('n35a')).toBe('N35A')
    expect(normalizeCode('J1')).toBeNull() // pas de catégorie J
    expect(normalizeCode('chouette')).toBeNull()
  })
  it('trie dans l’ordre naturel', () => {
    expect(['G10', 'Aa1', 'G2', 'A1', 'G7A', 'G7'].sort(compareCodes)).toEqual(['A1', 'G2', 'G7', 'G7A', 'G10', 'Aa1'])
  })
  it('connaît les caractères Unicode', () => {
    expect(unicodeFor('G17')).toBe('\u{13153}')
    expect(unicodeFor('Aa1')).toBe('\u{1340D}')
    expect(unicodeFor('XYZ')).toBe('')
    expect(allUnicodeCodes().length).toBe(1024)
  })
})

describe('translittération', () => {
  it('convertit le MdC', () => {
    expect(mdcToUnicode('anx')).toBe('ꜥnḫ')
    expect(mdcToUnicode('Htp')).toBe('ḥtp')
    expect(mdcToUnicode('nTr')).toBe('nṯr')
    expect(mdcToUnicode('zA')).toBe('zꜣ')
    expect(unicodeToMdc('ḏd')).toBe('Dd')
  })
  it('garde une saisie déjà égyptologique et corrige les variantes', () => {
    expect(parseTranslitInput('ꜥnḫ')).toBe('ꜥnḫ')
    expect(parseTranslitInput('ʿnḫ')).toBe('ꜥnḫ')
    expect(parseTranslitInput('ȝḫ')).toBe('ꜣḫ')
  })
  it('forme tolérante', () => {
    expect(foldTranslit('ḥtp')).toBe('htp')
  })
})

describe('bibliothèque de départ', () => {
  it('contient environ 100 signes, tous « à vérifier »', () => {
    expect(signs.length).toBeGreaterThanOrEqual(100)
    expect(signs.every((s) => !s.verified)).toBe(true)
  })
  it('a des codes uniques, valides, avec le bon caractère Unicode', () => {
    const set = new Set(signs.map((s) => s.gardiner))
    expect(set.size).toBe(signs.length)
    for (const s of signs) {
      expect(normalizeCode(s.gardiner)).toBe(s.gardiner)
      expect(s.unicode).toBe(unicodeFor(s.gardiner))
      expect(s.category).toBe(categoryOf(s.gardiner))
      expect(s.kind.length).toBeGreaterThan(0)
    }
  })
  it('contient les 24 sons de l’« alphabet »', () => {
    const uni = new Set(signs.filter((s) => s.kind.includes('uniliteral')).flatMap((s) => s.translit))
    for (const t of ['ꜣ', 'j', 'y', 'ꜥ', 'w', 'b', 'p', 'f', 'm', 'n', 'r', 'h', 'ḥ', 'ḫ', 'ẖ', 'z', 's', 'š', 'q', 'k', 'g', 't', 'ṯ', 'd', 'ḏ'])
      expect(uni.has(t), t).toBe(true)
  })
})

describe('recherche', () => {
  it('par code exact', () => expect(codes('g17')[0]).toBe('G17'))
  it('par début de code', () => expect(codes('G1', 3)).toEqual(['G1', 'G14', 'G17']))
  it('une lettre seule de catégorie ne mélange pas A et Aa', () => {
    expect(codes('A', 50).some((c) => c.startsWith('Aa'))).toBe(false)
  })
  it('par valeur phonétique', () => {
    expect(codes('m')[0]).toBe('G17')
    expect(codes('nfr')[0]).toBe('F35')
    expect(codes('anx')[0]).toBe('S34') // MdC
    expect(codes('ꜥnḫ')[0]).toBe('S34') // égyptologique
    expect(codes('Htp')[0]).toBe('R4')
  })
  it('propose d’abord le signe le plus courant pour chaque son', () => {
    expect(codes('n')[0]).toBe('N35')
    expect(codes('w')[0]).toBe('G43')
    expect(codes('y')[0]).toBe('M17A')
    expect(codes('t')[0]).toBe('X1')
  })
  it('distingue h et ḥ en MdC mais propose les deux', () => {
    const r = codes('h', 3)
    expect(r[0]).toBe('O4') // h exact
    expect(r).toContain('V28') // ḥ en second (forme tolérante)
  })
  it('par description, sans accents', () => {
    expect(codes('chouette')[0]).toBe('G17')
    expect(codes('baton', 10)).toContain('T14')
  })
  it('avec filtres', () => {
    const r = searchSigns(signs, '', { category: 'G', kind: 'biliteral' })
    expect(r.length).toBeGreaterThan(3)
    expect(r.every((x) => x.sign.category === 'G' && x.sign.kind.includes('biliteral'))).toBe(true)
  })
  it('requête vide : tout, dans l’ordre de Gardiner', () => {
    const r = searchSigns(signs, '')
    expect(r.length).toBe(signs.length)
    expect(r[0].sign.gardiner).toBe('A1')
  })
})

describe('sanitizeSign (ajout manuel)', async () => {
  const { sanitizeSign } = await import('../src/stores/library')
  it('normalise le code, complète Unicode et la catégorie, convertit le MdC', () => {
    const s = sanitizeSign({ gardiner: 'g18', translit: ['mm', ' ', 'mm'], kind: ['biliteral'], descriptionFr: ' deux chouettes ' })
    expect(s).toMatchObject({ gardiner: 'G18', unicode: '\u{13154}', category: 'G', translit: ['mm'], descriptionFr: 'deux chouettes' })
  })
  it('refuse un code invalide ou sans type', () => {
    expect(() => sanitizeSign({ gardiner: 'xx', kind: ['ideogram'] })).toThrow()
    expect(() => sanitizeSign({ gardiner: 'G18', kind: [] })).toThrow()
  })
})
