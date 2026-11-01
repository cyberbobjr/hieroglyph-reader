import { defineStore } from 'pinia'
import { ref, watch } from 'vue'
import type { Direction } from '../types/models'

/**
 * Outils de la visionneuse :
 *  - pan         : déplacer la vue, toucher une ligne pour la sélectionner
 *  - perspective : placer les 4 coins de la stèle
 *  - line-rect   : tracer une ligne par un rectangle
 *  - line-poly   : tracer une ligne par un polygone (clic après clic)
 *  - sign-box    : tracer une boîte autour d'un signe
 */
export type Tool = 'pan' | 'perspective' | 'line-rect' | 'line-poly' | 'sign-box'

/**
 * Orientation d'affichage des glyphes dans la bibliothèque. Les polices
 * dessinent les signes tournés vers la GAUCHE (lecture de gauche à droite) ;
 * « right » les affiche en miroir, comme dans un texte lu de droite à gauche.
 */
export type GlyphFacing = 'left' | 'right'

export interface Toast {
  id: number
  text: string
  kind: 'info' | 'error'
}

/** Préférences personnelles gardées dans ce navigateur (pas dans le projet). */
interface Prefs {
  defaultDirection: Direction
  magnifierZoom: number
  glyphFacing: GlyphFacing
}
const PREFS_KEY = 'hieroglyph-reader:prefs'
function loadPrefs(): Prefs {
  const fallback: Prefs = { defaultDirection: 'rtl', magnifierZoom: 3, glyphFacing: 'left' }
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
  const glyphFacing = ref<GlyphFacing>(prefs.glyphFacing)
  /** Boîtes de signes sélectionnées (plusieurs possibles : Maj + clic). */
  const selectedItemIds = ref<string[]>([])
  /** Sélection multiple sans clavier (tablette) : chaque toucher ajoute/retire une boîte. */
  const multiSelect = ref(false)
  /** Demande de placer le curseur dans la saisie rapide (compteur incrémenté). */
  const quickEntryFocus = ref(0)
  let toastId = 1

  watch([defaultDirection, magnifierZoom, glyphFacing], () => {
    try {
      localStorage.setItem(
        PREFS_KEY,
        JSON.stringify({
          defaultDirection: defaultDirection.value,
          magnifierZoom: magnifierZoom.value,
          glyphFacing: glyphFacing.value,
        }),
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
    glyphFacing,
    selectedItemIds,
    multiSelect,
    quickEntryFocus,
    notify,
  }
})
