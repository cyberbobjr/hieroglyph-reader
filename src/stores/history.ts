/**
 * Annuler / rétablir.
 *
 * Principe : avant chaque modification, on garde une « photo » (instantané)
 * de l'état du projet sous forme de texte JSON. Annuler = revenir à la photo
 * précédente. C'est simple et fiable pour TOUTES les actions.
 * Le projet est léger (l'image n'en fait pas partie), donc ça coûte peu.
 */
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

interface Entry {
  label: string
  snapshot: string
  key?: string
  at: number
}

const MAX_ENTRIES = 150
/** Deux modifications de même clé à moins de 800 ms comptent pour une (ex. curseur). */
const COALESCE_MS = 800

export const useHistoryStore = defineStore('history', () => {
  const undoStack = ref<Entry[]>([])
  const redoStack = ref<Entry[]>([])

  const canUndo = computed(() => undoStack.value.length > 0)
  const canRedo = computed(() => redoStack.value.length > 0)
  const undoLabel = computed(() => undoStack.value.at(-1)?.label ?? '')
  const redoLabel = computed(() => redoStack.value.at(-1)?.label ?? '')

  /**
   * À appeler AVANT une modification. `snapshot` fournit l'état actuel ; il
   * n'est calculé que si nécessaire (pas pour un geste déjà enregistré).
   */
  function record(label: string, snapshot: () => string, key?: string) {
    const last = undoStack.value.at(-1)
    const now = Date.now()
    if (key && last?.key === key && now - last.at < COALESCE_MS) {
      last.at = now
    } else {
      undoStack.value.push({ label, snapshot: snapshot(), key, at: now })
      if (undoStack.value.length > MAX_ENTRIES) undoStack.value.shift()
    }
    redoStack.value = []
  }

  /** Renvoie l'état à restaurer, ou null. `current` = état actuel (pour rétablir). */
  function undo(current: string): { snapshot: string; label: string } | null {
    const e = undoStack.value.pop()
    if (!e) return null
    redoStack.value.push({ label: e.label, snapshot: current, at: Date.now() })
    return { snapshot: e.snapshot, label: e.label }
  }

  function redo(current: string): { snapshot: string; label: string } | null {
    const e = redoStack.value.pop()
    if (!e) return null
    undoStack.value.push({ label: e.label, snapshot: current, at: 0 })
    return { snapshot: e.snapshot, label: e.label }
  }

  function clear() {
    undoStack.value = []
    redoStack.value = []
  }

  return { canUndo, canRedo, undoLabel, redoLabel, record, undo, redo, clear }
})
