/**
 * Recherche dans la bibliothèque de signes.
 *
 * Une seule zone de saisie accepte :
 *  - un code Gardiner : « G17 », « g17 », « aa1 » (ou le début : « G » = toute la catégorie)
 *  - une valeur phonétique : « m », « nfr », « Htp » (MdC) ou « ḥtp »
 *  - un mot de la description : « chouette », « baton » (accents facultatifs)
 *
 * Chaque signe reçoit une note de pertinence ; les meilleurs viennent en tête.
 */
import type { Sign, SignKind } from '../types/models'
import { compareCodes, normalizeCode } from './gardiner'
import { foldText, foldTranslit, parseTranslitInput, stripSeparators } from './translit'

export interface SearchFilters {
  category?: string
  kind?: SignKind
  verified?: boolean
}

export interface SearchResult {
  sign: Sign
  score: number
  /** Pourquoi ce signe est proposé (affiché en petit). */
  reason: 'code' | 'translit' | 'description' | 'all'
}

/**
 * Pour chaque son de l'« alphabet », le signe le plus courant. Quand on tape
 * « n », N35 (filet d'eau) doit passer avant D35 ou S3, qui valent aussi n.
 */
const PREFERRED: Record<string, string> = {
  ꜣ: 'G1', j: 'M17', y: 'M17A', ꜥ: 'D36', w: 'G43', b: 'D58', p: 'Q3', f: 'I9', m: 'G17', n: 'N35',
  r: 'D21', h: 'O4', ḥ: 'V28', ḫ: 'Aa1', ẖ: 'F32', z: 'O34', s: 'S29', š: 'N37', q: 'N29', k: 'V31',
  g: 'W11', t: 'X1', ṯ: 'V13', d: 'D46', ḏ: 'I10',
}

const SCORE = {
  codeExact: 1000,
  translitExact: 900,
  translitLoose: 700,
  codePrefix: 500,
  translitPrefix: 300,
  descWordStart: 250,
  descSubstring: 120,
}

export function scoreSign(sign: Sign, query: string): SearchResult | null {
  const q = query.trim()
  if (!q) return { sign, score: 1, reason: 'all' }
  let best: SearchResult | null = null
  const take = (score: number, reason: SearchResult['reason']) => {
    if (!best || score > best.score) best = { sign, score, reason }
  }

  // 1. Code Gardiner
  const code = normalizeCode(q)
  if (code && code === sign.gardiner) take(SCORE.codeExact, 'code')
  if (/^(aa|[a-z])\d*$/i.test(q)) {
    const prefix = q.toLowerCase()
    const sc = sign.gardiner.toLowerCase()
    // « G1 » doit trouver G1, G14… mais « A » ne doit pas trouver Aa1.
    if (sc.startsWith(prefix) && !(prefix.length === 1 && sc.startsWith('aa') && prefix === 'a'))
      take(SCORE.codePrefix - sign.gardiner.length, 'code')
  }

  // 2. Valeur phonétique (translittération)
  const exact = stripSeparators(parseTranslitInput(q))
  const loose = foldTranslit(exact)
  for (const t of sign.translit) {
    if (stripSeparators(t) === exact) take(SCORE.translitExact + (PREFERRED[t] === sign.gardiner ? 50 : 0), 'translit')
    const ft = foldTranslit(t)
    if (ft === loose) take(SCORE.translitLoose, 'translit')
    else if (loose.length >= 2 && ft.startsWith(loose)) take(SCORE.translitPrefix, 'translit')
  }

  // 3. Description en français
  const fq = foldText(q)
  if (fq.length >= 2) {
    const desc = foldText(sign.descriptionFr + ' ' + (sign.notes ?? ''))
    const idx = desc.indexOf(fq)
    if (idx >= 0) {
      const wordStart = idx === 0 || /[^a-z0-9]/.test(desc[idx - 1])
      // Début de mot : toujours. Milieu de mot : seulement pour une recherche longue
      // (sinon « rond » trouverait « hirondelle »).
      const anyStart = wordStart ? idx : desc.search(new RegExp(`(^|[^a-z0-9])${fq.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`))
      if (anyStart >= 0) take(SCORE.descWordStart, 'description')
      else if (fq.length >= 5) take(SCORE.descSubstring, 'description')
    }
  }
  // À pertinence égale, les signes courants (fiches rédigées à la main) passent devant.
  if (best && sign.common) (best as SearchResult).score += 30
  return best
}

export function searchSigns(signs: Sign[], query: string, filters: SearchFilters = {}, limit = Infinity): SearchResult[] {
  const out: SearchResult[] = []
  for (const s of signs) {
    if (filters.category && s.category !== filters.category) continue
    if (filters.kind && !s.kind.includes(filters.kind)) continue
    if (filters.verified !== undefined && s.verified !== filters.verified) continue
    const r = scoreSign(s, query)
    if (r) out.push(r)
  }
  out.sort((a, b) => b.score - a.score || compareCodes(a.sign.gardiner, b.sign.gardiner))
  return out.slice(0, limit)
}
