<script setup lang="ts">
/**
 * Saisie rapide : identifier les signes à la chaîne, au clavier.
 *
 *  1. une boîte est sélectionnée (ou vient d'être tracée) ;
 *  2. on tape un code (G17), une valeur (m, nfr, Htp) ou un mot (chouette) ;
 *  3. ↑/↓ choisissent parmi les propositions ; la photo et le glyphe sont
 *     comparés côte à côte ;
 *  4. Entrée attribue le signe et passe à la boîte suivante.
 *
 * Raccourcis dans la zone de saisie :
 *  - « ? » à la fin (ex. « G17? ») : statut « incertain »
 *  - « // » seul : lacune (signe détruit)
 *  - Entrée sur une saisie vide : passer à la boîte suivante
 *  - Maj+Entrée : attribuer sans avancer
 *  - Page suiv. / Page préc. : boîte suivante / précédente
 *  - Échap : vider la saisie, puis revenir à la photo
 *  - Ctrl+Z sur une saisie vide : annuler
 */
import { computed, nextTick, ref, watch } from 'vue'
import { useProjectStore } from '../../stores/project'
import { useUiStore } from '../../stores/ui'
import { useLibraryStore } from '../../stores/library'
import { useSelection } from '../../composables/useSelection'
import { useSignActions, STATUS_LABELS } from '../../composables/useSignActions'
import { searchSigns } from '../../core/search'
import { normalizeCode, unicodeFor, KIND_SHORT } from '../../core/gardiner'
import type { Sign } from '../../types/models'
import CompareView from './CompareView.vue'

const emit = defineEmits<{ (e: 'leave'): void }>()
const store = useProjectStore()
const ui = useUiStore()
const library = useLibraryStore()
const { single, selected } = useSelection()
const actions = useSignActions()

const input = ref<HTMLInputElement | null>(null)
const query = ref('')
const highlighted = ref(0)
const big = ref(false)

const isLacuna = computed(() => query.value.trim() === '//')
const uncertain = computed(() => /\?\s*$/.test(query.value))
const core = computed(() => query.value.replace(/\?\s*$/, '').trim())

const candidates = computed<Sign[]>(() => {
  if (!core.value || isLacuna.value) return []
  const found = searchSigns(library.signs, core.value).slice(0, 8).map((r) => r.sign)
  // Un code valide absent de la bibliothèque reste utilisable.
  const code = normalizeCode(core.value)
  if (code && !library.get(code)) {
    found.unshift({
      gardiner: code,
      unicode: unicodeFor(code),
      translit: [],
      kind: [],
      descriptionFr: '(absent de la bibliothèque)',
      category: '',
      verified: false,
    })
  }
  return found
})
const current = computed(() => candidates.value[highlighted.value] ?? null)

/** Glyphe montré dans la comparaison : la proposition en cours, sinon le signe attribué. */
const shown = computed(() => {
  if (current.value) return { glyph: current.value.unicode, code: current.value.gardiner }
  const code = single.value?.item.signCode
  return code ? { glyph: library.get(code)?.unicode ?? unicodeFor(code), code } : { glyph: '', code: '' }
})

watch(query, () => (highlighted.value = 0))
watch(
  () => ui.quickEntryFocus,
  async () => {
    await nextTick()
    input.value?.focus()
    input.value?.select()
  },
)
// Quand on change de boîte, on repart d'une saisie vide.
watch(
  () => single.value?.item.id,
  () => (query.value = ''),
)

function validate(advance: boolean) {
  const s = single.value
  if (!s) return
  if (isLacuna.value) {
    actions.assign(s.item.id, null, 'lacune')
  } else if (core.value) {
    const c = current.value
    if (!c) {
      ui.notify(`Aucun signe ne correspond à « ${core.value} ».`, 'error')
      return
    }
    actions.assign(s.item.id, c.gardiner, uncertain.value ? 'incertain' : undefined)
  }
  query.value = ''
  if (advance) actions.go(1)
}

function onKey(e: KeyboardEvent) {
  const n = candidates.value.length
  switch (e.key) {
    case 'ArrowDown':
      if (n) highlighted.value = (highlighted.value + 1) % n
      break
    case 'ArrowUp':
      if (n) highlighted.value = (highlighted.value - 1 + n) % n
      break
    case 'Enter':
      validate(!e.shiftKey)
      break
    case 'PageDown':
      actions.go(1)
      break
    case 'PageUp':
      actions.go(-1)
      break
    case 'Escape':
      if (query.value) query.value = ''
      else {
        input.value?.blur()
        emit('leave')
      }
      break
    case 'z':
    case 'Z':
      if ((e.ctrlKey || e.metaKey) && !query.value) {
        if (e.shiftKey) store.redo()
        else store.undo()
        break
      }
      return
    default:
      return
  }
  e.preventDefault()
  e.stopPropagation()
}

function pick(i: number) {
  highlighted.value = i
  validate(true)
  input.value?.focus()
}

const statusText = computed(() => (single.value ? STATUS_LABELS[single.value.item.status] : ''))
const activeId = computed(() => (current.value ? `qe-opt-${highlighted.value}` : undefined))
</script>

