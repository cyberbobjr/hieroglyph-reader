<script setup lang="ts">
/**
 * Panneau « Lignes » : outils de tracé, liste des lignes, réglages de la
 * ligne sélectionnée (numéro, sens de lecture, orientation).
 */
import { computed, nextTick, ref, watch } from 'vue'
import { useProjectStore } from '../../stores/project'
import { useUiStore, type Tool } from '../../stores/ui'
import { reorderLine } from '../../core/items'
import { directionLabel, moveLine, renumber, renumberByPosition, setLineNumber, sortByNumber } from '../../core/lines'
import type { Direction, Line, Orientation } from '../../types/models'

const emit = defineEmits<{ (e: 'focus-line', id: string): void }>()
const store = useProjectStore()
const ui = useUiStore()

const lines = computed(() => sortByNumber(store.project?.lines ?? []))
const selected = computed(() => lines.value.find((l) => l.id === ui.selectedLineId) ?? null)
const listEl = ref<HTMLElement | null>(null)

// Quand on sélectionne une ligne sur la photo, on la fait défiler dans la liste.
watch(
  () => ui.selectedLineId,
  async (id) => {
    await nextTick()
    listEl.value?.querySelector<HTMLElement>(`[data-line="${id}"]`)?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
  },
)

function setTool(t: Tool) {
  ui.tool = ui.tool === t ? 'pan' : t
}

function select(l: Line) {
  ui.selectedLineId = l.id
  emit('focus-line', l.id)
}

function setDirection(l: Line, d: Direction) {
  if (l.direction === d) return
  if (l.manualOrder && l.items.length)
    ui.notify(`L'ordre des signes de la ligne ${l.number} a été corrigé à la main : il n'est pas recalculé. (Panneau Signe : « Revenir à l'ordre automatique »)`, 'info', 7000)
  // Le sens change l'ordre de lecture des signes : on le recalcule (sauf ordre manuel).
  store.mutateLine(l.id, `Sens de la ligne ${l.number}`, (x, p) => {
    x.direction = d
    reorderLine(p, x)
  })
}
function setOrientation(l: Line, o: Orientation) {
  if (l.orientation === o) return
  store.mutateLine(l.id, `Orientation de la ligne ${l.number}`, (x, p) => {
    x.orientation = o
    reorderLine(p, x)
  })
}
function changeNumber(l: Line, value: string) {
  const n = parseInt(value, 10)
  if (!Number.isInteger(n) || n < 1 || n === l.number) return
  store.mutate(`Numéro de la ligne ${l.number} → ${n}`, (p) => setLineNumber(p.lines, l.id, n))
}
function move(l: Line, delta: -1 | 1) {
  store.mutate(`Déplacer la ligne ${l.number} dans la liste`, (p) => moveLine(p.lines, l.id, delta))
}
function remove(l: Line) {
  const n = l.items.length
  if (n && !confirm(`La ligne ${l.number} contient ${n} signe(s). La supprimer quand même ?`)) return
  store.mutate(`Supprimer la ligne ${l.number}`, (p) => {
    p.lines = p.lines.filter((x) => x.id !== l.id)
    p.groups = p.groups.filter((g) => g.lineId !== l.id)
  })
  if (ui.selectedLineId === l.id) ui.selectedLineId = null
}
function renumberAll(byPosition: boolean) {
  store.mutate(byPosition ? 'Renuméroter selon la position' : 'Renuméroter 1, 2, 3…', (p) =>
    byPosition ? renumberByPosition(p.lines) : renumber(p.lines),
  )
}
function applyDirectionToAll(d: Direction) {
  store.mutate(`Sens ${d === 'rtl' ? 'droite → gauche' : 'gauche → droite'} pour toutes les lignes`, (p) =>
    p.lines.forEach((l) => {
      l.direction = d
      reorderLine(p, l)
    }),
  )
}

const arrow = (l: Pick<Line, 'direction' | 'orientation'>) =>
  l.orientation === 'column' ? '↓' : l.direction === 'rtl' ? '←' : '→'

defineExpose({ remove })
</script>

