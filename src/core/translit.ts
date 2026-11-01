/**
 * Translittération : l'écriture des sons égyptiens en lettres latines.
 *
 * Deux façons de l'écrire coexistent :
 *  - l'écriture égyptologique, avec des caractères spéciaux : ꜣ ꜥ ḥ ḫ ẖ š ṯ ḏ…
 *  - l'écriture « Manuel de Codage » (MdC), en simples lettres du clavier :
 *    A = ꜣ, a = ꜥ, i = j, H = ḥ, x = ḫ, X = ẖ, S = š, T = ṯ, D = ḏ.
 *    Attention : en MdC, MAJUSCULES et minuscules sont des lettres différentes.
 *
 * L'application stocke l'écriture égyptologique et accepte les deux à la saisie.
 */

const MDC_TO_UNI: Record<string, string> = {
  A: 'ꜣ',
  a: 'ꜥ',
  i: 'j',
  H: 'ḥ',
  x: 'ḫ',
  X: 'ẖ',
  S: 'š',
  T: 'ṯ',
  D: 'ḏ',
  Q: 'q', // ḳ dans certaines éditions
}
const UNI_TO_MDC: Record<string, string> = {
  ꜣ: 'A',
  ꜥ: 'a',
  j: 'i',
  ḥ: 'H',
  ḫ: 'x',
  ẖ: 'X',
  š: 'S',
  ṯ: 'T',
  ḏ: 'D',
}

/** Variantes typographiques courantes → caractères retenus par l'application. */
const VARIANTS: [RegExp, string][] = [
  [/[ȜȝꜢ3]/g, 'ꜣ'], // aleph écrit avec un yogh, une majuscule ou « 3 »
  [/[ʿʽꜤ‘ʕ]/g, 'ꜥ'], // ayin écrit avec un esprit, une apostrophe…
  [/ỉ|i͗/g, 'j'], // yod écrit ỉ
  [/ḳ/g, 'q'],
]

/** Uniformise une translittération égyptologique (variantes typographiques). */
export function normalizeTranslit(s: string): string {
  // Les majuscules à signe diacritique (Ḥ, Š…) deviennent minuscules.
  let out = s.normalize('NFC').replace(/[ḤḪŠṮḎ]/g, (c) => c.toLowerCase())
  for (const [re, rep] of VARIANTS) out = out.replace(re, rep)
  return out
}

/** Contient-elle des caractères égyptologiques ? */
export function hasEgyptologicalChars(s: string): boolean {
  return /[ꜣꜥḥḫẖšṯḏȜȝʿỉḳ]/.test(s)
}

/** MdC → égyptologique : « anx » → « ꜥnḫ ». Les caractères déjà égyptologiques sont gardés. */
export function mdcToUnicode(s: string): string {
  return normalizeTranslit([...s].map((c) => MDC_TO_UNI[c] ?? c).join(''))
}

/** Égyptologique → MdC : « ꜥnḫ » → « anx ». */
export function unicodeToMdc(s: string): string {
  return [...normalizeTranslit(s)].map((c) => UNI_TO_MDC[c] ?? c).join('')
}

/**
 * Interprète une saisie de l'utilisateur : si elle contient des caractères
 * égyptologiques on la garde, sinon on la lit comme du MdC.
 */
export function parseTranslitInput(s: string): string {
  const t = s.trim()
  return hasEgyptologicalChars(t) ? normalizeTranslit(t) : mdcToUnicode(t)
}

/** Forme « tolérante » pour la recherche : MdC en minuscules (« ḥtp » → « htp »). */
export function foldTranslit(s: string): string {
  return unicodeToMdc(s).toLowerCase()
}

/** Texte français sans accents ni majuscules : « Chouette » → « chouette », « bâton » → « baton ». */
export function foldText(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}
