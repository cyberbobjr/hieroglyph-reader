<script setup lang="ts">
/**
 * Visionneuse : affiche l'image de travail, gère le zoom/déplacement,
 * la correction de perspective et la loupe.
 *
 * Organisation à l'écran (de bas en haut) :
 *   1. un <canvas> qui contient l'image, déplacé/agrandi par une
 *      transformation CSS (très fluide, calculée par la carte graphique) ;
 *   2. un calque SVG par-dessus, pour les poignées, lignes et boîtes ;
 *      (les tracés de lignes sont gérés ici : voir « Tracé des lignes ») ;
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
import { rectFromPoints, geometryBounds } from '../../core/geometry'
import { createLine, lineAtPoint } from '../../core/lines'
import type { LineGeometry, Point, Quad } from '../../types/models'
import Magnifier from './Magnifier.vue'
import PerspectiveEditor from './PerspectiveEditor.vue'
import LineLayer, { type LineDraft } from '../lines/LineLayer.vue'
import ItemLayer from '../signs/ItemLayer.vue'
import { addItem, findItem, lineForBox, reorderLine } from '../../core/items'
import { useWorkingImage } from '../../composables/useWorkingImage'
import type { Rect } from '../../types/models'

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

const { view, fit, fitRect, zoomAt, actualSize, panBy, screenToImage, centerOn } = usePanZoom(stage, content, {
  // Avec un outil de tracé, un doigt dessine ; deux doigts déplacent/zooment toujours.
  singlePointerPans: () => ui.tool === 'pan' || ui.tool === 'perspective',
  onMultiTouchStart: () => {
    gestureDuringPress = true
    if (lineDraft.value?.type === 'rect') lineDraft.value = null
    itemDraft.value = null
  },
})

const filters = computed(() => store.project!.filters)
const cssFilter = computed(() => cssFilterString(filters.value))

// L'image affichée est partagée avec le mode « comparer ».
const shared = useWorkingImage()
watch(cssFilter, (f) => (shared.cssFilter.value = f), { immediate: true })
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
    // En mode perspective on affiche la photo d'origine : pas de découpe possible.
    shared.canvas.value = editingPerspective.value ? null : canvas.value
    shared.version.value++
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

// --- Tracé des lignes ----------------------------------------------------------
const lineDraft = ref<LineDraft | null>(null)
const drawingTool = computed(() => ui.tool === 'line-rect' || ui.tool === 'line-poly')
/** Distance (en pixels écran) sous laquelle un geste compte comme un simple « toucher ». */
const TAP_TOLERANCE = 6
/** Distance sous laquelle toucher le 1er point referme le polygone. */
const CLOSE_TOLERANCE = 14
let press: { id: number; at: Point } | null = null
let gestureDuringPress = false

const lines = computed(() => store.project?.lines ?? [])
const groups = computed(() => store.project?.groups ?? [])

// Boîtes de signes
const itemDraft = ref<{ a: Point; b: Point } | null>(null)
const boxTool = computed(() => ui.tool === 'sign-box')

/** Boîte sous ce point (la plus petite si plusieurs). */
function itemAtPoint(p: Point) {
  let best: { id: string; area: number; lineId: string } | null = null
  for (const l of lines.value)
    for (const it of l.items) {
      const b = it.bbox
      if (p.x >= b.x && p.x <= b.x + b.w && p.y >= b.y && p.y <= b.y + b.h) {
        const area = b.w * b.h
        if (!best || area < best.area) best = { id: it.id, area, lineId: l.id }
      }
    }
  return best
}

/** Toucher/cliquer : sélectionne une boîte (Maj ou Ctrl : ajoute/retire), sinon une ligne. */
function selectAt(p: Point, modifier: boolean) {
  const additive = modifier || ui.multiSelect
  const hit = itemAtPoint(p)
  if (hit) {
    if (additive) {
      const set = new Set(ui.selectedItemIds)
      if (set.has(hit.id)) set.delete(hit.id)
      else set.add(hit.id)
      ui.selectedItemIds = [...set]
    } else ui.selectedItemIds = [hit.id]
    ui.selectedLineId = hit.lineId
    return
  }
  if (!additive) ui.selectedItemIds = []
  ui.selectedLineId = lineAtPoint(lines.value, p)?.id ?? null
}

