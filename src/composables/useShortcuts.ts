/**
 * Raccourcis clavier globaux. Ils sont ignorés quand on tape dans un champ
 * de texte (sauf Échap), pour ne pas gêner la saisie.
 */
import { onBeforeUnmount, onMounted } from 'vue'

export interface Shortcut {
  /** ex. 'mod+z', 'mod+shift+z', 'l', '?', 'escape' — « mod » = Ctrl (ou ⌘ sur Mac) */
  combo: string
  handler: (e: KeyboardEvent) => void
  /** Actif même dans un champ de texte. */
  inInputs?: boolean
}

function comboOf(e: KeyboardEvent): string {
  const parts: string[] = []
  if (e.ctrlKey || e.metaKey) parts.push('mod')
  if (e.altKey) parts.push('alt')
  const key = e.key.length === 1 ? e.key.toLowerCase() : e.key.toLowerCase()
  // Maj est implicite pour les symboles comme « ? ».
  if (e.shiftKey && /^[a-z]$|^arrow|^enter$|^tab$/.test(key)) parts.push('shift')
  parts.push(key)
  return parts.join('+')
}

export function isTypingTarget(t: EventTarget | null): boolean {
  const el = t as HTMLElement | null
  if (!el) return false
  const tag = el.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable
}

export function useShortcuts(list: () => Shortcut[]) {
  function onKey(e: KeyboardEvent) {
    const combo = comboOf(e)
    const typing = isTypingTarget(e.target)
    for (const s of list()) {
      if (s.combo !== combo) continue
      if (typing && !s.inInputs) continue
      e.preventDefault()
      s.handler(e)
      return
    }
  }
  onMounted(() => window.addEventListener('keydown', onKey))
  onBeforeUnmount(() => window.removeEventListener('keydown', onKey))
}
