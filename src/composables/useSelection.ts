/** Boîtes de signes sélectionnées, avec leur ligne. */
import { computed } from 'vue'
import { useProjectStore } from '../stores/project'
import { useUiStore } from '../stores/ui'
import { findItem } from '../core/items'

export function useSelection() {
  const store = useProjectStore()
  const ui = useUiStore()
  const selected = computed(() => {
    const p = store.project
    if (!p) return []
    return ui.selectedItemIds.map((id) => findItem(p, id)).filter((f): f is NonNullable<typeof f> => !!f)
  })
  const single = computed(() => (selected.value.length === 1 ? selected.value[0] : null))
  return { selected, single }
}
