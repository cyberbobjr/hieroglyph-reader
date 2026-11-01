<script setup lang="ts">
/**
 * Visionneuse : affiche l'image de travail, gère le zoom/déplacement,
 * la correction de perspective et la loupe.
 *
 * Organisation à l'écran (de bas en haut) :
 *   1. un <canvas> qui contient l'image, déplacé/agrandi par une
 *      transformation CSS (très fluide, calculée par la carte graphique) ;
 *   2. un calque SVG par-dessus, pour les poignées, lignes et boîtes ;
 *   3. la loupe et les boutons flottants.
 */
import { computed, nextTick, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'
import { useProjectStore } from '../../stores/project'
import { useUiStore } from '../../stores/ui'
import { usePanZoom } from '../../composables/usePanZoom'
import { ImagePipeline } from '../../core/imagePipeline'
import { decodeImage } from '../../core/imageLoading'
import { cssFilterString } from '../../core/imageOps'
import { estimateAspectRatio, isConvexQuad, rectifiedSize } from '../../core/homography'
import { clone } from '../../core/ids'
import type { Point, Quad } from '../../types/models'
import Magnifier from './Magnifier.vue'
import PerspectiveEditor from './PerspectiveEditor.vue'

const store = useProjectStore()
const ui = useUiStore()

const stage = ref<HTMLElement | null>(null)
const canvas = ref<HTMLCanvasElement | null>(null)
const content = ref({ width: 0, height: 0 })
const stageSize = ref({ width: 0, height: 0 })
const busy = ref(false)
const ready = ref(false)
const renderVersion = ref(0)
const pipeline = shallowRef<ImagePipeline | null>(null)

const { view, fit, zoomAt, actualSize, panBy } = usePanZoom(stage, content, {
  singlePointerPans: () => true,
})

const filters = computed(() => store.project!.filters)
const cssFilter = computed(() => cssFilterString(filters.value))
const editingPerspective = computed(() => ui.tool === 'perspective')

// --- Chargement de l'image dans le worker --------------------------------
async function loadImage() {
  ready.value = false
  const blob = store.imageBlob
  if (!blob) return
  busy.value = true
  try {
    pipeline.value?.dispose()
    pipeline.value = new ImagePipeline()
    await pipeline.value.load(await decodeImage(blob))
    ready.value = true
    await render(true)
  } catch (e) {
    ui.notify(`Impossible de lire l'image : ${(e as Error).message}`, 'error', 8000)
  } finally {
    busy.value = false
  }
}

// --- Calcul de l'image de travail (perspective + filtres lourds) ---------
const renderKey = computed(() => {
  const p = store.project
  if (!p) return ''
  return JSON.stringify({
    perspective: editingPerspective.value ? null : p.perspective,
    autoContrast: p.filters.autoContrast,
    relief: p.filters.relief,
    reliefMode: p.filters.reliefMode,
  })
})

async function render(refit = false) {
  const p = store.project
  if (!pipeline.value || !ready.value || !p) return
  busy.value = true
  try {
    const bitmap = await pipeline.value.render({
      perspective: editingPerspective.value ? null : p.perspective,
      autoContrast: p.filters.autoContrast,
      relief: p.filters.relief,
      reliefMode: p.filters.reliefMode,
    })
    if (!bitmap || !canvas.value) return
    const sizeChanged = bitmap.width !== content.value.width || bitmap.height !== content.value.height
    canvas.value.width = bitmap.width
    canvas.value.height = bitmap.height
    canvas.value.getContext('2d')!.drawImage(bitmap, 0, 0)
    bitmap.close()
    content.value = { width: canvas.value.width, height: canvas.value.height }
    renderVersion.value++
    if (refit || sizeChanged || perspectiveFitPending) {
      await nextTick()
      fit()
      if (perspectiveFitPending) zoomAt(PERSPECTIVE_ZOOM_OUT)
      perspectiveFitPending = false
    }
  } catch (e) {
    ui.notify(`Erreur de traitement : ${(e as Error).message}`, 'error', 6000)
  } finally {
    busy.value = false
  }
}

let renderTimer: ReturnType<typeof setTimeout> | undefined
watch(renderKey, () => {
  clearTimeout(renderTimer)
  renderTimer = setTimeout(() => void render(), 120)
})
watch(() => store.imageBlob, loadImage)

// --- Taille de la zone d'affichage ----------------------------------------
let resizeObs: ResizeObserver | undefined
onMounted(() => {
  resizeObs = new ResizeObserver(([entry]) => {
    const first = stageSize.value.width === 0
    stageSize.value = { width: entry.contentRect.width, height: entry.contentRect.height }
    if (first && content.value.width) fit()
  })
  if (stage.value) resizeObs.observe(stage.value)
  void loadImage()
})
onBeforeUnmount(() => {
  resizeObs?.disconnect()
  pipeline.value?.dispose()
  clearTimeout(renderTimer)
})

// --- Correction de perspective --------------------------------------------
const draft = ref<Quad | null>(null)
/** En mode perspective, on recule un peu pour pouvoir placer des coins hors de la photo. */
const PERSPECTIVE_ZOOM_OUT = 0.7
let perspectiveFitPending = false

/**
 * Proportions du résultat (largeur ÷ hauteur) :
 *  - auto : calculées à partir de la forme des 4 coins ;
 *  - dims : déduites des dimensions réelles de la stèle, si on les connaît ;
 *  - manual : réglées au curseur, en regardant le résultat.
 */
type AspectMode = 'auto' | 'dims' | 'manual'
const aspectMode = ref<AspectMode>('auto')
const manualAspect = ref(1)
const realWidth = ref<number | null>(null)
const realHeight = ref<number | null>(null)

const autoAspect = computed(() =>
  draft.value && isConvexQuad(draft.value)
    ? estimateAspectRatio(draft.value, content.value.width, content.value.height)
    : 1,
)
const effectiveAspect = computed(() => {
  if (aspectMode.value === 'manual') return manualAspect.value
  if (aspectMode.value === 'dims' && realWidth.value && realHeight.value) return realWidth.value / realHeight.value
  return autoAspect.value
})
const outputSize = computed(() =>
  draft.value && draftValid.value ? rectifiedSize(draft.value, effectiveAspect.value) : null,
)
/** Curseur sur une échelle logarithmique : autant de course pour ×2 que pour ÷2. */
const aspectSlider = computed({
  get: () => Math.log(manualAspect.value),
  set: (v: number) => (manualAspect.value = Math.exp(v)),
})
const fmtRatio = (r: number) => r.toLocaleString('fr-FR', { maximumFractionDigits: 2, minimumFractionDigits: 2 })
/** Petit rectangle d'aperçu des proportions finales. */
const previewBox = computed(() => {
  const r = effectiveAspect.value
  const max = 32
  return r >= 1 ? { width: max, height: max / r } : { width: max * r, height: max }
})

function setAspectMode(m: AspectMode) {
  // En passant en manuel, on part de la valeur actuelle pour ne pas « sauter ».
  if (m === 'manual' && aspectMode.value !== 'manual') manualAspect.value = effectiveAspect.value
  aspectMode.value = m
}

function defaultQuad(): Quad {
  const w = store.project!.image!.width
  const h = store.project!.image!.height
  const mx = w * 0.08
  const my = h * 0.08
  return [
    { x: mx, y: my },
    { x: w - mx, y: my },
    { x: w - mx, y: h - my },
    { x: mx, y: h - my },
  ]
}

watch(
  editingPerspective,
  (on) => {
    draft.value = on ? clone(store.project!.perspective?.corners ?? defaultQuad()) : null
    if (!on) return
    const saved = store.project!.perspective?.aspect
    aspectMode.value = saved ? 'manual' : 'auto'
    if (saved) manualAspect.value = saved
    // Si l'image affichée change (on repasse à l'original), le recul se fera après le calcul.
    if (store.project!.perspective) perspectiveFitPending = true
    else
      void nextTick(() => {
        fit()
        zoomAt(PERSPECTIVE_ZOOM_OUT)
      })
  },
  { immediate: true },
)

function updateCorner(i: number, p: Point) {
  if (draft.value) draft.value[i] = p
}

const draftValid = computed(() => !!draft.value && isConvexQuad(draft.value))

function applyPerspective() {
  if (!draft.value || !draftValid.value) return
  const p = store.project!
  if (p.lines.length && !confirm(
    'Des lignes ont déjà été tracées sur l’image redressée actuelle. Modifier la perspective va les décaler. Continuer ?',
  )) return
  const corners = clone(draft.value)
  const aspect = effectiveAspect.value
  const size = rectifiedSize(corners, aspect)
  store.mutate('Correction de perspective', (proj) => {
    proj.perspective = { corners, ...size }
    // On mémorise un choix manuel ; en automatique, il sera recalculé.
    if (aspectMode.value !== 'auto') proj.perspective.aspect = aspect
  })
  ui.tool = 'pan'
  ui.notify('Perspective corrigée.')
}

function removePerspective() {
  const p = store.project!
  if (p.lines.length && !confirm('Supprimer la correction décalera les lignes déjà tracées. Continuer ?')) return
  store.mutate('Supprimer la correction de perspective', (proj) => {
    proj.perspective = null
  })
  ui.tool = 'pan'
}

// --- Loupe ------------------------------------------------------------------
const pointer = ref<{ at: Point; touch: boolean; down: boolean } | null>(null)
const handleDrag = ref<{ at: Point; touch: boolean } | null>(null)

function localPoint(e: MouseEvent): Point {
  const r = stage.value!.getBoundingClientRect()
  return { x: e.clientX - r.left, y: e.clientY - r.top }
}
function onStageMove(e: PointerEvent) {
  pointer.value = { at: localPoint(e), touch: e.pointerType === 'touch', down: e.buttons > 0 }
}
function onStageLeave(e: PointerEvent) {
  if (e.pointerType !== 'touch') pointer.value = null
}
function onStageUp(e: PointerEvent) {
  if (e.pointerType === 'touch') pointer.value = null
}
function onHandleDrag(active: boolean, at?: Point, pointerType?: string) {
  handleDrag.value = active && at ? { at, touch: pointerType === 'touch' } : null
}

const loupe = computed(() => {
  if (handleDrag.value) return handleDrag.value // toujours visible quand on place un coin
  if (!ui.magnifier || !pointer.value) return null
  if (pointer.value.touch && !pointer.value.down) return null
  return pointer.value
})

// --- Clavier (quand la visionneuse a le focus) -----------------------------
function onKeydown(e: KeyboardEvent) {
  const step = e.shiftKey ? 200 : 50
  const actions: Record<string, () => void> = {
    ArrowLeft: () => panBy(step, 0),
    ArrowRight: () => panBy(-step, 0),
    ArrowUp: () => panBy(0, step),
    ArrowDown: () => panBy(0, -step),
    '+': () => zoomAt(1.25),
    '=': () => zoomAt(1.25),
    '-': () => zoomAt(0.8),
    '0': () => fit(),
    '1': () => actualSize(),
  }
  const a = actions[e.key]
  if (a && !e.ctrlKey && !e.metaKey && !e.altKey) {
    e.preventDefault()
    e.stopPropagation() // évite que le raccourci global s'applique une 2e fois
    a()
  }
}

const worldStyle = computed(() => ({
  transform: `translate(${view.x}px, ${view.y}px) scale(${view.scale})`,
}))
const zoomPercent = computed(() => Math.round(view.scale * 100))

defineExpose({ fit, zoomAt })
</script>

<template>
  <div class="viewer">
    <div v-if="editingPerspective" class="perspective-bar" role="region" aria-label="Correction de perspective">
      <div class="pb-row">
        <p class="pb-help">
          Placez les 4 poignées sur les <strong>coins de la stèle</strong>&nbsp;<span class="muted">— elles peuvent sortir de la photo ; dézoomez pour avoir de la place.</span>
        </p>
        <div class="pb-actions">
          <button class="btn primary" type="button" :disabled="!draftValid" @click="applyPerspective">Appliquer</button>
          <button class="btn" type="button" @click="draft = defaultQuad()">Réinitialiser</button>
          <button v-if="store.project?.perspective" class="btn danger" type="button" @click="removePerspective">
            Supprimer la correction
          </button>
          <button class="btn" type="button" @click="ui.tool = 'pan'">Annuler</button>
        </div>
      </div>
      <p v-if="!draftValid" class="warn">Les 4 coins doivent former un quadrilatère sans croisement.</p>
      <div v-else class="pb-row aspect" role="group" aria-labelledby="aspect-label">
        <span id="aspect-label" class="pb-label">Proportions</span>
        <label class="sr-only" for="aspect-mode">Mode de calcul des proportions</label>
        <select id="aspect-mode" :value="aspectMode" @change="setAspectMode(($event.target as HTMLSelectElement).value as AspectMode)">
          <option value="auto">Automatiques ({{ fmtRatio(autoAspect) }})</option>
          <option value="dims">Dimensions réelles connues</option>
          <option value="manual">Réglage manuel</option>
        </select>
        <template v-if="aspectMode === 'dims'">
          <label>Largeur <input v-model.number="realWidth" type="number" min="0" step="any" inputmode="decimal" /></label>
          <span aria-hidden="true">×</span>
          <label>Hauteur <input v-model.number="realHeight" type="number" min="0" step="any" inputmode="decimal" /></label>
          <span class="muted">(toute unité)</span>
        </template>
        <span v-if="aspectMode === 'manual'" class="manual">
          <span class="muted" aria-hidden="true">plus haute</span>
          <input
            v-model.number="aspectSlider"
            type="range"
            :min="Math.log(0.2)"
            :max="Math.log(5)"
            step="0.005"
            aria-label="Proportions largeur sur hauteur"
            :aria-valuetext="fmtRatio(manualAspect)"
          />
          <span class="muted" aria-hidden="true">plus large</span>
        </span>
        <span class="aspect-preview" aria-hidden="true">
          <span class="box" :style="{ width: previewBox.width + 'px', height: previewBox.height + 'px' }" />
        </span>
        <span class="muted small" aria-live="polite">
          largeur ÷ hauteur = <strong>{{ fmtRatio(effectiveAspect) }}</strong>
          <template v-if="outputSize"> · {{ outputSize.width }} × {{ outputSize.height }} px</template>
        </span>
      </div>
    </div>
    <div class="stage-wrap">
      <div
        ref="stage"
        class="stage"
        tabindex="0"
        role="application"
        aria-roledescription="visionneuse d'image"
        aria-label="Photo de la stèle. Flèches pour déplacer, + et − pour zoomer, 0 pour ajuster."
        @keydown="onKeydown"
        @pointermove="onStageMove"
        @pointerleave="onStageLeave"
        @pointerup="onStageUp"
        @dblclick="zoomAt(2, localPoint($event).x, localPoint($event).y)"
      >
        <div class="world" :style="worldStyle">
          <canvas
            ref="canvas"
            :class="{ pixelated: view.scale > 3 }"
            :style="{ filter: cssFilter }"
          />
        </div>

        <svg class="overlay" :width="stageSize.width" :height="stageSize.height">
          <PerspectiveEditor
            v-if="editingPerspective && draft && store.project?.image"
            :corners="draft"
            :view="view"
            :image-width="content.width"
            :image-height="content.height"
            @update="updateCorner"
            @drag="onHandleDrag"
          />
        </svg>

        <Magnifier
          v-if="loupe"
          :source="canvas"
          :at="loupe.at"
          :touch="loupe.touch"
          :view="view"
          :zoom="ui.magnifierZoom"
          :filter="cssFilter"
          :stage-width="stageSize.width"
          :stage-height="stageSize.height"
          :version="renderVersion"
        />

        <p v-if="!store.imageBlob" class="empty">Cette stèle n'a pas d'image.</p>
        <div v-if="busy" class="busy" role="status">Calcul de l'image…</div>
      </div>

      <div class="zoom-controls" role="group" aria-label="Zoom">
        <button class="btn icon" type="button" aria-label="Dézoomer" title="Dézoomer (−)" @click="zoomAt(0.8)">−</button>
        <output class="pct" aria-live="polite">{{ zoomPercent }} %</output>
        <button class="btn icon" type="button" aria-label="Zoomer" title="Zoomer (+)" @click="zoomAt(1.25)">+</button>
        <button class="btn" type="button" title="Ajuster à la fenêtre (0)" @click="fit()">Ajuster</button>
        <button class="btn" type="button" title="Taille réelle (1)" @click="actualSize()">1:1</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.viewer {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
  background: var(--viewer-bg);
  display: flex;
  flex-direction: column;
}
/* La photo occupe tout l'espace restant sous le bandeau de perspective. */
.stage-wrap {
  position: relative;
  flex: 1;
  min-height: 0;
}
.stage {
  position: absolute;
  inset: 0;
  overflow: hidden;
  touch-action: none; /* on gère nous-mêmes pincer et glisser */
  cursor: grab;
  user-select: none;
  -webkit-user-select: none;
}
.stage:active {
  cursor: grabbing;
}
.stage:focus-visible {
  outline: 3px solid var(--accent);
  outline-offset: -3px;
}
.world {
  position: absolute;
  left: 0;
  top: 0;
  transform-origin: 0 0;
  will-change: transform;
}
canvas {
  display: block;
  box-shadow: 0 0 0 1px rgb(255 255 255 / 0.15), 0 10px 40px rgb(0 0 0 / 0.5);
}
canvas.pixelated {
  image-rendering: pixelated;
}
.overlay {
  position: absolute;
  inset: 0;
  overflow: visible;
}
.empty {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  color: #ccc;
}
.busy {
  position: absolute;
  top: 12px;
  left: 50%;
  transform: translateX(-50%);
  background: rgb(0 0 0 / 0.7);
  color: #fff;
  padding: 0.3rem 0.8rem;
  border-radius: 999px;
  font-size: 0.85rem;
}
.perspective-bar {
  flex: 0 0 auto;
  display: grid;
  gap: 0.35rem;
  padding: 0.45rem 0.7rem;
  background: var(--surface);
  border-bottom: 1px solid var(--border);
  font-size: 0.88rem;
  user-select: none;
  -webkit-user-select: none;
}
.perspective-bar p {
  margin: 0;
}
.pb-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.4rem 0.6rem;
}
.pb-help {
  flex: 1 1 260px;
}
.pb-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
}
.pb-label {
  font-weight: 600;
}
.aspect select,
.aspect input[type='number'] {
  font: inherit;
  padding: 0.25rem 0.35rem;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: var(--surface);
  color: var(--text);
}
.aspect input[type='number'] {
  width: 5.5em;
}
.manual {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
}
.manual input {
  width: min(220px, 40vw);
}
.aspect-preview {
  display: inline-grid;
  place-items: center;
  width: 34px;
  height: 34px;
}
.aspect-preview .box {
  display: block;
  border: 2px solid var(--accent);
  background: rgb(255 200 60 / 0.15);
}
.small {
  font-size: 0.8rem;
}
.muted {
  color: var(--muted);
}
.warn {
  color: var(--danger);
}
.row {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}
.zoom-controls {
  position: absolute;
  right: 12px;
  bottom: 12px;
  display: flex;
  align-items: center;
  gap: 0.3rem;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 0.3rem;
  box-shadow: var(--shadow);
}
.pct {
  min-width: 4.2em;
  text-align: center;
  font-variant-numeric: tabular-nums;
  font-size: 0.85rem;
}
</style>
