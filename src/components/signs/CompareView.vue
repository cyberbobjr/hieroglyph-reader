<script setup lang="ts">
/**
 * Mode « comparer » : à gauche, le signe découpé sur la photo (avec les
 * filtres d'affichage), à droite le glyphe de la bibliothèque, orienté comme
 * sur la stèle. Pratique pour vérifier une identification d'un coup d'œil.
 */
import { onMounted, ref, watch } from 'vue'
import { useWorkingImage } from '../../composables/useWorkingImage'
import type { Rect } from '../../types/models'

const props = withDefaults(
  defineProps<{
    bbox: Rect
    /** Caractère du glyphe proposé (vide = aucun). */
    glyph?: string
    /** Code affiché sous le glyphe. */
    code?: string
    /** Afficher le glyphe en miroir (ligne lue de droite à gauche). */
    mirror?: boolean
    size?: number
  }>(),
  { glyph: '', code: '', mirror: false, size: 96 },
)

const { canvas: source, version, cssFilter } = useWorkingImage()
const crop = ref<HTMLCanvasElement | null>(null)

function draw() {
  const c = crop.value
  const src = source.value
  if (!c || !src) return
  const dpr = window.devicePixelRatio || 1
  const S = Math.round(props.size * dpr)
  c.width = S
  c.height = S
  const ctx = c.getContext('2d')!
  ctx.clearRect(0, 0, S, S)
  // Petite marge autour de la boîte, puis on garde les proportions dans le carré.
  const pad = Math.max(props.bbox.w, props.bbox.h) * 0.08
  const sx = props.bbox.x - pad
  const sy = props.bbox.y - pad
  const sw = props.bbox.w + 2 * pad
  const sh = props.bbox.h + 2 * pad
  const k = S / Math.max(sw, sh)
  const dw = sw * k
  const dh = sh * k
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(src, sx, sy, sw, sh, (S - dw) / 2, (S - dh) / 2, dw, dh)
}

watch(() => [props.bbox.x, props.bbox.y, props.bbox.w, props.bbox.h, props.size, version.value, source.value], draw)
onMounted(draw)
</script>

<template>
  <div class="compare" :style="{ '--size': props.size + 'px' }">
    <figure>
      <canvas ref="crop" :style="{ filter: cssFilter }" role="img" aria-label="Signe découpé sur la photo" />
      <figcaption>photo</figcaption>
    </figure>
    <figure>
      <div class="glyph glyph-text" :class="{ empty: !props.glyph }" aria-hidden="true">
        <span :class="{ mirror: props.mirror }">{{ props.glyph || '?' }}</span>
      </div>
      <figcaption>{{ props.code || 'bibliothèque' }}</figcaption>
    </figure>
  </div>
</template>

<style scoped>
.compare {
  display: flex;
  gap: 0.5rem;
}
figure {
  margin: 0;
  display: grid;
  justify-items: center;
  gap: 0.15rem;
}
canvas,
.glyph {
  width: var(--size);
  height: var(--size);
  border: 1px solid var(--border);
  border-radius: 6px;
  background: var(--viewer-bg);
}
.glyph {
  display: grid;
  place-items: center;
  background: #f4ecdb;
  color: #2a2218;
  font-size: calc(var(--size) * 0.72);
  line-height: 1;
}
.glyph.empty {
  font-family: var(--font-ui);
  font-size: calc(var(--size) * 0.3);
  color: #9a8d78;
}
figcaption {
  font-size: 0.7rem;
  color: var(--muted);
}
</style>
