<script setup lang="ts">
/**
 * Fenêtre « Transcription » : tout ce qui sort de l'application.
 *  - « Copier pour Claude » : le bloc complet à coller dans une conversation ;
 *  - le MdC de toute la stèle ;
 *  - pour chaque ligne : MdC, chaîne Unicode, liste des signes avec statuts ;
 *  - l'export JSON complet du projet.
 */
import { computed, onMounted, ref } from 'vue'
import { useProjectStore } from '../../stores/project'
import { useProjectsStore } from '../../stores/projects'
import { useLibraryStore } from '../../stores/library'
import { useUiStore } from '../../stores/ui'
import { sortByNumber } from '../../core/lines'
import { lineSignRows, lineToMdc, lineToUnicode, projectToMdc, stats, STATUS_FR, type SignLookup } from '../../core/mdc'
import { buildPrompt } from '../../core/promptBuilder'
import { downloadText, safeFilename } from '../../persistence/projectFile'
import type { Line } from '../../types/models'

const emit = defineEmits<{ (e: 'close'): void }>()
const store = useProjectStore()
const projects = useProjectsStore()
const library = useLibraryStore()
const ui = useUiStore()
const dialog = ref<HTMLDialogElement | null>(null)
const showPrompt = ref(false)
/** Aperçu Unicode « comme sur la stèle » : ordre et orientation de la photo. */
const asOnStele = ref(true)

onMounted(() => dialog.value?.showModal())

const lookup: SignLookup = (code) => library.get(code)
const p = computed(() => store.project!)
const lines = computed(() => sortByNumber(p.value.lines))
const st = computed(() => stats(p.value))
const mdcAll = computed(() => projectToMdc(p.value))
const prompt = computed(() => buildPrompt(p.value, lookup))
const unverifiedUsed = computed(() => {
  const codes = new Set(p.value.lines.flatMap((l) => l.items.map((i) => i.signCode)).filter((c): c is string => !!c))
  return [...codes].filter((c) => !library.get(c)?.verified).length
})
const missingInLibrary = computed(() => {
  const codes = new Set(p.value.lines.flatMap((l) => l.items.map((i) => i.signCode)).filter((c): c is string => !!c))
  return [...codes].filter((c) => !library.get(c))
})

const perLine = computed(() =>
  lines.value.map((l) => ({
    line: l,
    mdc: l.items.length ? lineToMdc(l, p.value.groups) : '',
    unicode: lineToUnicode(l, p.value.groups, lookup),
    rows: lineSignRows(l, p.value.groups, lookup),
  })),
)

/** Glyphes d'une ligne, dans l'ordre visuel de la stèle (pour l'aperçu). */
function visualGlyphs(l: Line, text: string) {
  const chars = [...text]
  return l.direction === 'rtl' && l.orientation === 'row' ? chars.reverse() : chars
}

async function copy(text: string, what: string) {
  try {
    await navigator.clipboard.writeText(text)
  } catch {
    // Repli pour les navigateurs sans accès au presse-papiers (contexte non sécurisé).
    const ta = document.createElement('textarea')
    ta.value = text
    ta.style.position = 'fixed'
    ta.style.opacity = '0'
    document.body.appendChild(ta)
    ta.select()
    const ok = document.execCommand('copy')
    ta.remove()
    if (!ok) {
      ui.notify('Copie impossible : sélectionnez le texte et copiez-le à la main.', 'error', 6000)
      return
    }
  }
  ui.notify(`${what} copié dans le presse-papiers.`)
}

function onNotes(e: Event) {
  store.mutate('Informations sur la stèle', (proj) => (proj.notes = (e.target as HTMLTextAreaElement).value), 'project-notes')
}

const base = computed(() => safeFilename(p.value.name))

async function exportJson() {
  await store.flush()
  await projects.exportToFile(p.value.id)
}

const statusClass = (s: string) => `st-${s}`
</script>

