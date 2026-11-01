<script setup lang="ts">
/**
 * Panneau « Bibliothèque de signes » : recherche, filtres, liste des
 * résultats, fiche du signe choisi, ajout et modification.
 *
 * Clavier : « / » place le curseur dans la recherche ; ↓ descend dans les
 * résultats, ↑/↓ s'y déplacent, Entrée ouvre la fiche, Échap revient à la recherche.
 */
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { CATEGORIES, KIND_LABELS, KIND_SHORT, normalizeCode, unicodeFor } from '../../core/gardiner'
import { searchSigns } from '../../core/search'
import { unicodeToMdc } from '../../core/translit'
import { SEED_WARNING, useLibraryStore } from '../../stores/library'
import { useUiStore } from '../../stores/ui'
import type { Sign, SignKind } from '../../types/models'
import SignCard from './SignCard.vue'
import SignEditor from './SignEditor.vue'

const library = useLibraryStore()
const ui = useUiStore()

const query = ref('')
const category = ref('')
const kind = ref<SignKind | ''>('')
const verifiedFilter = ref<'' | 'yes' | 'no'>('')
const selectedCode = ref<string | null>(null)
/** null = pas d'éditeur ; sinon les valeurs de départ du formulaire. */
const editing = ref<Partial<Sign> | null>(null)
const searchInput = ref<HTMLInputElement | null>(null)
const listEl = ref<HTMLElement | null>(null)
const fileInput = ref<HTMLInputElement | null>(null)
const WARNING_KEY = 'hieroglyph-reader:library-warning-seen'
function readFlag(): boolean {
  try {
    return localStorage.getItem(WARNING_KEY) === '1'
  } catch {
    return false
  }
}
const showWarning = ref(!readFlag())
function dismissWarning() {
  showWarning.value = false
  try {
    localStorage.setItem(WARNING_KEY, '1')
  } catch {
    // stockage indisponible : l'avertissement reviendra, sans gravité
  }
}

onMounted(() => void library.load())

const results = computed(() =>
  searchSigns(library.signs, query.value, {
    category: category.value || undefined,
    kind: kind.value || undefined,
    verified: verifiedFilter.value === '' ? undefined : verifiedFilter.value === 'yes',
  }),
)
const selected = computed(() => (selectedCode.value ? library.get(selectedCode.value) ?? null : null))

/** Code Gardiner tapé qui existe dans Unicode mais pas encore dans la bibliothèque. */
const missingCode = computed(() => {
  const c = normalizeCode(query.value)
  return c && !library.get(c) && unicodeFor(c) ? c : null
})

watch([query, category, kind, verifiedFilter], () => {
  if (listEl.value) listEl.value.scrollTop = 0
})

function open(code: string) {
  selectedCode.value = code
  editing.value = null
}

function startAdd(prefill?: Partial<Sign>) {
  selectedCode.value = null
  editing.value = prefill ?? {}
}
function startEdit() {
  const s = selected.value
  if (!s) return
  const { origin: _o, ...plain } = s
  editing.value = plain
}
function onSaved(code: string) {
  editing.value = null
  selectedCode.value = code
}

// --- Navigation au clavier dans les résultats ---------------------------------
function focusResult(i: number) {
  const items = listEl.value?.querySelectorAll<HTMLElement>('button.result')
  if (!items?.length) return
  items[Math.max(0, Math.min(items.length - 1, i))].focus()
}
function onSearchKey(e: KeyboardEvent) {
  if (e.key === 'ArrowDown') {
    e.preventDefault()
    focusResult(0)
  } else if (e.key === 'Enter' && results.value[0]) {
    e.preventDefault()
    open(results.value[0].sign.gardiner)
  } else if (e.key === 'Escape' && query.value) {
    e.stopPropagation()
    query.value = ''
  }
}
function onResultKey(e: KeyboardEvent, i: number) {
  if (e.key === 'ArrowDown') {
    e.preventDefault()
    focusResult(i + 1)
  } else if (e.key === 'ArrowUp') {
    e.preventDefault()
    if (i === 0) searchInput.value?.focus()
    else focusResult(i - 1)
  } else if (e.key === 'Escape') {
    e.preventDefault()
    e.stopPropagation()
    searchInput.value?.focus()
  }
}

async function onImport(file: File | undefined) {
  if (!file) return
  try {
    const n = await library.importLibrary(file)
    ui.notify(n ? `${n} signe(s) importé(s).` : 'Aucun signe nouveau ou modifié dans ce fichier.')
  } catch (e) {
    ui.notify((e as Error).message, 'error', 6000)
  }
}