<template>
  <section class="quick" aria-label="Saisie rapide des signes">
    <template v-if="single">
      <CompareView
        :bbox="single.item.bbox"
        :glyph="shown.glyph"
        :code="shown.code"
        :mirror="single.line.direction === 'rtl'"
        :size="big ? 150 : 64"
      />
      <div class="entry">
        <div class="status-line">
          <span>
            <b>{{ single.line.orientation === 'column' ? 'C' : 'L' }}{{ single.line.number }}</b> · signe {{ single.index + 1 }}/{{ single.line.items.length }}
            · <span :class="['st', single.item.status]">{{ statusText }}</span>
          </span>
          <button class="link" type="button" :aria-pressed="big" @click="big = !big">{{ big ? 'Comparaison réduite' : 'Comparer en grand' }}</button>
        </div>
        <div class="combo">
          <label class="sr-only" for="quick-input">Code, valeur ou description du signe</label>
          <input
            id="quick-input"
            ref="input"
            v-model="query"
            type="text"
            role="combobox"
            autocomplete="off"
            spellcheck="false"
            aria-autocomplete="list"
            aria-controls="qe-list"
            :aria-expanded="candidates.length > 0"
            :aria-activedescendant="activeId"
            :placeholder="single.item.signCode ? `${single.item.signCode} — tapez pour changer, Entrée pour passer` : 'G17, m, nfr, chouette…  ( ? = incertain, // = lacune )'"
            @keydown="onKey"
          />
          <ul v-if="candidates.length" id="qe-list" class="list" role="listbox" aria-label="Propositions">
            <li
              v-for="(c, i) in candidates"
              :id="`qe-opt-${i}`"
              :key="c.gardiner"
              role="option"
              :aria-selected="i === highlighted"
              :class="{ active: i === highlighted }"
              @mousedown.prevent="pick(i)"
              @mouseenter="highlighted = i"
            >
              <span class="g glyph-text" aria-hidden="true"><span :class="{ mirror: single.line.direction === 'rtl' }">{{ c.unicode || '□' }}</span></span>
              <b>{{ c.gardiner }}</b>
              <span class="tr">{{ c.translit.join(', ') }}</span>
              <span class="d">{{ c.descriptionFr }}</span>
              <span class="k">{{ c.kind.map((k) => KIND_SHORT[k]).join(' ') }}</span>
            </li>
          </ul>
        </div>
        <p class="hint">
          <kbd>↑</kbd><kbd>↓</kbd> choisir · <kbd>Entrée</kbd> valider et passer à la suivante · <kbd>Maj</kbd>+<kbd>Entrée</kbd> sans avancer
          · <kbd>Page suiv.</kbd> boîte suivante · <code>?</code> incertain · <code>//</code> lacune
          <template v-if="uncertain"> — <b>sera marqué incertain</b></template>
          <template v-if="isLacuna"> — <b>sera marqué lacune</b></template>
        </p>
      </div>
    </template>
    <p v-else-if="selected.length > 1" class="empty">{{ selected.length }} boîtes sélectionnées : la saisie rapide porte sur une seule boîte.</p>
    <p v-else class="empty">
      Sélectionnez une boîte de signe pour l'identifier, ou tracez-en une avec l'outil <b>Boîte</b> (<kbd>B</kbd>).
      <button class="btn small" type="button" @click="actions.go(1)">Aller à la première boîte</button>
    </p>
  </section>
</template>

<style scoped>
.quick {
  display: flex;
  gap: 0.7rem;
  align-items: flex-start;
  padding: 0.5rem 0.7rem;
  background: var(--surface);
  border-top: 1px solid var(--border);
  font-size: 0.88rem;
}
.entry {
  flex: 1;
  min-width: 0;
  display: grid;
  gap: 0.3rem;
}
.status-line {
  display: flex;
  justify-content: space-between;
  gap: 0.5rem;
  font-size: 0.8rem;
  color: var(--muted);
}
.st.certain {
  color: #2e9d4a;
}
.st.probable {
  color: #2f7fd6;
}
.st.incertain {
  color: #c77700;
}
.st.lacune {
  color: var(--danger);
}
.combo {
  position: relative;
}
#quick-input {
  width: 100%;
  font: inherit;
  font-size: 1.05rem;
  padding: 0.45rem 0.6rem;
  border: 2px solid var(--border);
  border-radius: 8px;
  background: var(--bg);
  color: var(--text);
}
#quick-input:focus {
  border-color: var(--accent);
  outline: none;
}
.list {
  position: absolute;
  left: 0;
  right: 0;
  bottom: calc(100% + 4px);
  margin: 0;
  padding: 0.25rem;
  list-style: none;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 10px;
  box-shadow: var(--shadow);
  z-index: 30;
  max-height: 50vh;
  overflow-y: auto;
}
.list li {
  display: grid;
  grid-template-columns: 2.2rem 3.4rem 4.5rem minmax(0, 1fr) auto;
  gap: 0.4rem;
  align-items: center;
  padding: 0.25rem 0.4rem;
  border-radius: 6px;
  cursor: pointer;
}
.list li.active {
  background: var(--accent);
  color: var(--accent-text);
}
.list li.active .d,
.list li.active .k,
.list li.active .tr {
  color: inherit;
}
.g {
  font-size: 1.6rem;
  line-height: 1;
  text-align: center;
}
.tr {
  color: var(--accent);
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.d {
  color: var(--muted);
  font-size: 0.8rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.k {
  font-size: 0.7rem;
  color: var(--muted);
}
.hint {
  margin: 0;
  font-size: 0.72rem;
  color: var(--muted);
}
kbd,
code {
  font-family: var(--font-mono);
  font-size: 0.7rem;
  border: 1px solid var(--border);
  border-radius: 3px;
  padding: 0 0.25em;
  background: var(--bg);
}
.link {
  background: none;
  border: none;
  padding: 0;
  font: inherit;
  color: var(--accent);
  text-decoration: underline;
  cursor: pointer;
}
.empty {
  margin: 0;
  color: var(--muted);
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  align-items: center;
}
@media (max-width: 700px) {
  .quick {
    flex-direction: column;
  }
  .hint {
    display: none;
  }
}
</style>