function addBox(r: Rect) {
  const p = store.project!
  const line = lineForBox(p, r)
  if (!line) {
    ui.notify("Tracez la boîte à l'intérieur d'une ligne (son centre doit être dans la ligne).", 'error')
    return
  }
  let id = ''
  store.mutate(`Ajouter un signe à la ligne ${line.number}`, (proj) => {
    id = addItem(proj, proj.lines.find((l) => l.id === line.id)!, r).id
  })
  ui.selectedItemIds = [id]
  ui.selectedLineId = line.id
  ui.quickEntryFocus++ // on enchaîne : taper le code du signe
}

function commitItem(itemId: string, bbox: Rect, label: string) {
  store.mutate(label, (proj) => {
    const f = findItem(proj, itemId)
    if (!f) return
    f.item.bbox = bbox
    reorderLine(proj, f.line) // la boîte a pu changer de place dans l'ordre de lecture
  })
}

watch(
  () => ui.tool,
  () => {
    lineDraft.value = null
  },
)

function addLine(geometry: LineGeometry) {
  const p = store.project!
  const line = createLine(p.lines, geometry, { direction: ui.defaultDirection })
  store.mutate(`Tracer la ligne ${line.number}`, (proj) => {
    proj.lines.push(line)
  })
  ui.selectedLineId = line.id
}

function finishPolygon() {
  const d = lineDraft.value
  if (d?.type !== 'polygon') return
  if (d.points.length < 3) {
    ui.notify('Il faut au moins 3 points pour un polygone.')
    return
  }
  lineDraft.value = null
  addLine({ type: 'polygon', points: d.points })
}

function onStageDown(e: PointerEvent) {
  if (e.button !== 0) return
  // Un 2e doigt pendant un appui : c'est un geste de zoom, pas un nouveau tracé.
  if (press && !e.isPrimary) return
  gestureDuringPress = false
  press = { id: e.pointerId, at: localPoint(e) }
  if (ui.tool === 'sign-box') {
    const p = screenToImage(localPoint(e))
    itemDraft.value = { a: p, b: p }
    try {
      stage.value?.setPointerCapture(e.pointerId)
    } catch {
      // sans conséquence
    }
  } else if (ui.tool === 'line-rect') {
    const p = screenToImage(localPoint(e))
    lineDraft.value = { type: 'rect', a: p, b: p }
    try {
      stage.value?.setPointerCapture(e.pointerId)
    } catch {
      // sans conséquence
    }
  }
}

function onStageDrawMove(e: PointerEvent) {
  if (itemDraft.value && press?.id === e.pointerId) itemDraft.value.b = screenToImage(localPoint(e))
  const d = lineDraft.value
  if (!d) return
  const p = screenToImage(localPoint(e))
  if (d.type === 'rect' && press?.id === e.pointerId) d.b = p
  else if (d.type === 'polygon') d.hover = p
}

