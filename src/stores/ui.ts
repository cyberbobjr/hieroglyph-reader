import { defineStore } from 'pinia'
import { ref } from 'vue'

export type Tool = 'pan' | 'perspective'

export interface Toast {
  id: number
  text: string
  kind: 'info' | 'error'
}

export const useUiStore = defineStore('ui', () => {
  const tool = ref<Tool>('pan')
  const magnifier = ref(false)
  const magnifierZoom = ref(3)
  const filtersOpen = ref(false)
  const helpOpen = ref(false)
  const toasts = ref<Toast[]>([])
  let toastId = 1

  function notify(text: string, kind: Toast['kind'] = 'info', ms = 3500) {
    const id = toastId++
    toasts.value.push({ id, text, kind })
    setTimeout(() => (toasts.value = toasts.value.filter((t) => t.id !== id)), ms)
  }

  return { tool, magnifier, magnifierZoom, filtersOpen, helpOpen, toasts, notify }
})
