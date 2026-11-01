<script setup lang="ts">
/**
 * Dessine les lignes de texte par-dessus la photo (calque SVG) :
 *  - le contour de chaque ligne, son numéro et une flèche de sens de lecture ;
 *  - pour la ligne sélectionnée : des poignées pour la déformer et une
 *    pastille (le numéro) qu'on fait glisser pour la déplacer ;
 *  - le tracé en cours (rectangle ou polygone).
 *
 * Le calque travaille en coordonnées ÉCRAN (calculées depuis la vue) :
 * ainsi les traits et poignées gardent la même taille quel que soit le zoom.
 */
import { computed, ref } from 'vue'
import type { View } from '../../composables/usePanZoom'
import type { Line, LineGeometry, Point } from '../../types/models'
import {
  geometryBounds,
  geometryPoints,
  insertVertexAfter,
  moveVertex,
  removeVertex,
  roundGeometry,
  translateGeometry,
} from '../../core/geometry'
import { readingArrow } from '../../core/lines'

export type LineDraft =
  | { type: 'rect'; a: Point; b: Point }
  | { type: 'polygon'; points: Point[]; hover: Point | null }

const props = defineProps<{
  lines: Line[]
  view: View
  selectedId: string | null
  draft: LineDraft | null
  /** Pendant le tracé, les lignes existantes sont atténuées et non interactives. */
  drawing: boolean
}>()

const emit = defineEmits<{
  (e: 'commit', id: string, geometry: LineGeometry, label: string): void
  (e: 'drag', active: boolean, screen?: Point, pointerType?: string): void
}>()

const toScreen = (p: Point): Point => ({ x: p.x * props.view.scale + props.view.x, y: p.y * props.view.scale + props.view.y })
const pts = (list: Point[]) => list.map((p) => { const s = toScreen(p); return `${s.x},${s.y}` }).join(' ')

// --- Modification en cours (déplacement ou sommet) ---------------------------
interface Drag {
  id: string
  kind: 'move' | 'vertex'
  index: number
  start: Point // en coordonnées image
  original: LineGeometry
  current: LineGeometry
}
const drag = ref<Drag | null>(null)
let stageRect: DOMRect | null = null

/** Géométrie à afficher (celle en cours de modification si on tire dessus). */
function geometryOf(l: Line): LineGeometry {
  return drag.value?.id === l.id ? drag.value.current : l.geometry
}

const items = computed(() =>
  [...props.lines]
    .sort((a, b) => a.number - b.number)
    .map((l) => {
      const g = geometryOf(l)
      const b = geometryBounds(g)
      const arrow = readingArrow({ ...l, geometry: g })
      const tl = toScreen({ x: b.x, y: b.y })
      return {
        line: l,
        selected: l.id === props.selectedId,
        points: pts(geometryPoints(g)),
        vertices: geometryPoints(g).map(toScreen),
        badge: { x: tl.x, y: tl.y },
        arrow: { from: toScreen(arrow.from), to: toScreen(arrow.to) },
        // une flèche trop petite à l'écran gênerait plus qu'elle n'aiderait
        showArrow: Math.max(b.w, b.h) * props.view.scale > 60,
      }
    }),
)
const selected = computed(() => items.value.find((i) => i.selected) ?? null)

/** Milieux des côtés d'un polygone sélectionné : on clique pour y ajouter un sommet. */
const midpoints = computed(() => {
  const s = selected.value
  if (!s || geometryOf(s.line).type !== 'polygon') return []
  const v = s.vertices
  return v.map((p, i) => {
    const q = v[(i + 1) % v.length]
    return { x: (p.x + q.x) / 2, y: (p.y + q.y) / 2, index: i }
  })
})

function imagePoint(e: PointerEvent): Point {
  const sx = e.clientX - stageRect!.left
  const sy = e.clientY - stageRect!.top
  return { x: (sx - props.view.x) / props.view.scale, y: (sy - props.view.y) / props.view.scale }
}
function screenPoint(e: PointerEvent): Point {
  return { x: e.clientX - stageRect!.left, y: e.clientY - stageRect!.top }
}

function startDrag(e: PointerEvent, line: Line, kind: Drag['kind'], index = 0) {
  if (e.button !== 0) return
  e.stopPropagation()
  e.preventDefault()
  stageRect = (e.currentTarget as SVGElement).ownerSVGElement!.getBoundingClientRect()
  ;(e.currentTarget as Element).setPointerCapture(e.pointerId)
  drag.value = { id: line.id, kind, index, start: imagePoint(e), original: line.geometry, current: line.geometry }
  if (kind === 'vertex') emit('drag', true, screenPoint(e), e.pointerType)
}

function onDragMove(e: PointerEvent) {
  const d = drag.value
  if (!d || !stageRect) return
  const p = imagePoint(e)
  d.current =
    d.kind === 'move'
      ? translateGeometry(d.original, p.x - d.start.x, p.y - d.start.y)
      : moveVertex(d.original, d.index, p)
  if (d.kind === 'vertex') emit('drag', true, screenPoint(e), e.pointerType)
}

