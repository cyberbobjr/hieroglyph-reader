/**
 * Codes de la classification de Gardiner : « G17 », « Aa1 », « N35A »…
 * Une lettre (ou « Aa ») = la catégorie, un numéro, parfois une lettre de variante.
 */
import unicodeTable from '../data/unicodeGardiner.json'
import type { SignKind } from '../types/models'

/** Catégories dans l'ordre de la liste de Gardiner (il n'y a pas de J). */
export const CATEGORIES: { code: string; nameFr: string }[] = [
  { code: 'A', nameFr: 'Hommes et leurs activités' },
  { code: 'B', nameFr: 'Femmes et leurs activités' },
  { code: 'C', nameFr: 'Divinités anthropomorphes' },
  { code: 'D', nameFr: 'Parties du corps humain' },
  { code: 'E', nameFr: 'Mammifères' },
  { code: 'F', nameFr: 'Parties de mammifères' },
  { code: 'G', nameFr: 'Oiseaux' },
  { code: 'H', nameFr: "Parties d'oiseaux" },
  { code: 'I', nameFr: 'Amphibiens, reptiles' },
  { code: 'K', nameFr: 'Poissons et parties de poissons' },
  { code: 'L', nameFr: 'Invertébrés et petits animaux' },
  { code: 'M', nameFr: 'Arbres et plantes' },
  { code: 'N', nameFr: 'Ciel, terre, eau' },
  { code: 'O', nameFr: 'Bâtiments et parties de bâtiments' },
  { code: 'P', nameFr: 'Bateaux et parties de bateaux' },
  { code: 'Q', nameFr: 'Mobilier domestique et funéraire' },
  { code: 'R', nameFr: 'Mobilier de temple, emblèmes sacrés' },
  { code: 'S', nameFr: 'Couronnes, vêtements, bâtons' },
  { code: 'T', nameFr: 'Armes, chasse, boucherie' },
  { code: 'U', nameFr: 'Agriculture, artisanat, métiers' },
  { code: 'V', nameFr: 'Cordes, fibres, paniers, sacs' },
  { code: 'W', nameFr: 'Récipients en pierre et en terre cuite' },
  { code: 'X', nameFr: 'Pains et gâteaux' },
  { code: 'Y', nameFr: 'Écriture, jeux, musique' },
  { code: 'Z', nameFr: 'Traits, signes issus du hiératique' },
  { code: 'Aa', nameFr: 'Signes non classés' },
]
const CATEGORY_INDEX = new Map(CATEGORIES.map((c, i) => [c.code, i]))

export const KIND_LABELS: Record<SignKind, string> = {
  ideogram: 'idéogramme',
  uniliteral: 'unilitère',
  biliteral: 'bilitère',
  triliteral: 'trilitère',
  determinative: 'déterminatif',
}
export const KIND_SHORT: Record<SignKind, string> = {
  ideogram: 'idéo.',
  uniliteral: '1-lit.',
  biliteral: '2-lit.',
  triliteral: '3-lit.',
  determinative: 'dét.',
}

const CODE_RE = /^(aa|[a-z])0*(\d{1,3})([a-z]{0,2})$/i

/**
 * Remet un code tapé à la main dans la forme officielle :
 * « g17 » → « G17 », « aa001 » → « Aa1 », « n35a » → « N35A ».
 * Renvoie null si ce n'est pas un code Gardiner.
 */
export function normalizeCode(input: string): string | null {
  const m = input.trim().match(CODE_RE)
  if (!m) return null
  const cat = m[1].toLowerCase() === 'aa' ? 'Aa' : m[1].toUpperCase()
  if (!CATEGORY_INDEX.has(cat)) return null
  return `${cat}${parseInt(m[2], 10)}${m[3].toUpperCase()}`
}

export function categoryOf(code: string): string {
  return code.startsWith('Aa') ? 'Aa' : code[0]
}

export function categoryName(cat: string): string {
  return CATEGORIES.find((c) => c.code === cat)?.nameFr ?? cat
}

/** Ordre naturel : A1 < A2 < A10 < B1 … < Z1 < Aa1 (et G7 < G7A < G8). */
export function compareCodes(a: string, b: string): number {
  const pa = a.match(/^(Aa|[A-Z])(\d+)([A-Z]*)$/)
  const pb = b.match(/^(Aa|[A-Z])(\d+)([A-Z]*)$/)
  if (!pa || !pb) return a.localeCompare(b)
  return (
    (CATEGORY_INDEX.get(pa[1]) ?? 99) - (CATEGORY_INDEX.get(pb[1]) ?? 99) ||
    parseInt(pa[2], 10) - parseInt(pb[2], 10) ||
    pa[3].localeCompare(pb[3])
  )
}

/** Caractère Unicode d'un code Gardiner (chaîne vide s'il n'existe pas dans Unicode). */
export function unicodeFor(code: string): string {
  return (unicodeTable as Record<string, string>)[code] ?? ''
}

/** Tous les codes connus d'Unicode, dans l'ordre de Gardiner. */
export function allUnicodeCodes(): string[] {
  return Object.keys(unicodeTable).sort(compareCodes)
}
