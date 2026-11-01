<script setup lang="ts">
/**
 * Les 4 poignées de la correction de perspective, dessinées en SVG
 * par-dessus la photo. On les fait glisser sur les coins de la stèle.
 * Au clavier : Tab pour passer d'un coin à l'autre, flèches pour déplacer
 * (Maj + flèche = 10 fois plus vite).
 */
import { computed } from 'vue'
import type { View } from '../../composables/usePanZoom'
import type { Point, Quad } from '../../types/models'

const props = defineProps<{ corners: Quad; view: View; imageWidth: number; imageHeight: number }>()
const emit = defineEmits<{
  (e: 'update', index: number, p: Point): void
  (e: 'drag', active: boolean, screen?: Point, pointerType?: string): void
}>()

const LABELS = ['haut gauche', 'haut droit', 'bas droit', 'bas gauche']
const SHORT = ['HG', 'HD', 'BD', 'BG']

const screen = computed(() =>
  props.corners.map((c) => ({ x: c.x * props.view.scale + props.view.x, y: c.y * props.view.scale + props.view.y })),
)
const polygon = computed(() => screen.value.map((p) => `${p.x},${p.y}`).join(' '))

/** Lignes de repère à 1/3 et 2/3 : elles aident à vérifier que le redressement sera droit. */
const guides = computed(() => {
  const [a, b, c, d] = screen.value
  const lerp = (p: Point, q: Point, t: number) => ({ x: p.x + (q.x - p.x) * t, y: p.y + (q.y - p.y) * t })
  const out: [Point, Point][] = []
  for (const t of [1 / 3, 2 / 3]) {
    out.push([lerp(a, b, t), lerp(d, c, t)])
    out.push([lerp(a, d, t), lerp(b, c, t)])
  }
  return out
})

function clamp(p: Point): Point {
  return {
    x: Math.min(props.imageWidth, Math.max(0, p.x)),
    y: Math.min(props.imageHeight, Math.max(0, p.y)),
  }
}

let dragIndex = -1
let svgRect: DOMRect | null = null

function onDown(i: number, e: PointerEvent) {
  e.stopPropagation()
  e.preventDefault()
  dragIndex = i
  svgRect = (e.currentTarget as SVGElement).ownerSVGElement!.getBoundingClientRect()
  ;(e.currentTarget as Element).setPointerCapture(e.pointerId)
  emit('drag', true, { x: e.clientX - svgRect.left, y: e.clientY - svgRect.top }, e.pointerType)
}

function onMove(e: PointerEvent) {
  if (dragIndex < 0 || !svgRect) return
  const sx = e.clientX - svgRect.left
  const sy = e.clientY - svgRect.top
  emit('update', dragIndex, clamp({ x: (sx - props.view.x) / props.view.scale, y: (sy - props.view.y) / props.view.scale }))
  emit('drag', true, { x: sx, y: sy }, e.pointerType)
}

function onUp() {
  dragIndex = -1
  emit('drag', false)
}

function onKey(i: number, e: KeyboardEvent) {
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
  const c = props.corners[i]
  emit('update', i, clamp({ x: c.x + v.x, y: c.y + v.y }))
}
</script>

<template>
  <g class="perspective">
    <polygon :points="polygon" class="quad" />
    <line v-for="(g, k) in guides" :key="k" :x1="g[0].x" :y1="g[0].y" :x2="g[1].x" :y2="g[1].y" class="guide" />
    <g
      v-for="(p, i) in screen"
      :key="i"
      class="handle"
      tabindex="0"
      role="slider"
      :aria-label="`Coin ${LABELS[i]} de la stèle`"
      :aria-valuetext="`x ${Math.round(props.corners[i].x)}, y ${Math.round(props.corners[i].y)}`"
      @pointerdown="onDown(i, $event)"
      @pointermove="onMove"
      @pointerup="onUp"
      @pointercancel="onUp"
      @keydown="onKey(i, $event)"
    >
      <circle :cx="p.x" :cy="p.y" r="22" class="hit" />
      <circle :cx="p.x" :cy="p.y" r="9" class="dot" />
      <text :x="p.x + 14" :y="p.y - 12">{{ SHORT[i] }}</text>
    </g>
  </g>
</template>

<style scoped>
.quad {
  fill: rgb(255 200 60 / 0.08);
  stroke: #ffc83c;
  stroke-width: 2;
}
.guide {
  stroke: rgb(255 200 60 / 0.55);
  stroke-dasharray: 6 6;
  stroke-width: 1;
}
.handle {
  cursor: grab;
  outline: none;
}
.hit {
  fill: transparent;
}
.dot {
  fill: #ffc83c;
  stroke: #000;
  stroke-width: 2;
}
.handle:focus-visible .dot,
.handle:hover .dot {
  fill: #fff;
  stroke: var(--accent);
  stroke-width: 3;
}
text {
  fill: #ffc83c;
  font: 600 13px var(--font-ui);
  paint-order: stroke;
  stroke: #000;
  stroke-width: 3px;
  pointer-events: none;
}
</style>