<template>
  <dialog ref="dialog" class="export" aria-labelledby="export-title" @close="emit('close')" @cancel="emit('close')">
    <header class="top">
      <h2 id="export-title">Transcription de « {{ p.name }} »</h2>
      <button class="btn icon" type="button" aria-label="Fermer" @click="dialog?.close()">×</button>
    </header>

    <div class="body">
      <!-- Résumé -------------------------------------------------------------- -->
      <section class="summary" aria-label="Résumé">
        <p>
          <b>{{ st.lines }}</b> ligne(s) · <b>{{ st.signs }}</b> signe(s) :
          <span class="st-certain">{{ st.byStatus.certain }} certain(s)</span>,
          <span class="st-probable">{{ st.byStatus.probable }} probable(s)</span>,
          <span class="st-incertain">{{ st.byStatus.incertain }} incertain(s)</span>,
          <span class="st-lacune">{{ st.byStatus.lacune }} lacune(s)</span>
          <template v-if="st.unidentified">, <b class="warn">{{ st.unidentified }} non identifié(s)</b></template>
        </p>
        <ul class="warnings">
          <li v-if="st.unidentified">Des boîtes n'ont pas de signe : elles apparaissent comme « ? » dans le MdC.</li>
          <li v-if="missingInLibrary.length">Codes absents de la bibliothèque (pas de valeur phonétique) : {{ missingInLibrary.join(', ') }}.</li>
          <li v-if="unverifiedUsed">{{ unverifiedUsed }} signe(s) utilisé(s) ont des valeurs « à vérifier » dans la bibliothèque : elles sont présentées à l'IA comme indicatives.</li>
          <li v-if="!st.signs">Aucun signe saisi pour l'instant.</li>
        </ul>
        <label class="notes">
          <span>Informations sur la stèle, transmises à l'IA <small>(provenance, époque, matériau, dimensions, scène…)</small></span>
          <textarea :value="p.notes" rows="2" placeholder="ex. stèle cintrée en calcaire, Abydos, Moyen Empire ; un homme assis devant une table d'offrandes" @input="onNotes" />
        </label>
      </section>

      <!-- Copier pour Claude ------------------------------------------------- -->
      <section class="claude" aria-labelledby="claude-title">
        <h3 id="claude-title">Pour une IA</h3>
        <p class="hint">
          Un seul bloc à coller dans la conversation : contexte, transcription ligne par ligne, points incertains, et la
          consigne de traduction.
        </p>
        <div class="row">
          <button class="btn primary big" type="button" :disabled="!st.signs" @click="copy(prompt, 'Le bloc pour Claude')">
            📋 Copier pour Claude
          </button>
          <button class="btn" type="button" :aria-expanded="showPrompt" @click="showPrompt = !showPrompt">
            {{ showPrompt ? "Masquer l'aperçu" : "Voir l'aperçu" }}
          </button>
          <button class="btn" type="button" :disabled="!st.signs" @click="downloadText(`${base}-pour-ia.txt`, prompt, 'text/plain')">Télécharger (.txt)</button>
        </div>
        <textarea v-if="showPrompt" class="preview" :value="prompt" readonly rows="16" aria-label="Aperçu du bloc pour Claude" />
      </section>

      <!-- MdC complet ------------------------------------------------------------ -->
      <section aria-labelledby="mdc-title">
        <h3 id="mdc-title">Manuel de Codage — toute la stèle</h3>
        <pre class="code" tabindex="0">{{ mdcAll || '(vide)' }}</pre>
        <div class="row">
          <button class="btn small" type="button" :disabled="!mdcAll" @click="copy(mdcAll, 'Le MdC')">Copier le MdC</button>
          <button class="btn small" type="button" :disabled="!mdcAll" @click="downloadText(`${base}.mdc.txt`, mdcAll, 'text/plain')">Télécharger</button>
          <button class="btn small" type="button" @click="exportJson">Export JSON complet du projet</button>
        </div>
        <p class="hint">
          Lisible par JSesh (coller dans l'éditeur) et par une IA. <code>-</code> sépare les cadrats, <code>:</code>
          superpose, <code>*</code> juxtapose, <code>&lt;-</code> … <code>-&gt;</code> cartouche, <code>//</code> lacune,
          <code>!</code> fin de ligne. <code>?</code> (signe non identifié) est propre à cette application.
        </p>
      </section>

      <!-- Ligne par ligne ---------------------------------------------------------- -->
      <section aria-labelledby="lines-title">
        <div class="lines-head">
          <h3 id="lines-title">Ligne par ligne</h3>
          <label class="check"><input v-model="asOnStele" type="checkbox" /> Aperçu Unicode orienté comme sur la stèle</label>
        </div>
        <article v-for="pl in perLine" :key="pl.line.id" class="line">
          <h4>
            {{ pl.line.orientation === 'column' ? 'Colonne' : 'Ligne' }} {{ pl.line.number }}
            <span class="muted">— {{ pl.line.orientation === 'column' ? 'colonne' : 'horizontale' }},
              {{ pl.line.direction === 'rtl' ? 'droite → gauche' : 'gauche → droite' }}, {{ pl.rows.length }} signe(s)</span>
          </h4>
          <template v-if="pl.rows.length">
            <div class="kv">
              <span class="k">MdC</span>
              <code class="v">{{ pl.mdc }}</code>
              <button class="btn small" type="button" @click="copy(pl.mdc, `Le MdC de la ligne ${pl.line.number}`)">Copier</button>
            </div>
            <div class="kv">
              <span class="k">Unicode</span>
              <span class="v glyphs glyph-text" :class="{ column: asOnStele && pl.line.orientation === 'column' }" :aria-label="`Chaîne Unicode de la ligne ${pl.line.number}`">
                <template v-if="asOnStele">
                  <span v-for="(g, i) in visualGlyphs(pl.line, pl.unicode)" :key="i" :class="{ mirror: pl.line.direction === 'rtl' }">{{ g }}</span>
                </template>
                <template v-else>{{ pl.unicode }}</template>
              </span>
              <button class="btn small" type="button" @click="copy(pl.unicode, `L'Unicode de la ligne ${pl.line.number}`)">Copier</button>
            </div>
            <table class="signs">
              <caption class="sr-only">Signes de la ligne {{ pl.line.number }}</caption>
              <thead>
                <tr><th>n°</th><th>Signe</th><th>Code</th><th>Valeur</th><th>Statut</th><th>Groupe</th><th>Note</th></tr>
              </thead>
              <tbody>
                <tr v-for="r in pl.rows" :key="r.position">
                  <td>{{ r.position }}</td>
                  <td class="glyph-text g">
                    <span :class="{ mirror: pl.line.direction === 'rtl' }">{{ r.glyph }}</span>
                  </td>
                  <td>{{ r.code }}</td>
                  <td class="tr">{{ r.translit }}</td>
                  <td><span :class="statusClass(r.status)">{{ STATUS_FR[r.status] }}</span></td>
                  <td>{{ [r.inQuadrat ? 'carré' : '', r.inCartouche ? 'cartouche' : ''].filter(Boolean).join(', ') }}</td>
                  <td>{{ r.note }}</td>
                </tr>
              </tbody>
            </table>
          </template>
          <p v-else class="muted">Aucun signe sur cette ligne.</p>
        </article>
        <p v-if="!lines.length" class="muted">Aucune ligne tracée.</p>
      </section>
    </div>
  </dialog>
</template>

<style scoped>
.export {
  width: min(980px, calc(100vw - 24px));
  max-height: calc(100vh - 24px);
  padding: 0;
  border: 1px solid var(--border);
  border-radius: 14px;
  background: var(--surface);
  color: var(--text);
  box-shadow: var(--shadow);
}
.export::backdrop {
  background: rgb(0 0 0 / 0.5);
}
.export[open] {
  display: flex;
  flex-direction: column;
}
.top {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 0.5rem;
  padding: 0.7rem 1rem;
  border-bottom: 1px solid var(--border);
}
h2 {
  margin: 0;
  font-size: 1.15rem;
}
.body {
  overflow-y: auto;
  padding: 0.8rem 1rem 1.2rem;
  display: grid;
  gap: 1.2rem;
}
h3 {
  margin: 0 0 0.4rem;
  font-size: 1rem;
}
h4 {
  margin: 0 0 0.4rem;
  font-size: 0.95rem;
}
.muted {
  color: var(--muted);
  font-weight: normal;
}
.hint code {
  font-family: var(--font-mono);
  background: var(--bg);
  padding: 0 0.25em;
  border-radius: 3px;
}
.hint {
  color: var(--muted);
  font-size: 0.82rem;
  margin: 0.3rem 0;
}
.warn {
  color: var(--danger);
}
.summary p {
  margin: 0;
}
.warnings {
  margin: 0.4rem 0;
  padding-left: 1.2rem;
  font-size: 0.85rem;
  color: var(--muted);
}
.notes {
  display: grid;
  gap: 0.25rem;
  font-size: 0.85rem;
}
.notes span {
  color: var(--muted);
}
textarea {
  font: inherit;
  padding: 0.45rem;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--bg);
  color: var(--text);
  width: 100%;
}
.claude {
  background: var(--hover);
  border-radius: 12px;
  padding: 0.8rem;
}
.preview {
  margin-top: 0.5rem;
  font-family: var(--font-mono);
  font-size: 0.8rem;
}
.row {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
  align-items: center;
}
.code {
  margin: 0 0 0.4rem;
  padding: 0.6rem;
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: 8px;
  font-family: var(--font-mono);
  font-size: 0.85rem;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}
