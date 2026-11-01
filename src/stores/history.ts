/**
 * Annuler / rétablir, pour toute l'application.
 *
 * Principe : avant chaque modification, on garde une « photo » (instantané)
 * de l'état concerné, sous forme de texte JSON. Annuler = revenir à la photo
 * précédente. C'est simple et fiable pour TOUTES les actions.
 *
 * Plusieurs « domaines » partagent le même historique : la stèle ouverte
 * (« project ») et la bibliothèque de signes (« library »). Chaque domaine
 * explique comment se photographier et comment se restaurer.
 */
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

export interface HistoryDomain {
  snapshot(): string
  restore(snapshot: string): void
}

interface Entry {
  domain: string
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
  const domains = new Map<string, HistoryDomain>()

  const canUndo = computed(() => undoStack.value.length > 0)
  const canRedo = computed(() => redoStack.value.length > 0)
  const undoLabel = computed(() => undoStack.value.at(-1)?.label ?? '')
  const redoLabel = computed(() => redoStack.value.at(-1)?.label ?? '')

  function register(name: string, domain: HistoryDomain) {
    domains.set(name, domain)
  }

  /** À appeler AVANT une modification du domaine. */
  function record(domain: string, label: string, key?: string) {
    const d = domains.get(domain)
    if (!d) return
    const last = undoStack.value.at(-1)
    const now = Date.now()
    if (key && last?.key === key && last.domain === domain && now - last.at < COALESCE_MS) {
      last.at = now
    } else {
      undoStack.value.push({ domain, label, snapshot: d.snapshot(), key, at: now })
      if (undoStack.value.length > MAX_ENTRIES) undoStack.value.shift()
    }
    redoStack.value = []
  }

  function step(from: typeof undoStack, to: typeof undoStack): string | null {
    const e = from.value.pop()
    if (!e) return null
    const d = domains.get(e.domain)
    if (!d) return null
    to.value.push({ ...e, snapshot: d.snapshot(), key: undefined, at: 0 })
    d.restore(e.snapshot)
    return e.label
  }

  /** Retire la dernière entrée (action finalement refusée). */
  function discardLast() {
    undoStack.value.pop()
  }

  /** Renvoie le libellé de l'action annulée, ou null. */
  const undo = () => step(undoStack, redoStack)
  const redo = () => step(redoStack, undoStack)

  /** Oublie l'historique d'un domaine (ex. quand on change de stèle). */
  function clear(domain?: string) {
    const keep = (e: Entry) => domain !== undefined && e.domain !== domain
    undoStack.value = undoStack.value.filter(keep)
    redoStack.value = redoStack.value.filter(keep)
  }

  return { canUndo, canRedo, undoLabel, redoLabel, register, record, discardLast, undo, redo, clear }
})