<template>
  <div class="line-panel">
    <section aria-labelledby="draw-title">
      <h2 id="draw-title">Outils</h2>
      <div class="tools" role="toolbar" aria-label="Outils de tracé">
        <button class="btn" type="button" :aria-pressed="ui.tool === 'line-rect'" title="Rectangle (R)" @click="setTool('line-rect')">
          ▭ Rectangle
        </button>
        <button class="btn" type="button" :aria-pressed="ui.tool === 'line-poly'" title="Polygone (G)" @click="setTool('line-poly')">
          ⬠ Polygone
        </button>
        <button class="btn" type="button" :aria-pressed="ui.tool === 'sign-box'" :disabled="!lines.length" title="Boîte autour d'un signe (B)" @click="setTool('sign-box')">
          ⬚ Boîte de signe
        </button>
        <button class="btn" type="button" :aria-pressed="ui.tool === 'pan'" title="Déplacer / sélectionner (V)" @click="ui.tool = 'pan'">
          ✋ Sélection
        </button>
      </div>
      <div class="default-dir">
        <span id="dir-label">Sens des nouvelles lignes :</span>
        <div class="seg" role="radiogroup" aria-labelledby="dir-label">
          <button type="button" role="radio" :aria-checked="ui.defaultDirection === 'rtl'" @click="ui.defaultDirection = 'rtl'">← droite à gauche</button>
          <button type="button" role="radio" :aria-checked="ui.defaultDirection === 'ltr'" @click="ui.defaultDirection = 'ltr'">gauche à droite →</button>
        </div>
      </div>
      <p class="tip">
        <strong>Astuce :</strong> les signes (oiseaux, personnages…) <em>regardent vers le début</em> de la ligne.
        S'ils regardent vers la droite, on lit de droite à gauche.
      </p>
    </section>

    <section aria-labelledby="list-title">
      <div class="list-head">
        <h2 id="list-title">Lignes <span class="count">({{ lines.length }})</span></h2>
      </div>
      <p v-if="!lines.length" class="empty">
        Aucune ligne. Choisissez « Rectangle » ou « Polygone » puis tracez sur la photo
        le contour de la première ligne (ou colonne) de texte.
      </p>

      <ol ref="listEl" class="list">
        <li v-for="l in lines" :key="l.id" :data-line="l.id" :class="{ selected: l.id === ui.selectedLineId }">
          <div class="row-main">
            <button
              class="pick"
              type="button"
              :aria-current="l.id === ui.selectedLineId ? 'true' : undefined"
              :title="`Sélectionner et cadrer la ligne ${l.number}`"
              @click="select(l)"
            >
              <span class="num">{{ l.orientation === 'column' ? 'C' : 'L' }}{{ l.number }}</span>
              <span class="dir" aria-hidden="true">{{ arrow(l) }}</span>
              <span class="desc">{{ directionLabel(l) }}</span>
              <span class="sr-only">, {{ l.items.length }} signe(s)</span>
            </button>
            <span class="signs" aria-hidden="true">{{ l.items.length }} s.</span>
          </div>

          <div v-if="l.id === ui.selectedLineId" class="details">
            <label class="field">
              <span>Numéro</span>
              <input type="number" min="1" step="1" :value="l.number" @change="changeNumber(l, ($event.target as HTMLInputElement).value)" />
            </label>
            <div class="field">
              <span :id="`dir-${l.id}`">Sens</span>
              <div class="seg" role="radiogroup" :aria-labelledby="`dir-${l.id}`">
                <button type="button" role="radio" :aria-checked="l.direction === 'rtl'" @click="setDirection(l, 'rtl')">← vers la gauche</button>
                <button type="button" role="radio" :aria-checked="l.direction === 'ltr'" @click="setDirection(l, 'ltr')">vers la droite →</button>
              </div>
            </div>
            <div class="field">
              <span :id="`ori-${l.id}`">Type</span>
              <div class="seg" role="radiogroup" :aria-labelledby="`ori-${l.id}`">
                <button type="button" role="radio" :aria-checked="l.orientation === 'row'" @click="setOrientation(l, 'row')">Ligne</button>
                <button type="button" role="radio" :aria-checked="l.orientation === 'column'" @click="setOrientation(l, 'column')">Colonne ↓</button>
              </div>
            </div>
            <p v-if="l.orientation === 'column'" class="hint">
              Une colonne se lit de haut en bas. Le sens indique dans quel ordre se suivent les colonnes
              (et vers où regardent les signes).
            </p>
            <p class="hint">
              Forme : {{ l.geometry.type === 'rect' ? 'rectangle' : `polygone (${l.geometry.points.length} sommets)` }}.
              Glissez la pastille <b>✥</b> pour déplacer, les carrés jaunes pour déformer<template v-if="l.geometry.type === 'polygon'">,
              les ronds pour ajouter un sommet, double-clic sur un sommet pour le retirer</template>.
            </p>
            <div class="actions">
              <button class="btn small" type="button" :disabled="l.number === lines[0]?.number" aria-label="Monter dans l'ordre" @click="move(l, -1)">↑ Monter</button>
              <button class="btn small" type="button" :disabled="l.number === lines[lines.length - 1]?.number" aria-label="Descendre dans l'ordre" @click="move(l, 1)">↓ Descendre</button>
              <button class="btn small" type="button" @click="emit('focus-line', l.id)">Cadrer</button>
              <button class="btn small danger" type="button" @click="remove(l)">Supprimer</button>
            </div>
          </div>
        </li>
      </ol>

      <details v-if="lines.length > 1" class="bulk">
        <summary>Actions sur toutes les lignes</summary>
        <div class="actions">
          <button class="btn small" type="button" @click="renumberAll(true)">Renuméroter selon la position</button>
          <button class="btn small" type="button" @click="renumberAll(false)">Combler les trous (1, 2, 3…)</button>
          <button class="btn small" type="button" @click="applyDirectionToAll('rtl')">Toutes ← droite à gauche</button>
          <button class="btn small" type="button" @click="applyDirectionToAll('ltr')">Toutes gauche à droite →</button>
        </div>
      </details>
    </section>
    <p v-if="selected" class="sr-only" aria-live="polite">Ligne {{ selected.number }} sélectionnée</p>
  </div>
