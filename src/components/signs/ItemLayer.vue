<script setup lang="ts">
/**
 * Calque SVG des boîtes de signes :
 *  - chaque boîte, colorée selon son statut (certain, probable, incertain, lacune) ;
 *  - au-dessus : son rang dans la ligne et le glyphe attribué (orienté comme
 *    sur la stèle) ;
 *  - les carrés (pointillés) et les cartouches (cadre arrondi) ;
 *  - pour une boîte sélectionnée seule : déplacement (glisser l'intérieur)
 *    et redimensionnement (glisser les coins).
 */
import { computed, ref } from 'vue'
import type { View } from '../../composables/usePanZoom'
import type { Group, Line, Point, Rect, SignStatus } from '../../types/models'
import { useLibraryStore } from '../../stores/library'
import { rectFromPoints } from '../../core/geometry'

const props = defineProps<{
  lines: Line[]
  groups: Group[]
  view: View
  selectedIds: string[]
  /** Les poignées ne sont actives qu'avec l'outil Sélection ou Boîte. */
  editable: boolean
  draft: { a: Point; b: Point } | null
}>()
const emit = defineEmits<{
  (e: 'commit', itemId: string, bbox: Rect, label: string): void
  (e: 'drag', active: boolean, screen?: Point, pointerType?: string): void
}>()

const library = useLibraryStore()

const sx = (x: number) => x * props.view.scale + props.view.x
const sy = (y: number) => y * props.view.scale + props.view.y
function screenRect(r: Rect, pad = 0) {
  return { x: sx(r.x) - pad, y: sy(r.y) - pad, w: r.w * props.view.scale + 2 * pad, h: r.h * props.view.scale + 2 * pad }
}
function union(rs: Rect[]): Rect {
  const x = Math.min(...rs.map((r) => r.x))
  const y = Math.min(...rs.map((r) => r.y))
  return { x, y, w: Math.max(...rs.map((r) => r.x + r.w)) - x, h: Math.max(...rs.map((r) => r.y + r.h)) - y }
}

// --- Modification en cours -------------------------------------------------------
interface Drag {
  id: string
  kind: 'move' | 'corner'
  corner: number
  start: Point
  original: Rect
  current: Rect
}
const drag = ref<Drag | null>(null)
let stageRect: DOMRect | null = null

const selectedSet = computed(() => new Set(props.selectedIds))

const boxes = computed(() =>
  props.lines.flatMap((line) =>
    line.items.map((it, index) => {
      const bbox = drag.value?.id === it.id ? drag.value.current : it.bbox
      const r = screenRect(bbox)
      const sign = it.signCode ? library.get(it.signCode) : undefined
      return {
        id: it.id,
        line,
        index,
        status: it.status,
        selected: selectedSet.value.has(it.id),
        r,
        glyph: sign?.unicode ?? '',
        code: it.signCode ?? '',
        mirror: line.direction === 'rtl',
        // Étiquette seulement si la boîte est assez grande à l'écran.
        showLabel: r.h > 14,
      }
    }),
  ),
)

const groupShapes = computed(() => {
  const byId = new Map(props.lines.flatMap((l) => l.items.map((i) => [i.id, i.bbox] as const)))
  return props.groups
    .map((g) => {
      const rects = g.memberIds.map((id) => byId.get(id)).filter((r): r is Rect => !!r)
      if (!rects.length) return null
      const pad = g.kind === 'cartouche' ? 7 : 3
      return { id: g.id, kind: g.kind, r: screenRect(union(rects), pad) }
    })
    .filter((x): x is NonNullable<typeof x> => !!x)
})

/** Seule une boîte sélectionnée SEULE a des poignées (sinon, trop d'ambiguïté). */
const single = computed(() => (props.editable && props.selectedIds.length === 1 ? boxes.value.find((b) => b.id === props.selectedIds[0]) ?? null : null))

const corners = computed(() => {
  const s = single.value
  if (!s) return []
  const { x, y, w, h } = s.r
  return [
    { x, y },
    { x: x + w, y },
    { x: x + w, y: y + h },
    { x, y: y + h },
  ]
})

function imagePoint(e: PointerEvent): Point {
  return {
    x: (e.clientX - stageRect!.left - props.view.x) / props.view.scale,
    y: (e.clientY - stageRect!.top - props.view.y) / props.view.scale,
  }
}