function onDragEnd() {
  const d = drag.value
  drag.value = null
  emit('drag', false)
  if (!d || d.current === d.original) return
  const line = props.lines.find((l) => l.id === d.id)
  const label = d.kind === 'move' ? `Déplacer la ligne ${line?.number}` : `Modifier la ligne ${line?.number}`
  emit('commit', d.id, roundGeometry(d.current), label)
}

function addVertex(e: PointerEvent, index: number) {
  e.stopPropagation()
  e.preventDefault()
  const s = selected.value
  if (!s) return
  emit('commit', s.line.id, insertVertexAfter(s.line.geometry, index), `Ajouter un sommet à la ligne ${s.line.number}`)
}

function deleteVertex(line: Line, index: number) {
  if (line.geometry.type !== 'polygon' || line.geometry.points.length <= 3) return
  emit('commit', line.id, removeVertex(line.geometry, index), `Retirer un sommet de la ligne ${line.number}`)
}

/** Clavier sur une poignée : flèches = déplacer (Maj = ×10), Suppr = retirer le sommet. */
function onVertexKey(e: KeyboardEvent, line: Line, index: number) {
  if ((e.key === 'Delete' || e.key === 'Backspace') && line.geometry.type === 'polygon') {
    e.preventDefault()
    e.stopPropagation()
    deleteVertex(line, index)
    return
  }
  const step = (e.shiftKey ? 10 : 1) / props.view.scale
  const d: Record<string, Point> = {
    ArrowLeft: { x: -step, y: 0 },
    ArrowRight: { x: step, y: 0 },
    ArrowUp: { x: 0, y: -step },
    ArrowDown: { x: 0, y: step },
  }
  const v = d[e.key]
  if (!v) return
  e.preventDefault()
  e.stopPropagation()
  const p = geometryPoints(line.geometry)[index]
  emit('commit', line.id, roundGeometry(moveVertex(line.geometry, index, { x: p.x + v.x, y: p.y + v.y })), `Modifier la ligne ${line.number}`)
}

/** Clavier sur la pastille : flèches = déplacer toute la ligne. */
function onBadgeKey(e: KeyboardEvent, line: Line) {
  const step = (e.shiftKey ? 10 : 1) / props.view.scale
  const d: Record<string, [number, number]> = {
    ArrowLeft: [-step, 0],
    ArrowRight: [step, 0],
    ArrowUp: [0, -step],
    ArrowDown: [0, step],
  }
  const v = d[e.key]
  if (!v) return
  e.preventDefault()
  e.stopPropagation()
  emit('commit', line.id, roundGeometry(translateGeometry(line.geometry, v[0], v[1])), `Déplacer la ligne ${line.number}`)
}

// --- Tracé en cours ------------------------------------------------------------
const draftShape = computed(() => {
  const d = props.draft
  if (!d) return null
  if (d.type === 'rect') {
    const a = toScreen(d.a)
    const b = toScreen(d.b)
    return { kind: 'rect' as const, x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), w: Math.abs(a.x - b.x), h: Math.abs(a.y - b.y) }
  }
  const placed = d.points.map(toScreen)
  const hover = d.hover ? toScreen(d.hover) : null
  return { kind: 'polygon' as const, placed, hover, path: [...placed, ...(hover ? [hover] : [])] }
})

const vertexLabel = (line: Line, i: number) =>
  line.geometry.type === 'rect'
    ? `Coin ${['haut gauche', 'haut droit', 'bas droit', 'bas gauche'][i]} de la ligne ${line.number}`
    : `Sommet ${i + 1} de la ligne ${line.number}`
</script>

