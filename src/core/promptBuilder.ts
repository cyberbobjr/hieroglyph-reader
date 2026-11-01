/**
 * Bloc de texte « Copier pour Claude » : le contexte, la transcription
 * ligne par ligne, les points d'attention et la consigne finale.
 * Il est pensé pour être collé tel quel dans une conversation avec une IA.
 */
import type { Line, Project } from '../types/models'
import { sortByNumber } from './lines'
import { lineSignRows, lineSignList, lineToMdc, lineToUnicode, stats, STATUS_FR, type SignLookup } from './mdc'

export const FINAL_INSTRUCTION =
  'Donne la translittération, la traduction en français et signale les points incertains, ' +
  'en distinguant ce qui vient de ma transcription de ce qui est supposé.'

const dirFr = (l: Line) => (l.direction === 'rtl' ? 'droite → gauche' : 'gauche → droite')
const kindFr = (l: Line) => (l.orientation === 'column' ? 'colonne' : 'ligne horizontale')
const label = (l: Line) => (l.orientation === 'column' ? `Colonne ${l.number}` : `Ligne ${l.number}`)

function plural(n: number, one: string, many: string) {
  return `${n} ${n > 1 ? many : one}`
}

export function buildPrompt(p: Project, lookup: SignLookup): string {
  const lines = sortByNumber(p.lines)
  const st = stats(p)
  const out: string[] = []

  out.push(
    "Voici la transcription d'une stèle égyptienne en hiéroglyphes, que j'ai établie moi-même, " +
      "signe par signe, à partir d'une photo (identification d'après la liste de Gardiner).",
  )

  // --- Contexte -------------------------------------------------------------
  out.push('', '## Contexte')
  out.push(`- Stèle : ${p.name}`)
  if (p.notes.trim()) out.push(`- Informations sur la stèle : ${p.notes.trim()}`)
  const shape = [st.rows ? plural(st.rows, 'ligne horizontale', 'lignes horizontales') : '', st.columns ? plural(st.columns, 'colonne', 'colonnes') : '']
    .filter(Boolean)
    .join(' et ')
  out.push(`- Nombre de lignes : ${st.lines}${shape ? ` (${shape})` : ''}`)
  const dirs = new Set(lines.map(dirFr))
  if (dirs.size === 1 && lines.length) out.push(`- Sens de lecture : ${[...dirs][0]} pour toutes les lignes`)
  else out.push(`- Sens de lecture : ${lines.map((l) => `${label(l)} ${dirFr(l)}`).join(' ; ')}`)
  if (st.columns) out.push('- Les colonnes se lisent de haut en bas.')
  const details = [
    st.byStatus.lacune ? plural(st.byStatus.lacune, 'lacune (signe détruit)', 'lacunes (signes détruits)') : '',
    st.byStatus.incertain ? plural(st.byStatus.incertain, 'signe incertain', 'signes incertains') : '',
    st.byStatus.probable ? plural(st.byStatus.probable, 'signe probable', 'signes probables') : '',
    st.unidentified ? plural(st.unidentified, 'signe non identifié', 'signes non identifiés') : '',
  ].filter(Boolean)
  out.push(`- Signes : ${st.signs} au total${details.length ? `, dont ${details.join(', ')}` : ''}`)
  out.push(
    '- Les signes sont donnés dans l’ordre de lecture. Notation Manuel de Codage (codes de Gardiner) : ' +
      '« - » sépare les cadrats, « : » superpose (haut puis bas), « * » juxtapose, « ( ) » regroupe, ' +
      '« <- … -> » encadre un cartouche, « // » marque une lacune, « #b … #e » un signe restitué dans une lacune, ' +
      '« ? » un signe tracé mais non identifié, « ! » une fin de ligne.',
  )
  out.push(
    '- Statuts de lecture : « certain », « probable », « incertain », « lacune ». ' +
      'Les valeurs phonétiques entre crochets viennent de ma bibliothèque de signes et sont indicatives.',
  )

  // --- Transcription ------------------------------------------------------------
  out.push('', '## Transcription ligne par ligne')
  for (const l of lines) {
    out.push('', `### ${label(l)} (${kindFr(l)}, ${dirFr(l)})`)
    if (!l.items.length) {
      out.push('(aucun signe saisi sur cette ligne)')
      continue
    }
    out.push(`MdC : ${lineToMdc(l, p.groups)}`)
    out.push(`Unicode : ${lineToUnicode(l, p.groups, lookup)}`)
    out.push(`Signes : ${lineSignList(l, p.groups, lookup)}`)
  }

  // --- Points d'attention ---------------------------------------------------------
  const attention: string[] = []
  for (const l of lines) {
    for (const r of lineSignRows(l, p.groups, lookup)) {
      if (r.status === 'certain' && !r.note && r.code !== 'non identifié') continue
      const what =
        r.code === 'non identifié'
          ? 'signe non identifié'
          : r.status === 'lacune'
            ? r.code === '—'
              ? 'lacune'
              : `lacune, signe restitué ${r.code}`
            : `${r.code}, ${STATUS_FR[r.status]}`
      attention.push(`- ${label(l)}, signe ${r.position} : ${what}${r.note ? ` — note : ${r.note}` : ''}`)
    }
  }
  if (attention.length) out.push('', "## Points d'attention (d'après ma transcription)", ...attention)

  // --- Consigne ---------------------------------------------------------------------
  out.push('', '## Consigne', FINAL_INSTRUCTION)
  return out.join('\n')
}