</template>

<style scoped>
.line-panel {
  display: grid;
  /* minmax(0, …) : empêche un texte long d'élargir le panneau */
  grid-template-columns: minmax(0, 1fr);
  gap: 1rem;
  font-size: 0.9rem;
}
.line-panel section {
  min-width: 0;
}
h2 {
  margin: 0 0 0.5rem;
  font-size: 1rem;
}
.count {
  color: var(--muted);
  font-weight: normal;
}
.tools {
  display: flex;
  flex-wrap: wrap;
  gap: 0.3rem;
}
.default-dir {
  margin-top: 0.6rem;
  display: grid;
  gap: 0.3rem;
}
.seg {
  display: inline-flex;
  max-width: 100%;
  border: 1px solid var(--border);
  border-radius: 8px;
  overflow: hidden;
}
.seg button {
  font: inherit;
  font-size: 0.82rem;
  border: none;
  background: var(--surface);
  color: var(--text);
  padding: 0.35rem 0.55rem;
  cursor: pointer;
  min-height: 32px;
}
.seg button + button {
  border-left: 1px solid var(--border);
}
.seg button[aria-checked='true'] {
  background: var(--accent);
  color: var(--accent-text);
}
.tip,
.hint,
.empty {
  color: var(--muted);
  font-size: 0.82rem;
  margin: 0.5rem 0 0;
}
.list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 0.3rem;
}
.list li {
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--surface);
}
.list li.selected {
  border-color: var(--accent);
  box-shadow: 0 0 0 1px var(--accent);
}
.row-main {
  display: flex;
  align-items: center;
}
.pick {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  background: none;
  border: none;
  font: inherit;
  color: var(--text);
  text-align: left;
  padding: 0.45rem 0.55rem;
  cursor: pointer;
  min-height: 40px;
  min-width: 0;
}
.pick:hover {
  background: var(--hover);
}
.num {
  font-weight: 700;
  min-width: 2.4em;
}
.dir {
  font-size: 1.1rem;
  color: var(--accent);
}
.desc {
  color: var(--muted);
  font-size: 0.8rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.signs {
  color: var(--muted);
  font-size: 0.75rem;
  padding-right: 0.55rem;
}
.details {
  border-top: 1px solid var(--border);
  padding: 0.55rem;
  display: grid;
  gap: 0.5rem;
}
.field {
  display: grid;
  gap: 0.2rem;
  justify-items: start;
}
.field > span {
  color: var(--muted);
  font-size: 0.8rem;
}
.field input {
  width: 5em;
  font: inherit;
  padding: 0.25rem 0.4rem;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: var(--surface);
  color: var(--text);
}
.details .hint {
  margin: 0;
}
.actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.3rem;
}
.bulk {
  margin-top: 0.6rem;
}
.bulk summary {
  cursor: pointer;
  color: var(--muted);
  margin-bottom: 0.4rem;
}
</style>