const reasonLabel: Record<string, string> = { code: 'code', translit: 'valeur', description: 'description', all: '' }

async function focusSearch() {
  await nextTick()
  searchInput.value?.focus()
  searchInput.value?.select()
}
defineExpose({ focusSearch })
</script>

<template>
  <div class="library">
    <div class="head">
      <h2>Bibliothèque <span class="count">({{ library.stats.total }} signes, {{ library.stats.verified }} vérifiés)</span></h2>
      <button v-if="!showWarning" class="link-btn" type="button" @click="showWarning = true">⚠ données à vérifier</button>
    </div>

    <div v-if="showWarning" class="warning" role="note">
      <p><strong>⚠ À vérifier.</strong> {{ SEED_WARNING }}</p>
      <button class="btn small" type="button" @click="dismissWarning">Compris</button>
    </div>

    <div class="search">
      <label class="sr-only" for="library-search">Rechercher un signe</label>
      <input
        id="library-search"
        ref="searchInput"
        v-model="query"
        type="search"
        autocomplete="off"
        spellcheck="false"
        placeholder="G17, m, nfr, Htp, chouette…"
        aria-describedby="search-help"
        aria-controls="library-results"
        @keydown="onSearchKey"
      />
      <p id="search-help" class="hint">
        Code, valeur (MdC accepté : <code>A</code>=ꜣ <code>a</code>=ꜥ <code>H</code>=ḥ <code>x</code>=ḫ <code>S</code>=š <code>D</code>=ḏ) ou mot. Raccourci : <kbd>/</kbd>
      </p>
      <div class="filters">
        <label>
          <span class="sr-only">Catégorie</span>
          <select v-model="category" aria-label="Filtrer par catégorie">
            <option value="">Toutes catégories</option>
            <option v-for="c in CATEGORIES" :key="c.code" :value="c.code">{{ c.code }} — {{ c.nameFr }}</option>
          </select>
        </label>
        <label>
          <span class="sr-only">Type</span>
          <select v-model="kind" aria-label="Filtrer par type">
            <option value="">Tous types</option>
            <option v-for="(label, k) in KIND_LABELS" :key="k" :value="k">{{ label }}</option>
          </select>
        </label>
        <label>
          <span class="sr-only">Vérification</span>
          <select v-model="verifiedFilter" aria-label="Filtrer par vérification">
            <option value="">Vérifiés ou non</option>
            <option value="yes">Vérifiés</option>
            <option value="no">À vérifier</option>
          </select>
        </label>
      </div>
    </div>

    <SignEditor v-if="editing" :key="editing.gardiner ?? 'new'" :initial="editing" @saved="onSaved" @cancel="editing = null" />
    <SignCard v-else-if="selected" :sign="selected" @edit="startEdit" @close="selectedCode = null" />

    <p v-if="missingCode" class="missing">
      <span class="glyph-text big" aria-hidden="true">{{ unicodeFor(missingCode) }}</span>
      {{ missingCode }} existe dans Unicode mais pas encore dans la bibliothèque.
      <button class="btn small" type="button" @click="startAdd({ gardiner: missingCode, unicode: unicodeFor(missingCode) })">
        L'ajouter
      </button>
    </p>

    <p class="sr-only" aria-live="polite">{{ results.length }} résultat(s)</p>
    <div id="library-results" ref="listEl" class="results" role="list" aria-label="Résultats">
      <p v-if="!results.length" class="empty">Aucun signe trouvé.</p>
      <div v-for="(r, i) in results" :key="r.sign.gardiner" role="listitem">
        <button
          class="result"
          type="button"
          :class="{ current: r.sign.gardiner === selectedCode }"
          :aria-current="r.sign.gardiner === selectedCode ? 'true' : undefined"
          @click="open(r.sign.gardiner)"
          @keydown="onResultKey($event, i)"
          @keydown.enter.prevent="open(r.sign.gardiner)"
        >
          <span class="g glyph-text" aria-hidden="true">{{ r.sign.unicode || '□' }}</span>
          <span class="main">
            <span class="code">{{ r.sign.gardiner }}</span>
            <span class="tr">{{ r.sign.translit.join(', ') }}</span>
            <span class="sr-only">({{ r.sign.translit.map(unicodeToMdc).join(', ') }})</span>
            <span class="desc">{{ r.sign.descriptionFr }}</span>
          </span>
          <span class="meta">
            <span class="kinds">{{ r.sign.kind.map((k) => KIND_SHORT[k]).join(' ') }}</span>
            <span v-if="r.sign.verified" class="ok" title="vérifié">✓</span>
            <span v-else class="todo" title="à vérifier">?</span>
            <span v-if="query && reasonLabel[r.reason]" class="why">{{ reasonLabel[r.reason] }}</span>
          </span>
        </button>
      </div>
    </div>

    <div class="foot">
      <button class="btn small" type="button" @click="startAdd()">+ Ajouter un signe</button>
      <button class="btn small" type="button" title="Télécharger toute la bibliothèque en JSON" @click="library.exportLibrary()">Exporter</button>
      <button class="btn small" type="button" title="Importer des signes depuis un JSON" @click="fileInput?.click()">Importer</button>
      <input ref="fileInput" type="file" accept=".json,application/json" hidden @change="onImport(($event.target as HTMLInputElement).files?.[0]); ($event.target as HTMLInputElement).value = ''" />
    </div>
  </div>