function onStageDrawUp(e: PointerEvent) {
  if (!press || press.id !== e.pointerId) return
  const at = localPoint(e)
  const moved = Math.hypot(at.x - press.at.x, at.y - press.at.y)
  const isTap = moved < TAP_TOLERANCE && !gestureDuringPress
  press = null
  const p = screenToImage(at)

  if (ui.tool === 'sign-box') {
    const d = itemDraft.value
    itemDraft.value = null
    // Un simple toucher sélectionne la boîte touchée, sans en créer.
    if (isTap || !d) {
      if (isTap) selectAt(p, e.shiftKey || e.ctrlKey || e.metaKey)
      return
    }
    const r = rectFromPoints(d.a, p)
    if (r.w * view.scale < 6 || r.h * view.scale < 6) return
    addBox(r)
  } else if (ui.tool === 'line-rect') {
    const d = lineDraft.value
    lineDraft.value = null
    if (d?.type !== 'rect') return
    const r = rectFromPoints(d.a, p)
    // Trop petit à l'écran : c'était sans doute un toucher involontaire.
    if (r.w * view.scale < 8 || r.h * view.scale < 8) return
    addLine({ type: 'rect', rect: r })
  } else if (ui.tool === 'line-poly') {
    if (!isTap) return
    const d = lineDraft.value?.type === 'polygon' ? lineDraft.value : null
    if (!d) {
      lineDraft.value = { type: 'polygon', points: [p], hover: p }
      return
    }
    const toScreen = (q: Point) => ({ x: q.x * view.scale + view.x, y: q.y * view.scale + view.y })
    const first = toScreen(d.points[0])
    const last = toScreen(d.points[d.points.length - 1])
    if (d.points.length >= 3 && Math.hypot(at.x - first.x, at.y - first.y) < CLOSE_TOLERANCE) {
      finishPolygon()
    } else if (Math.hypot(at.x - last.x, at.y - last.y) > 4) {
      // (on ignore le 2e clic d'un double-clic, au même endroit)
      d.points.push(p)
    }
  } else if (ui.tool === 'pan' && isTap) {
    // Toucher une boîte ou une ligne la sélectionne ; toucher ailleurs désélectionne.
    selectAt(p, e.shiftKey || e.ctrlKey || e.metaKey)
  }
}

function onStageDblClick(e: MouseEvent) {
  if (ui.tool === 'line-poly') {
    finishPolygon()
    return
  }
  if (ui.tool === 'pan') zoomAt(2, localPoint(e).x, localPoint(e).y)
}

function commitGeometry(id: string, geometry: LineGeometry, label: string) {
  store.mutateLine(id, label, (l) => {
    l.geometry = geometry
  })
}

/** Touches propres au tracé en cours : prioritaires sur les raccourcis globaux. */
function onDrawingKeys(e: KeyboardEvent) {
  const d = lineDraft.value
  if (!d || d.type !== 'polygon') return
  const t = e.target as HTMLElement | null
  if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT')) return
  if (e.key === 'Escape') lineDraft.value = null
  else if (e.key === 'Enter') finishPolygon()
  else if (e.key === 'Backspace' || e.key === 'Delete') {
    d.points.pop()
    if (!d.points.length) lineDraft.value = null
  } else return
  e.preventDefault()
  e.stopPropagation()
}
onMounted(() => window.addEventListener('keydown', onDrawingKeys, { capture: true }))
onBeforeUnmount(() => window.removeEventListener('keydown', onDrawingKeys, { capture: true }))

/** Cadre une ligne à l'écran. */
function focusLine(id: string) {
  const l = lines.value.find((x) => x.id === id)
  if (l) fitRect(geometryBounds(l.geometry))
}

/** Rend une boîte visible (sans changer le zoom), par ex. quand la saisie passe à la suivante. */
function revealItem(id: string) {
  const f = store.project ? findItem(store.project, id) : null
  if (!f) return
  const b = f.item.bbox
  const x = b.x * view.scale + view.x
  const y = b.y * view.scale + view.y
  const margin = 40
  const visible =
    x > margin && y > margin &&
    x + b.w * view.scale < stageSize.value.width - margin &&
    y + b.h * view.scale < stageSize.value.height - margin
  if (!visible) centerOn({ x: b.x + b.w / 2, y: b.y + b.h / 2 })
}

