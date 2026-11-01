<script setup lang="ts">
/**
 * Loupe : petite fenêtre qui montre, agrandie, la zone sous le curseur.
 * Elle copie simplement un morceau de l'image affichée, en plus gros.
 */
import { ref, watch, computed, onMounted } from 'vue'
import type { View } from '../../composables/usePanZoom'
import type { Point } from '../../types/models'

const props = defineProps<{
  source: HTMLCanvasElement | null
  /** Position du pointeur, en pixels écran relatifs à la visionneuse. */
  at: Point
  view: View
  zoom: number
  filter: string
  /** Pour un doigt : on place la loupe au-dessus pour qu'il ne la cache pas. */
  touch: boolean
  stageWidth: number
  stageHeight: number
  /** Change quand l'image source est redessinée. */
  version: number
}>()

const SIZE = 200
const canvas = ref<HTMLCanvasElement | null>(null)

const position = computed(() => {
  const gap = props.touch ? 60 : 24
  let left = props.at.x + gap
  let top = props.touch ? props.at.y - SIZE - gap : props.at.y + gap
  if (left + SIZE > props.stageWidth) left = props.at.x - SIZE - gap
  if (top < 0) top = props.at.y + gap
  if (top + SIZE > props.stageHeight) top = props.at.y - SIZE - gap
  return { left: `${Math.max(0, left)}px`, top: `${Math.max(0, top)}px` }
})

function draw() {
  const c = canvas.value
  const src = props.source
  if (!c || !src) return
  const dpr = window.devicePixelRatio || 1
  if (c.width !== SIZE * dpr) {
    c.width = SIZE * dpr
    c.height = SIZE * dpr
  }
  const ctx = c.getContext('2d')!
  ctx.imageSmoothingEnabled = props.view.scale * props.zoom < 4
  ctx.fillStyle = '#222'
  ctx.fillRect(0, 0, c.width, c.height)
  // Point de l'image sous le pointeur, puis taille de la zone à copier.
  const ix = (props.at.x - props.view.x) / props.view.scale
  const iy = (props.at.y - props.view.y) / props.view.scale
  const side = SIZE / (props.view.scale * props.zoom)
  ctx.drawImage(src, ix - side / 2, iy - side / 2, side, side, 0, 0, c.width, c.height)
}

watch(() => [props.at.x, props.at.y, props.view.scale, props.view.x, props.view.y, props.zoom, props.version], draw)
onMounted(draw)
</script>

<template>
  <div class="magnifier" :style="position" aria-hidden="true">
    <canvas ref="canvas" :style="{ filter: props.filter, width: SIZE + 'px', height: SIZE + 'px' }" />
    <span class="cross" />
    <span class="zoom">×{{ props.zoom }}</span>
  </div>
</template>

<style scoped>
.magnifier {
  position: absolute;
  width: 200px;
  height: 200px;
  border-radius: 50%;
  overflow: hidden;
  border: 3px solid var(--accent);
  box-shadow: 0 6px 24px rgb(0 0 0 / 0.45);
  pointer-events: none;
  z-index: 20;
  background: #222;
}
canvas {
  display: block;
}
.cross::before,
.cross::after {
  content: '';
  position: absolute;
  background: rgb(255 80 60 / 0.8);
}
.cross::before {
  left: 50%;
  top: 40%;
  width: 1px;
  height: 20%;
}
.cross::after {
  top: 50%;
  left: 40%;
  height: 1px;
  width: 20%;
}
.zoom {
  position: absolute;
  bottom: 14px;
  left: 50%;
  transform: translateX(-50%);
  font-size: 0.7rem;
  color: #fff;
  background: rgb(0 0 0 / 0.55);
  padding: 0 6px;
  border-radius: 8px;
}
</style>