function startDrag(e: PointerEvent, kind: Drag['kind'], corner = 0) {
  const s = single.value
  if (!s || e.button !== 0 || e.shiftKey || e.ctrlKey || e.metaKey) return
  e.stopPropagation()
  e.preventDefault()
  stageRect = (e.currentTarget as SVGElement).ownerSVGElement!.getBoundingClientRect()
  ;(e.currentTarget as Element).setPointerCapture(e.pointerId)
  const item = s.line.items[s.index]
  drag.value = { id: s.id, kind, corner, start: imagePoint(e), original: item.bbox, current: item.bbox }
  if (kind === 'corner') emit('drag', true, { x: e.clientX - stageRect.left, y: e.clientY - stageRect.top }, e.pointerType)
}

function onMove(e: PointerEvent) {
  const d = drag.value
  if (!d || !stageRect) return
  const p = imagePoint(e)
  if (d.kind === 'move') {
    d.current = { ...d.original, x: d.original.x + p.x - d.start.x, y: d.original.y + p.y - d.start.y }
  } else {
    const o = d.original
    const pts = [
      { x: o.x, y: o.y },
      { x: o.x + o.w, y: o.y },
      { x: o.x + o.w, y: o.y + o.h },
      { x: o.x, y: o.y + o.h },
    ]
    d.current = rectFromPoints(pts[(d.corner + 2) % 4], p)
    emit('drag', true, { x: e.clientX - stageRect.left, y: e.clientY - stageRect.top }, e.pointerType)
  }
}

function onUp() {
  const d = drag.value
  drag.value = null
  emit('drag', false)
  if (!d || d.current === d.original || d.current.w < 2 || d.current.h < 2) return
  const r = (v: number) => Math.round(v * 10) / 10
  const bbox = { x: r(d.current.x), y: r(d.current.y), w: r(d.current.w), h: r(d.current.h) }
  emit('commit', d.id, bbox, d.kind === 'move' ? 'Déplacer la boîte' : 'Redimensionner la boîte')
}

/** Clavier sur une poignée : flèches (Maj = ×10). Coin 0 = déplacer toute la boîte. */
function onKey(e: KeyboardEvent, corner: number | null) {
  const s = single.value
  if (!s) return
  const step = (e.shiftKey ? 10 : 1) / props.view.scale
  const d: Record<string, [number, number]> = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }
  const v = d[e.key]
  if (!v) return
  e.preventDefault()
  e.stopPropagation()
  const o = s.line.items[s.index].bbox
  let next: Rect
  if (corner === null) next = { ...o, x: o.x + v[0], y: o.y + v[1] }
  else {
    const pts = [
      { x: o.x, y: o.y },
      { x: o.x + o.w, y: o.y },
      { x: o.x + o.w, y: o.y + o.h },
      { x: o.x, y: o.y + o.h },
    ]
    const p = pts[corner]
    next = rectFromPoints(pts[(corner + 2) % 4], { x: p.x + v[0], y: p.y + v[1] })
  }
  emit('commit', s.id, next, corner === null ? 'Déplacer la boîte' : 'Redimensionner la boîte')
}

const STATUS_LABEL: Record<SignStatus, string> = {
  certain: 'certain',
  probable: 'probable',
  incertain: 'incertain',
  lacune: 'lacune',
}

const draftRect = computed(() => (props.draft ? screenRect(rectFromPoints(props.draft.a, props.draft.b)) : null))
</script>