</template>

<style scoped>
.library {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
  height: 100%;
  min-height: 0;
  font-size: 0.9rem;
}
h2 {
  margin: 0;
  font-size: 1rem;
}
.head {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  justify-content: space-between;
  gap: 0.3rem;
}
.link-btn {
  background: none;
  border: none;
  padding: 0;
  font: inherit;
  font-size: 0.75rem;
  color: #b8860b;
  cursor: pointer;
  text-decoration: underline;
}
.count {
  color: var(--muted);
  font-weight: normal;
  font-size: 0.8rem;
}
.warning {
  background: #fff3d6;
  color: #5c3b00;
  border: 1px solid #e8c676;
  border-radius: 8px;
  padding: 0.45rem 0.6rem;
  font-size: 0.78rem;
  display: grid;
  gap: 0.3rem;
  justify-items: start;
}
.warning p {
  margin: 0;
}
@media (prefers-color-scheme: dark) {
  .warning {
    background: #3a2f17;
    color: #f3dca8;
    border-color: #6b5320;
  }
}
.search {
  display: grid;
  gap: 0.35rem;
}
#library-search {
  font: inherit;
  font-size: 1rem;
  padding: 0.5rem 0.6rem;
  border: 2px solid var(--border);
  border-radius: 8px;
  background: var(--bg);
  color: var(--text);
  width: 100%;
}
#library-search:focus {
  border-color: var(--accent);
  outline: none;
}
.hint {
  margin: 0;
  font-size: 0.74rem;
  color: var(--muted);
}
code,
kbd {
  font-family: var(--font-mono);
  font-size: 0.72rem;
  background: var(--hover);
  padding: 0 0.2em;
  border-radius: 3px;
}
.filters {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.3rem;
}
.filters label:first-child {
  grid-column: 1 / -1;
}
.filters select {
  width: 100%;
  font: inherit;
  font-size: 0.82rem;
  padding: 0.3rem;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: var(--surface);
  color: var(--text);
}
.missing {
  margin: 0;
  font-size: 0.82rem;
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
  align-items: center;
  background: var(--hover);
  padding: 0.4rem;
  border-radius: 8px;
}
.big {
  font-size: 1.8rem;
}
.results {
  flex: 1;
  min-height: 160px;
  overflow-y: auto;
  border: 1px solid var(--border);
  border-radius: 8px;
}
.empty {
  padding: 0.8rem;
  color: var(--muted);
}
.result {
  width: 100%;
  display: grid;
  grid-template-columns: 44px minmax(0, 1fr) auto;
  gap: 0.5rem;
  align-items: center;
  border: none;
  border-bottom: 1px solid var(--border);
  background: var(--surface);
  color: var(--text);
  font: inherit;
  text-align: left;
  padding: 0.3rem 0.5rem;
  cursor: pointer;
  min-height: 48px;
}
.result:hover {
  background: var(--hover);
}
.result.current {
  background: var(--hover);
  box-shadow: inset 3px 0 0 var(--accent);
}
.result:focus-visible {
  outline: 3px solid var(--accent);
  outline-offset: -3px;
}
.g {
  font-size: 32px;
  line-height: 1;
  text-align: center;
}
.main {
  display: grid;
  grid-template-columns: auto 1fr;
  column-gap: 0.5rem;
  min-width: 0;
}
.code {
  font-weight: 700;
}
.tr {
  font-weight: 600;
  color: var(--accent);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.desc {
  grid-column: 1 / -1;
  font-size: 0.78rem;
  color: var(--muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.meta {
  display: grid;
  justify-items: end;
  font-size: 0.7rem;
  color: var(--muted);
}
.ok {
  color: #2e7d32;
  font-weight: 700;
}
.todo {
  color: #b8860b;
  font-weight: 700;
}
.why {
  font-style: italic;
}
.foot {
  display: flex;
  flex-wrap: wrap;
  gap: 0.3rem;
}
</style>
