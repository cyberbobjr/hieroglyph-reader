/**
 * Zoom et déplacement, à la souris comme au doigt.
 *
 * La « vue » est décrite par 3 nombres : un facteur de zoom (scale) et un
 * décalage (x, y). Un point de l'image (ix, iy) apparaît à l'écran en :
 *     écranX = ix × scale + x        écranY = iy × scale + y
 *
 * Gestes reconnus :
 *  - 1 doigt / clic gauche glissé : déplacer (si l'outil actif le permet)
 *  - 2 doigts : pincer pour zoomer + glisser pour déplacer
 *  - molette ou pincement du pavé tactile : zoom autour du curseur
 *  - clic molette glissé : déplacer, quel que soit l'outil
 */
import { reactive, onBeforeUnmount, watch, type Ref } from 'vue'
import type { Point } from '../types/models'

export interface View {
  scale: number
  x: number
  y: number
}

export interface PanZoomOptions {
  /** Le glisser à un doigt/clic gauche déplace-t-il la vue ? (faux pour les outils de dessin) */
  singlePointerPans: () => boolean
  /** Appelé quand un geste à deux doigts commence (pour annuler un tracé en cours). */
  onMultiTouchStart?: () => void
}

const MAX_SCALE = 40

export function usePanZoom(
  el: Ref<HTMLElement | null>,
  content: Ref<{ width: number; height: number }>,
  opts: PanZoomOptions,
) {
  const view = reactive<View>({ scale: 1, x: 0, y: 0 })
  const pointers = new Map<number, Point>()
  let mode: 'none' | 'pan' | 'pinch' = 'none'
  let last: Point = { x: 0, y: 0 }
  let pinchStart = { dist: 1, mid: { x: 0, y: 0 }, view: { ...view } }

  function localPoint(e: { clientX: number; clientY: number }): Point {
    const r = el.value!.getBoundingClientRect()
    return { x: e.clientX - r.left, y: e.clientY - r.top }
  }

  function fitScale(): number {
    const box = el.value?.getBoundingClientRect()
    const { width, height } = content.value
    if (!box || !width || !height) return 1
    return Math.min(box.width / width, box.height / height) * 0.95
  }

  function clampScale(s: number) {
    return Math.min(MAX_SCALE, Math.max(fitScale() / 4, s))
  }

  /** Affiche l'image entière, centrée. */
  function fit() {
    const box = el.value?.getBoundingClientRect()
    const { width, height } = content.value
    if (!box || !width || !height) return
    const s = fitScale()
    view.scale = s
    view.x = (box.width - width * s) / 2
    view.y = (box.height - height * s) / 2
  }

  /** Zoome d'un facteur en gardant fixe le point (cx, cy) de l'écran. */
  function zoomAt(factor: number, cx?: number, cy?: number) {
    const box = el.value?.getBoundingClientRect()
    const px = cx ?? (box ? box.width / 2 : 0)
    const py = cy ?? (box ? box.height / 2 : 0)
    const next = clampScale(view.scale * factor)
    const k = next / view.scale
    view.x = px - (px - view.x) * k
    view.y = py - (py - view.y) * k
    view.scale = next
  }

  /** Zoom 1:1 (un pixel de l'image = un pixel de l'écran). */
  function actualSize() {
    zoomAt(1 / view.scale)
  }

  function panBy(dx: number, dy: number) {
    view.x += dx
    view.y += dy
  }

  /** Centre la vue sur un point de l'image. */
  function centerOn(p: Point) {
    const box = el.value?.getBoundingClientRect()
    if (!box) return
    view.x = box.width / 2 - p.x * view.scale
    view.y = box.height / 2 - p.y * view.scale
  }

  const screenToImage = (p: Point): Point => ({ x: (p.x - view.x) / view.scale, y: (p.y - view.y) / view.scale })
  const imageToScreen = (p: Point): Point => ({ x: p.x * view.scale + view.x, y: p.y * view.scale + view.y })

  function startPinch() {
    const [a, b] = [...pointers.values()]
    pinchStart = {
      dist: Math.max(1, Math.hypot(a.x - b.x, a.y - b.y)),
      mid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 },
      view: { ...view },
    }
    mode = 'pinch'
  }

  function onPointerDown(e: PointerEvent) {
    const p = localPoint(e)
    pointers.set(e.pointerId, p)
    if (pointers.size === 2) {
      opts.onMultiTouchStart?.()
      startPinch()
      try {
        el.value?.setPointerCapture(e.pointerId)
      } catch {
        // pointeur déjà relâché : sans conséquence
      }
      e.preventDefault()
      return
    }
    const middle = e.button === 1
    if (pointers.size === 1 && (middle || (e.button === 0 && opts.singlePointerPans()))) {
      mode = 'pan'
      last = p
      try {
        el.value?.setPointerCapture(e.pointerId)
      } catch {
        // pointeur déjà relâché : sans conséquence
      }
      e.preventDefault()
    }
  }

  function onPointerMove(e: PointerEvent) {
    if (!pointers.has(e.pointerId)) return
    const p = localPoint(e)
    pointers.set(e.pointerId, p)
    if (mode === 'pan') {
      panBy(p.x - last.x, p.y - last.y)
      last = p
    } else if (mode === 'pinch' && pointers.size >= 2) {
      const [a, b] = [...pointers.values()]
      const dist = Math.max(1, Math.hypot(a.x - b.x, a.y - b.y))
      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
      const s0 = pinchStart.view
      const scale = clampScale(s0.scale * (dist / pinchStart.dist))
      const k = scale / s0.scale
      // Le point de l'image sous le milieu des doigts suit les doigts.
      view.scale = scale
      view.x = mid.x - (pinchStart.mid.x - s0.x) * k
      view.y = mid.y - (pinchStart.mid.y - s0.y) * k
    }
  }

  function onPointerUp(e: PointerEvent) {
    pointers.delete(e.pointerId)
    if (mode === 'pinch' && pointers.size === 1) {
      // On lève un doigt : on continue en simple déplacement.
      mode = 'pan'
      last = [...pointers.values()][0]
    } else if (pointers.size === 0) {
      mode = 'none'
    }
  }

  function onWheel(e: WheelEvent) {
    e.preventDefault()
    const p = localPoint(e)
    // Molette de souris (crans) ou pincement du pavé tactile (ctrlKey) → zoom.
    // Défilement à deux doigts sur pavé tactile → déplacement.
    const isMouseWheel = e.deltaMode !== 0 || (e.deltaX === 0 && Math.abs(e.deltaY) >= 50)
    if (e.ctrlKey || isMouseWheel) {
      const delta = e.deltaMode === 1 ? e.deltaY * 33 : e.deltaY
      zoomAt(Math.exp(-delta * (e.ctrlKey ? 0.01 : 0.0015)), p.x, p.y)
    } else {
      panBy(-e.deltaX, -e.deltaY)
    }
  }

  /** true pendant un geste de déplacement/zoom (les outils doivent alors s'abstenir). */
  const isGesturing = () => mode !== 'none'

  // Les écouteurs sont posés à la main pour pouvoir déclarer wheel « non passif ».
  watch(
    el,
    (node, old) => {
      if (old) detach(old)
      if (node) {
        node.addEventListener('pointerdown', onPointerDown)
        node.addEventListener('pointermove', onPointerMove)
        node.addEventListener('pointerup', onPointerUp)
        node.addEventListener('pointercancel', onPointerUp)
        node.addEventListener('wheel', onWheel, { passive: false })
      }
    },
    { immediate: true },
  )
  function detach(node: HTMLElement) {
    node.removeEventListener('pointerdown', onPointerDown)
    node.removeEventListener('pointermove', onPointerMove)
    node.removeEventListener('pointerup', onPointerUp)
    node.removeEventListener('pointercancel', onPointerUp)
    node.removeEventListener('wheel', onWheel)
  }
  onBeforeUnmount(() => el.value && detach(el.value))

  return { view, fit, zoomAt, actualSize, panBy, centerOn, screenToImage, imageToScreen, isGesturing }
}
