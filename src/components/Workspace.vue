<script setup lang="ts">
/**
 * Espace de travail d'une stèle :
 *   [ Lignes & signes ] [ Visionneuse ] [ Bibliothèque ]
 * Sur un écran étroit (tablette en portrait), les panneaux latéraux
 * deviennent des tiroirs qu'on ouvre avec les boutons de la barre.
 */
import { computed, nextTick, ref } from 'vue'
import { useProjectStore } from '../stores/project'
import { useHistoryStore } from '../stores/history'
import { useUiStore } from '../stores/ui'
import { useProjectsStore } from '../stores/projects'
import { useShortcuts } from '../composables/useShortcuts'
import ImageViewer from './viewer/ImageViewer.vue'
import FilterPanel from './viewer/FilterPanel.vue'
import LinePanel from './lines/LinePanel.vue'
import LibraryPanel from './library/LibraryPanel.vue'

const emit = defineEmits<{ (e: 'close'): void }>()
const store = useProjectStore()
const history = useHistoryStore()
const ui = useUiStore()
const projects = useProjectsStore()

const viewer = ref<InstanceType<typeof ImageViewer> | null>(null)
const linePanel = ref<InstanceType<typeof LinePanel> | null>(null)
const libraryPanel = ref<InstanceType<typeof LibraryPanel> | null>(null)
// Sur un écran étroit, les tiroirs sont fermés au départ pour laisser voir la photo.
const wide = window.matchMedia('(min-width: 1001px)').matches
const leftOpen = ref(wide)
const rightOpen = ref(wide)

const saveLabel = computed(
  () => ({ saved: 'Enregistré', pending: 'Modifications…', saving: 'Enregistrement…', error: 'Erreur d’enregistrement' })[store.saveState],
)

function rename() {
  const name = prompt('Nom de la stèle :', store.project!.name)
  if (name !== null && name.trim()) store.mutate('Renommer la stèle', (p) => (p.name = name.trim()))
}

function togglePerspective() {
  ui.tool = ui.tool === 'perspective' ? 'pan' : 'perspective'
}

function setTool(t: typeof ui.tool) {
  ui.tool = ui.tool === t ? 'pan' : t
  // Sur petit écran, on ouvre le panneau des lignes pour voir le résultat.
  if (t !== 'pan' && t !== 'perspective' && !leftOpen.value && wide) leftOpen.value = true
}

function deleteSelectedLine() {
  const l = store.project?.lines.find((x) => x.id === ui.selectedLineId)
  if (l) linePanel.value?.remove(l)
}

async function focusLibrarySearch() {
  rightOpen.value = true
  await nextTick()
  libraryPanel.value?.focusSearch()
}

function focusLine(id: string) {
  viewer.value?.focusLine(id)
}

async function exportProject() {
  await store.flush()
  await projects.exportToFile(store.project!.id)
}

useShortcuts(() => [
  { combo: 'mod+z', handler: () => store.undo() },
  { combo: 'mod+shift+z', handler: () => store.redo() },
  { combo: 'mod+y', handler: () => store.redo() },
  { combo: 'mod+s', handler: () => void store.flush().then(() => ui.notify('Enregistré.')), inInputs: true },
  { combo: 'l', handler: () => (ui.magnifier = !ui.magnifier) },
  { combo: 'p', handler: togglePerspective },
  { combo: 'v', handler: () => (ui.tool = 'pan') },
  { combo: 'r', handler: () => setTool('line-rect') },
  { combo: 'g', handler: () => setTool('line-poly') },
  { combo: 'delete', handler: deleteSelectedLine },
  { combo: 'backspace', handler: deleteSelectedLine },
  { combo: 'f', handler: () => (ui.filtersOpen = !ui.filtersOpen) },
  { combo: '?', handler: () => (ui.helpOpen = true) },
  { combo: '/', handler: () => void focusLibrarySearch() },
  { combo: '0', handler: () => viewer.value?.fit() },
  { combo: '+', handler: () => viewer.value?.zoomAt(1.25) },
  { combo: '=', handler: () => viewer.value?.zoomAt(1.25) },
  { combo: '-', handler: () => viewer.value?.zoomAt(0.8) },
  {
    combo: 'escape',
    handler: () => {
      if (ui.helpOpen) ui.helpOpen = false
      else if (ui.filtersOpen) ui.filtersOpen = false
      else if (ui.tool !== 'pan') ui.tool = 'pan'
      else ui.selectedLineId = null
    },
    inInputs: true,
  },
])
</script>

