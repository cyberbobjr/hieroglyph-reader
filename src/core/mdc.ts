/**
 * Export de la transcription : texte « Manuel de Codage » (MdC), chaîne
 * Unicode et liste des signes.
 *
 * Rappel de la syntaxe MdC employée (celle de JSesh) :
 *   -            sépare deux cadrats (deux « cases » de texte)
 *   :            superpose (le premier signe au-dessus du second)
 *   *            juxtapose (côte à côte, dans le sens de lecture)
 *   ( )          regroupe ; « * » étant prioritaire sur « : », on écrit
 *                « (a:b)*c » pour un empilement placé à côté d'un signe
 *   <- … ->      cartouche
 *   //           lacune (cadrat entièrement détruit)
 *   #b … #e      zone endommagée (« hachurée ») : signe restitué dans une lacune
 *   !            fin de ligne
 *
 * À NOTER — conventions propres à cette application, hors MdC standard :
 *   ?            signe tracé mais pas encore identifié (JSesh l'affichera
 *                comme un code inconnu) ;
 *   les statuts « probable » et « incertain » ne figurent pas dans le MdC
 *   (pour qu'il reste lisible par tous les outils) : ils sont donnés dans la
 *   liste des signes qui accompagne chaque ligne.
 */
import type { Group, Item, Line, Project, SignStatus } from '../types/models'
import { layoutQuadrat, layoutToText } from './quadratLayout'
import { sortByNumber } from './lines'
import { unicodeFor } from './gardiner'

export const MDC_UNKNOWN = '?'
export const MDC_LACUNA = '//'
/** Caractères Unicode : début et fin de cartouche (V11A, V11B), signe perdu. */
export const UNI_CARTOUCHE_BEGIN = '\u{13379}'
export const UNI_CARTOUCHE_END = '\u{1337A}'
export const UNI_LOST = '\u{13443}'

/** Infos utiles sur un signe (fournies par la bibliothèque). */
export interface SignInfo {
  unicode?: string
  translit?: string[]
}
export type SignLookup = (code: string) => SignInfo | undefined

/** Un « bloc » de la ligne : un signe seul ou un carré. */
interface Unit {
  items: Item[]
  quadrat?: Group
  cartoucheId?: string
}

/** Découpe une ligne (déjà dans l'ordre de lecture) en blocs. */
function unitsOf(line: Line, groups: Group[]): Unit[] {
  const quadrats = new Map(groups.filter((g) => g.kind === 'quadrat' && g.lineId === line.id).map((g) => [g.id, g]))
  const cartoucheOf = new Map<string, string>()
  for (const g of groups) if (g.kind === 'cartouche' && g.lineId === line.id) for (const id of g.memberIds) cartoucheOf.set(id, g.id)
  const units: Unit[] = []
  for (const it of line.items) {
    const last = units.at(-1)
    const q = it.groupId ? quadrats.get(it.groupId) : undefined
    if (q && last?.quadrat?.id === q.id) last.items.push(it)
    else units.push({ items: [it], quadrat: q, cartoucheId: cartoucheOf.get(it.id) })
  }
  return units
}

/** Code MdC d'un signe seul. */
export function itemToken(it: Item): string {
  if (it.status === 'lacune') return it.signCode ? `#b-${it.signCode}-#e` : MDC_LACUNA
  return it.signCode ?? MDC_UNKNOWN
}

/** Code d'un signe à l'intérieur d'un carré (pas de « #b-…-#e », qui casserait le carré). */
function innerToken(it: Item): string {
  if (it.status === 'lacune' && !it.signCode) return MDC_LACUNA
  return it.signCode ?? MDC_UNKNOWN
}

function unitMdc(u: Unit, line: Line): string {
  if (u.items.length === 1) return itemToken(u.items[0])
  if (u.quadrat?.layoutOverride) return u.quadrat.layoutOverride
  const tree = layoutQuadrat(u.items.map((i) => ({ id: i.id, box: i.bbox })), line.direction)
  const byId = new Map(u.items.map((i) => [i.id, i]))
  return layoutToText(tree, (id) => innerToken(byId.get(id)!))
}

