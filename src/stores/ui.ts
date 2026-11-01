import { defineStore } from 'pinia'
import { ref, watch } from 'vue'
import type { Direction } from '../types/models'

/**
 * Outils de la visionneuse :
 *  - pan         : déplacer la vue, toucher une ligne pour la sélectionner
 *  - perspective : placer les 4 coins de la stèle
 *  - line-rect   : tracer une ligne par un rectangle
 *  - line-poly   : tracer une ligne par un polygone (clic après clic)
 */
export type Tool = 'pan' | 'perspective' | 'line-rect' | 'line-poly'

export interface Toast {
  id: number
  text: string
  kind: 'info' | 'error'
}

/** Préférences personnelles gardées dans ce navigateur (pas dans le projet). */
interface Prefs {
  defaultDirection: Direction
  magnifierZoom: number
}
const PREFS_KEY = 'hieroglyph-reader:prefs'
function loadPrefs(): Prefs {
  const fallback: Prefs = { defaultDirection: 'rtl', magnifierZoom: 3 }
  try {
    return { ...fallback, ...JSON.parse(localStorage.getItem(PREFS_KEY) ?? '{}') }
  } catch {
    return fallback
  }
}

export const useUiStore = defineStore('ui', () => {
  const prefs = loadPrefs()
  const tool = ref<Tool>('pan')
  const magnifier = ref(false)
  const magnifierZoom = ref(prefs.magnifierZoom)
  const filtersOpen = ref(false)
  const helpOpen = ref(false)
  const toasts = ref<Toast[]>([])
  /** Ligne sélectionnée (peut désigner une ligne supprimée entre-temps : toujours vérifier). */
  const selectedLineId = ref<string | null>(null)
  /** Sens de lecture donné aux nouvelles lignes. */
  const defaultDirection = ref<Direction>(prefs.defaultDirection)
  let toastId = 1

  watch([defaultDirection, magnifierZoom], () => {
    try {
      localStorage.setItem(
        PREFS_KEY,
        JSON.stringify({ defaultDirection: defaultDirection.value, magnifierZoom: magnifierZoom.value }),
      )
    } catch {
      // stockage indisponible (navigation privée…) : sans gravité
    }
  })

  function notify(text: string, kind: Toast['kind'] = 'info', ms = 3500) {
    const id = toastId++
    toasts.value.push({ id, text, kind })
    setTimeout(() => (toasts.value = toasts.value.filter((t) => t.id !== id)), ms)
  }

  return {
    tool,
    magnifier,
    magnifierZoom,
    filtersOpen,
    helpOpen,
    toasts,
    selectedLineId,
    defaultDirection,
    notify,
  }
})