<template>
  <div class="workspace">
    <header class="topbar">
      <button class="btn" type="button" title="Retour à la liste des stèles" @click="emit('close')">← Stèles</button>
      <h1 class="title">
        <button class="link" type="button" title="Renommer" @click="rename">{{ store.project?.name }}</button>
      </h1>
      <span class="save" :class="store.saveState" role="status">{{ saveLabel }}</span>

      <div class="spacer" />

      <div class="group" role="group" aria-label="Historique">
        <button class="btn" type="button" :disabled="!history.canUndo" :title="`Annuler ${history.undoLabel} (Ctrl+Z)`" @click="store.undo()">↶ Annuler</button>
        <button class="btn" type="button" :disabled="!history.canRedo" :title="`Rétablir ${history.redoLabel} (Ctrl+Maj+Z)`" @click="store.redo()">↷ Rétablir</button>
      </div>
      <div class="group" role="toolbar" aria-label="Outils d'image">
        <button class="btn" type="button" :aria-pressed="ui.tool === 'perspective'" title="Correction de perspective (P)" @click="togglePerspective">Perspective</button>
        <button class="btn" type="button" :aria-pressed="ui.filtersOpen" aria-controls="filters-popover" title="Filtres (F)" @click="ui.filtersOpen = !ui.filtersOpen">Filtres</button>
        <button class="btn" type="button" :aria-pressed="ui.magnifier" title="Loupe (L)" @click="ui.magnifier = !ui.magnifier">Loupe</button>
        <label v-if="ui.magnifier" class="zoomsel">
          <span class="sr-only">Grossissement de la loupe</span>
          <select v-model.number="ui.magnifierZoom">
            <option v-for="z in [2, 3, 4, 6, 8]" :key="z" :value="z">×{{ z }}</option>
          </select>
        </label>
      </div>
      <div class="group">
        <button class="btn" type="button" :aria-pressed="leftOpen" @click="leftOpen = !leftOpen">Lignes</button>
        <button class="btn" type="button" :aria-pressed="rightOpen" @click="rightOpen = !rightOpen">Signes</button>
        <button class="btn" type="button" title="Exporter le projet complet (JSON)" @click="exportProject">Exporter</button>
        <button class="btn icon" type="button" aria-label="Aide et raccourcis" title="Aide (?)" @click="ui.helpOpen = true">?</button>
      </div>
    </header>

    <div class="body">
      <aside v-if="leftOpen" class="side left panel-flat" aria-label="Lignes et signes">
        <LinePanel ref="linePanel" @focus-line="focusLine" />
      </aside>

      <section class="center" aria-label="Visionneuse">
        <ImageViewer v-if="store.project" ref="viewer" :key="store.project.id" />
        <div v-if="ui.filtersOpen" id="filters-popover" class="popover">
          <FilterPanel />
        </div>
      </section>

      <aside v-if="rightOpen" class="side right panel-flat" aria-label="Bibliothèque de signes">
        <LibraryPanel ref="libraryPanel" />
      </aside>
    </div>
  </div>
</template>

<style scoped>
.workspace {
  display: flex;
  flex-direction: column;
  height: 100%;
}
.topbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem;
  padding: 0.45rem 0.6rem;
  background: var(--surface);
  border-bottom: 1px solid var(--border);
}
.title {
  margin: 0;
  font-size: 1.05rem;
  min-width: 0;
}
.link {
  background: none;
  border: none;
  font: inherit;
  font-weight: 600;
  color: var(--text);
  cursor: pointer;
  padding: 0.2rem 0.3rem;
  border-radius: 6px;
  max-width: 28ch;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.link:hover {
  background: var(--hover);
}
.save {
  font-size: 0.78rem;
  color: var(--muted);
}
.save.error {
  color: var(--danger);
}
.spacer {
  flex: 1;
}
.group {
  display: flex;
  gap: 0.3rem;
  align-items: center;
}
.zoomsel select {
  padding: 0.35rem;
  border-radius: 6px;
  border: 1px solid var(--border);
  background: var(--surface);
  color: var(--text);
}
.body {
  flex: 1;
  display: flex;
  min-height: 0;
  position: relative;
}
.center {
  flex: 1;
  position: relative;
  min-width: 0;
}
.side {
  width: 300px;
  flex: 0 0 auto;
  overflow-x: clip;
  overflow-y: auto;
  padding: 0.8rem;
  background: var(--surface);
}
.side.left {
  border-right: 1px solid var(--border);
}
.side.right {
  border-left: 1px solid var(--border);
  width: 340px;
}
.side h2 {
  margin: 0 0 0.5rem;
  font-size: 1rem;
}
.todo {
  color: var(--muted);
  font-size: 0.9rem;
}
.popover {
  position: absolute;
  top: 12px;
  right: 12px;
  z-index: 15;
}
/* Tablette en portrait / petit écran : panneaux en tiroirs superposés. */
@media (max-width: 1000px) {
  .side {
    position: absolute;
    top: 0;
    bottom: 0;
    z-index: 12;
    box-shadow: var(--shadow);
    width: min(320px, 85vw);
  }
  .side.left {
    left: 0;
  }
  .side.right {
    right: 0;
  }
}
</style>