<template>
  <g class="item-layer">
    <rect
      v-for="g in groupShapes"
      :key="g.id"
      :x="g.r.x"
      :y="g.r.y"
      :width="g.r.w"
      :height="g.r.h"
      :rx="g.kind === 'cartouche' ? Math.min(g.r.w, g.r.h) / 2 : 2"
      :class="g.kind"
    />

    <g v-for="b in boxes" :key="b.id" class="box" :class="[b.status, { selected: b.selected }]">
      <rect :x="b.r.x" :y="b.r.y" :width="b.r.w" :height="b.r.h" class="frame">
        <title>Signe {{ b.index + 1 }} — {{ b.code || 'non identifié' }} ({{ STATUS_LABEL[b.status] }})</title>
      </rect>
      <g v-if="b.showLabel || b.selected" class="label">
        <rect :x="b.r.x" :y="b.r.y - 19" :width="b.glyph ? 38 : 22" height="17" rx="4" />
        <text :x="b.r.x + 4" :y="b.r.y - 6" class="num">{{ b.index + 1 }}</text>
        <text
          v-if="b.glyph"
          class="glyph"
          :transform="b.mirror ? `translate(${b.r.x + 34} ${b.r.y - 5}) scale(-1 1)` : `translate(${b.r.x + 20} ${b.r.y - 5})`"
        >{{ b.glyph }}</text>
        <text v-else-if="b.status !== 'lacune'" :x="b.r.x + 14" :y="b.r.y - 6" class="unknown">?</text>
      </g>
    </g>

    <!-- Boîte sélectionnée seule : déplacer (intérieur) et redimensionner (coins) -->
    <g v-if="single" class="handles">
      <rect
        :x="single.r.x"
        :y="single.r.y"
        :width="single.r.w"
        :height="single.r.h"
        class="body"
        tabindex="0"
        role="button"
        :aria-label="`Déplacer la boîte du signe ${single.index + 1} (glisser ou flèches)`"
        @pointerdown="startDrag($event, 'move')"
        @pointermove="onMove"
        @pointerup="onUp"
        @pointercancel="onUp"
        @keydown="onKey($event, null)"
      />
      <g
        v-for="(c, i) in corners"
        :key="i"
        class="corner"
        tabindex="0"
        role="slider"
        :aria-label="`Coin ${['haut gauche', 'haut droit', 'bas droit', 'bas gauche'][i]} de la boîte`"
        @pointerdown="startDrag($event, 'corner', i)"
        @pointermove="onMove"
        @pointerup="onUp"
        @pointercancel="onUp"
        @keydown="onKey($event, i)"
      >
        <circle :cx="c.x" :cy="c.y" r="16" class="hit" />
        <rect :x="c.x - 5" :y="c.y - 5" width="10" height="10" class="dot" />
      </g>
    </g>

    <rect v-if="draftRect" :x="draftRect.x" :y="draftRect.y" :width="draftRect.w" :height="draftRect.h" class="draft" />
  </g>
</template>

<style scoped>
.box .frame {
  fill: transparent;
  stroke-width: 1.5;
  pointer-events: none;
}
.box.certain .frame {
  stroke: #34c759;
}
.box.probable .frame {
  stroke: #4aa8ff;
}
.box.incertain .frame {
  stroke: #ff9f0a;
  stroke-dasharray: 5 3;
}
.box.lacune .frame {
  stroke: #ff453a;
  stroke-dasharray: 2 3;
  fill: rgb(255 69 58 / 0.12);
}
.box.selected .frame {
  stroke-width: 3;
  fill: rgb(255 200 60 / 0.12);
}
.label {
  pointer-events: none;
}
.label rect {
  fill: rgb(0 0 0 / 0.72);
}
.box.selected .label rect {
  fill: #6b4a00;
}
.label .num {
  fill: #fff;
  font: 700 11px var(--font-ui);
}
.label .glyph {
  fill: #ffe9b0;
  font-family: var(--font-glyph);
  font-size: 14px;
}
.label .unknown {
  fill: #ffcf66;
  font: 700 11px var(--font-ui);
}
.quadrat {
  fill: none;
  stroke: #c58cff;
  stroke-width: 1.5;
  stroke-dasharray: 4 3;
  pointer-events: none;
}
.cartouche {
  fill: none;
  stroke: #ffd60a;
  stroke-width: 2.5;
  pointer-events: none;
}
.handles .body {
  fill: transparent;
  cursor: move;
  outline: none;
}
.handles .body:focus-visible {
  stroke: #fff;
  stroke-width: 2;
}
.corner {
  cursor: nwse-resize;
  outline: none;
}
.corner .hit {
  fill: transparent;
}
.corner .dot {
  fill: #ffc83c;
  stroke: #000;
  stroke-width: 1.5;
}
.corner:focus-visible .dot,
.corner:hover .dot {
  fill: #fff;
  stroke: var(--accent);
  stroke-width: 3;
}
.draft {
  fill: rgb(52 199 89 / 0.12);
  stroke: #34c759;
  stroke-width: 2;
  stroke-dasharray: 5 3;
  pointer-events: none;
}
</style>