.lines-head {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  align-items: baseline;
  gap: 0.5rem;
}
.check {
  font-size: 0.82rem;
  display: flex;
  gap: 0.35rem;
  align-items: center;
}
.line {
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 0.6rem 0.7rem;
  margin-bottom: 0.6rem;
}
.kv {
  display: grid;
  grid-template-columns: 4.5rem minmax(0, 1fr) auto;
  gap: 0.5rem;
  align-items: center;
  margin-bottom: 0.35rem;
}
.k {
  color: var(--muted);
  font-size: 0.8rem;
}
.v {
  font-family: var(--font-mono);
  font-size: 0.85rem;
  overflow-wrap: anywhere;
  background: var(--bg);
  padding: 0.25rem 0.4rem;
  border-radius: 6px;
}
.glyphs {
  font-family: var(--font-glyph);
  font-size: 1.8rem;
  line-height: 1.2;
}
.glyphs.column {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
}
.signs {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.82rem;
  margin-top: 0.3rem;
}
.signs th,
.signs td {
  text-align: left;
  padding: 0.2rem 0.4rem;
  border-bottom: 1px solid var(--border);
  vertical-align: middle;
}
.signs th {
  color: var(--muted);
  font-weight: 600;
}
.signs .g {
  font-size: 1.4rem;
}
.signs .tr {
  color: var(--accent);
  font-weight: 600;
}
.st-certain {
  color: #2e9d4a;
}
.st-probable {
  color: #2f7fd6;
}
.st-incertain {
  color: #c77700;
}
.st-lacune {
  color: var(--danger);
}
@media (max-width: 640px) {
  .signs th:nth-child(6),
  .signs td:nth-child(6) {
    display: none;
  }
}
</style>