const drawHint = computed(() => {
  if (ui.tool === 'sign-box')
    return lines.value.length
      ? "Glissez pour entourer un signe (dans une ligne), puis tapez son code. Toucher une boîte la sélectionne."
      : "Tracez d'abord une ligne (panneau Lignes) : chaque signe appartient à une ligne."
  if (ui.tool === 'line-rect') return 'Glissez pour tracer un rectangle autour de la ligne. Deux doigts : déplacer/zoomer.'
  if (ui.tool === 'line-poly') {
    const n = lineDraft.value?.type === 'polygon' ? lineDraft.value.points.length : 0
    if (n === 0) return 'Touchez/cliquez pour poser le premier point du contour.'
    if (n < 3) return `Point ${n} posé. Continuez (au moins 3 points). Retour arrière : retirer le dernier.`
    return 'Touchez le premier point, double-cliquez ou appuyez sur Entrée pour fermer. Échap : abandonner.'
  }
  return ''
})

// --- Loupe ------------------------------------------------------------------
const pointer = ref<{ at: Point; touch: boolean; down: boolean } | null>(null)
const handleDrag = ref<{ at: Point; touch: boolean } | null>(null)

function localPoint(e: MouseEvent): Point {
  const r = stage.value!.getBoundingClientRect()
  return { x: e.clientX - r.left, y: e.clientY - r.top }
}
function onStageMove(e: PointerEvent) {
  pointer.value = { at: localPoint(e), touch: e.pointerType === 'touch', down: e.buttons > 0 }
  onStageDrawMove(e)
}
function onStageLeave(e: PointerEvent) {
  if (e.pointerType !== 'touch') pointer.value = null
}
function onStageUp(e: PointerEvent) {
  if (e.pointerType === 'touch') pointer.value = null
  onStageDrawUp(e)
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

// Quand une seule boîte est sélectionnée (saisie rapide, boutons ‹ ›), on s'assure qu'elle est visible.
watch(
  () => (ui.selectedItemIds.length === 1 ? ui.selectedItemIds[0] : null),
  (id) => id && revealItem(id),
)

defineExpose({ fit, zoomAt, focusLine, finishPolygon, revealItem })
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
        :class="{ drawing: drawingTool || boxTool }"
        @pointerdown="onStageDown"
        @pointermove="onStageMove"
        @pointerleave="onStageLeave"
        @pointerup="onStageUp"
        @pointercancel="onStageUp"
        @dblclick="onStageDblClick"
      >
        <div class="world" :style="worldStyle">
          <canvas
            ref="canvas"
            :class="{ pixelated: view.scale > 3 }"
            :style="{ filter: cssFilter }"
          />
        </div>

        <svg class="overlay" :width="stageSize.width" :height="stageSize.height">
          <LineLayer
            v-if="!editingPerspective"
            :lines="lines"
            :view="view"
            :selected-id="ui.selectedItemIds.length ? null : ui.selectedLineId"
            :draft="lineDraft"
            :drawing="drawingTool || boxTool"
            @commit="commitGeometry"
            @drag="onHandleDrag"
          />
          <ItemLayer
            v-if="!editingPerspective"
            :lines="lines"
            :groups="groups"
            :view="view"
            :selected-ids="ui.selectedItemIds"
            :editable="ui.tool === 'pan' || ui.tool === 'sign-box'"
            :draft="itemDraft"
            @commit="commitItem"
            @drag="onHandleDrag"
          />
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
        <div v-if="drawHint" class="draw-hint" role="status">
          {{ drawHint }}
          <button
            v-if="ui.tool === 'line-poly' && lineDraft?.type === 'polygon' && lineDraft.points.length >= 3"
            class="btn small primary"
            type="button"
            @click="finishPolygon"
          >
            Fermer le polygone
          </button>
        </div>
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
.stage.drawing,
.stage.drawing:active {
  cursor: crosshair;
}
.draw-hint {
  position: absolute;
  left: 50%;
  bottom: 64px;
  transform: translateX(-50%);
  max-width: calc(100% - 24px);
  background: rgb(0 0 0 / 0.75);
  color: #fff;
  padding: 0.4rem 0.8rem;
  border-radius: 10px;
  font-size: 0.85rem;
  display: flex;
  gap: 0.6rem;
  align-items: center;
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