<template>
  <g class="line-layer" :class="{ drawing: props.drawing }">
    <defs>
      <marker id="arrowhead" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
        <path d="M 0 0 L 10 5 L 0 10 z" class="arrowhead" />
      </marker>
    </defs>

    <g v-for="it in items" :key="it.line.id" class="line" :class="{ selected: it.selected }">
      <polygon :points="it.points" class="shape" />
      <line
        v-if="it.showArrow"
        :x1="it.arrow.from.x"
        :y1="it.arrow.from.y"
        :x2="it.arrow.to.x"
        :y2="it.arrow.to.y"
        class="arrow"
        marker-end="url(#arrowhead)"
      />
      <!-- Pastille du numéro : pour la ligne sélectionnée, on la fait glisser pour déplacer la ligne. -->
      <g
        class="badge"
        :class="{ movable: it.selected && !props.drawing }"
        :tabindex="it.selected && !props.drawing ? 0 : -1"
        :role="it.selected ? 'button' : undefined"
        :aria-label="it.selected ? `Déplacer la ligne ${it.line.number} (glisser ou flèches)` : undefined"
        @pointerdown="it.selected && !props.drawing && startDrag($event, it.line, 'move')"
        @pointermove="onDragMove"
        @pointerup="onDragEnd"
        @pointercancel="onDragEnd"
        @keydown="it.selected && onBadgeKey($event, it.line)"
      >
        <rect :x="it.badge.x - 2" :y="it.badge.y - 24" :width="it.selected ? 52 : 30" height="22" rx="6" />
        <text :x="it.badge.x + 6" :y="it.badge.y - 8">
          {{ it.line.orientation === 'column' ? 'C' : 'L' }}{{ it.line.number }}<tspan v-if="it.selected" dx="4">✥</tspan>
        </text>
      </g>
    </g>

    <!-- Poignées de la ligne sélectionnée -->
    <g v-if="selected && !props.drawing" class="handles">
      <circle
        v-for="m in midpoints"
        :key="'m' + m.index"
        :cx="m.x"
        :cy="m.y"
        r="6"
        class="midpoint"
        @pointerdown="addVertex($event, m.index)"
      >
        <title>Ajouter un sommet ici</title>
      </circle>
      <g
        v-for="(v, i) in selected.vertices"
        :key="i"
        class="vertex"
        tabindex="0"
        role="slider"
        :aria-label="vertexLabel(selected.line, i)"
        :aria-valuetext="`x ${Math.round(geometryPoints(selected.line.geometry)[i]?.x ?? 0)}, y ${Math.round(geometryPoints(selected.line.geometry)[i]?.y ?? 0)}`"
        @pointerdown="startDrag($event, selected.line, 'vertex', i)"
        @pointermove="onDragMove"
        @pointerup="onDragEnd"
        @pointercancel="onDragEnd"
        @dblclick.stop="deleteVertex(selected.line, i)"
        @keydown="onVertexKey($event, selected.line, i)"
      >
        <circle :cx="v.x" :cy="v.y" r="18" class="hit" />
        <rect :x="v.x - 6" :y="v.y - 6" width="12" height="12" class="dot" />
      </g>
    </g>

    <!-- Tracé en cours -->
    <template v-if="draftShape">
      <rect
        v-if="draftShape.kind === 'rect'"
        :x="draftShape.x"
        :y="draftShape.y"
        :width="draftShape.w"
        :height="draftShape.h"
        class="draft"
      />
      <g v-else>
        <polyline :points="draftShape.path.map((p) => `${p.x},${p.y}`).join(' ')" class="draft" />
        <circle
          v-for="(p, i) in draftShape.placed"
          :key="i"
          :cx="p.x"
          :cy="p.y"
          :r="i === 0 && draftShape.placed.length >= 3 ? 10 : 5"
          class="draft-point"
          :class="{ first: i === 0 && draftShape.placed.length >= 3 }"
        />
      </g>
    </template>
  </g>
</template>

<style scoped>
.shape {
  fill: rgb(80 170 255 / 0.06);
  stroke: #4aa8ff;
  stroke-width: 1.5;
}
.selected .shape {
  fill: rgb(255 200 60 / 0.1);
  stroke: #ffc83c;
  stroke-width: 2.5;
}
.drawing .line {
  opacity: 0.45;
}
.arrow {
  stroke: #4aa8ff;
  stroke-width: 2;
  stroke-dasharray: 8 5;
  opacity: 0.85;
  pointer-events: none;
}
.selected .arrow {
  stroke: #ffc83c;
}
.arrowhead {
  fill: #4aa8ff;
}
.selected .arrowhead {
  fill: #ffc83c;
}
.badge rect {
  fill: #1d4f7a;
  stroke: #4aa8ff;
}
.selected .badge rect {
  fill: #6b4a00;
  stroke: #ffc83c;
}
.badge text {
  fill: #fff;
  font: 700 13px var(--font-ui);
  pointer-events: none;
}
.badge {
  pointer-events: none;
}
.badge.movable {
  pointer-events: all;
  cursor: move;
  outline: none;
}
.badge.movable:focus-visible rect {
  stroke: #fff;
  stroke-width: 3;
}
.vertex {
  cursor: grab;
  outline: none;
}
.vertex .hit {
  fill: transparent;
}
.vertex .dot {
  fill: #ffc83c;
  stroke: #000;
  stroke-width: 1.5;
}
.vertex:hover .dot,
.vertex:focus-visible .dot {
  fill: #fff;
  stroke: var(--accent);
  stroke-width: 3;
}
.midpoint {
  fill: rgb(255 200 60 / 0.35);
  stroke: #ffc83c;
  stroke-width: 1;
  cursor: copy;
}
.midpoint:hover {
  fill: #ffc83c;
}
.draft {
  fill: rgb(255 200 60 / 0.12);
  stroke: #ffc83c;
  stroke-width: 2;
  stroke-dasharray: 6 4;
  pointer-events: none;
}
.draft-point {
  fill: #ffc83c;
  stroke: #000;
  pointer-events: none;
}
.draft-point.first {
  fill: rgb(255 200 60 / 0.4);
  stroke: #ffc83c;
  stroke-width: 2;
}
</style>