/** MdC d'une ligne (sans le « ! » final). */
export function lineToMdc(line: Line, groups: Group[]): string {
  const parts: string[] = []
  let openCartouche: string | undefined
  for (const u of unitsOf(line, groups)) {
    if (u.cartoucheId !== openCartouche) {
      if (openCartouche) parts.push('->')
      if (u.cartoucheId) parts.push('<')
      openCartouche = u.cartoucheId
    }
    parts.push(unitMdc(u, line))
  }
  if (openCartouche) parts.push('->')
  // Jointure par « - » : « < » + « - » donne bien « <- » ; « X1 » + « - » + « -> »
  // donnerait « X1--> », qu'on ramène à « X1-> ».
  return parts.join('-').replace(/-->/g, '->')
}

/** MdC de toute la stèle : une ligne par ligne de texte, terminée par « ! ». */
export function projectToMdc(p: Project): string {
  const lines = sortByNumber(p.lines).filter((l) => l.items.length)
  return lines.map((l, i) => lineToMdc(l, p.groups) + (i < lines.length - 1 ? '-!' : '')).join('\n')
}

/** Caractère Unicode d'une boîte (« ? » si non identifiée, signe perdu si lacune). */
export function itemUnicode(it: Item, lookup: SignLookup): string {
  if (it.status === 'lacune' && !it.signCode) return UNI_LOST
  if (!it.signCode) return '?'
  return lookup(it.signCode)?.unicode || unicodeFor(it.signCode) || `[${it.signCode}]`
}

/**
 * Chaîne Unicode d'une ligne, signe après signe dans l'ordre de lecture.
 * Elle est « linéaire » : la disposition des carrés est donnée par le MdC.
 */
export function lineToUnicode(line: Line, groups: Group[], lookup: SignLookup): string {
  let out = ''
  let open: string | undefined
  for (const u of unitsOf(line, groups)) {
    if (u.cartoucheId !== open) {
      if (open) out += UNI_CARTOUCHE_END
      if (u.cartoucheId) out += UNI_CARTOUCHE_BEGIN
      open = u.cartoucheId
    }
    for (const it of u.items) out += itemUnicode(it, lookup)
  }
  if (open) out += UNI_CARTOUCHE_END
  return out
}

export const STATUS_FR: Record<SignStatus, string> = {
  certain: 'certain',
  probable: 'probable',
  incertain: 'incertain',
  lacune: 'lacune',
}

export interface SignRow {
  position: number
  /** Caractère Unicode (« ? » si non identifié, signe perdu si lacune). */
  glyph: string
  code: string
  translit: string
  status: SignStatus
  note: string
  inQuadrat: boolean
  inCartouche: boolean
}

/** Liste détaillée des signes d'une ligne. */
export function lineSignRows(line: Line, groups: Group[], lookup: SignLookup): SignRow[] {
  const inCartouche = new Set(groups.filter((g) => g.kind === 'cartouche' && g.lineId === line.id).flatMap((g) => g.memberIds))
  return line.items.map((it, i) => ({
    position: i + 1,
    glyph: itemUnicode(it, lookup),
    code: it.signCode ?? (it.status === 'lacune' ? '—' : 'non identifié'),
    translit: it.signCode ? (lookup(it.signCode)?.translit ?? []).join(', ') : '',
    status: it.status,
    note: it.note.trim(),
    inQuadrat: !!it.groupId,
    inCartouche: inCartouche.has(it.id),
  }))
}

/** Liste compacte « 1. G17 [m] certain ; 2. … » */
export function lineSignList(line: Line, groups: Group[], lookup: SignLookup): string {
  return lineSignRows(line, groups, lookup)
    .map((r) => {
      const tr = r.translit ? ` [${r.translit}]` : ''
      const extra = [r.inQuadrat ? 'carré' : '', r.inCartouche ? 'cartouche' : ''].filter(Boolean).join(', ')
      const note = r.note ? ` (note : ${r.note})` : ''
      return `${r.position}. ${r.code}${tr} ${STATUS_FR[r.status]}${extra ? ` — ${extra}` : ''}${note}`
    })
    .join(' ; ')
}

export interface Stats {
  lines: number
  rows: number
  columns: number
  signs: number
  byStatus: Record<SignStatus, number>
  unidentified: number
}

export function stats(p: Project): Stats {
  const items = p.lines.flatMap((l) => l.items)
  const byStatus: Record<SignStatus, number> = { certain: 0, probable: 0, incertain: 0, lacune: 0 }
  for (const it of items) byStatus[it.status]++
  return {
    lines: p.lines.length,
    rows: p.lines.filter((l) => l.orientation === 'row').length,
    columns: p.lines.filter((l) => l.orientation === 'column').length,
    signs: items.length,
    byStatus,
    unidentified: items.filter((i) => !i.signCode && i.status !== 'lacune').length,
  }
}
