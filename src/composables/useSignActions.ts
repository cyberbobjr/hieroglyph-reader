/**
 * Actions sur les signes, partagées par le panneau « Signe », les raccourcis
 * clavier et la saisie rapide. Toutes passent par store.mutate : elles sont
 * donc annulables et enregistrées automatiquement.
 */
import { useProjectStore } from '../stores/project'
import { useUiStore } from '../stores/ui'
import * as items from '../core/items'
import type { SignStatus } from '../types/models'

export const STATUS_LABELS: Record<SignStatus, string> = {
  certain: 'Certain',
  probable: 'Probable',
  incertain: 'Incertain',
  lacune: 'Lacune',
}
export const STATUS_HELP: Record<SignStatus, string> = {
  certain: 'Lecture sûre',
  probable: 'Lecture vraisemblable',
  incertain: 'Lecture douteuse',
  lacune: 'Signe détruit ou illisible',
}

export function useSignActions() {
  const store = useProjectStore()
  const ui = useUiStore()

  /** Exécute une modification ; si elle est refusée, affiche la raison. */
  function run(label: string, fn: Parameters<typeof store.mutate>[1]): boolean {
    try {
      store.mutate(label, fn)
      return true
    } catch (e) {
      ui.notify((e as Error).message, 'error')
      return false
    }
  }

  function select(id: string | null) {
    ui.selectedItemIds = id ? [id] : []
    const p = store.project
    if (id && p) ui.selectedLineId = items.findItem(p, id)?.line.id ?? ui.selectedLineId
  }

  function assign(itemId: string, code: string | null, status?: SignStatus) {
    const what = code ? `Signe ${code}` : status === 'lacune' ? 'Lacune' : 'Effacer le signe'
    return run(what, (p) => {
      const f = items.findItem(p, itemId)
      if (!f) return
      if (code) f.item.signCode = code
      else if (code === null && status !== 'lacune') delete f.item.signCode
      if (status) f.item.status = status
      else if (code && f.item.status === 'lacune') f.item.status = 'certain'
    })
  }

  function setStatus(ids: string[], status: SignStatus) {
    return run(`Statut : ${STATUS_LABELS[status].toLowerCase()}`, (p) => items.setStatus(p, ids, status))
  }

  function setNote(itemId: string, note: string) {
    try {
      store.mutate('Note du signe', (p) => {
        const f = items.findItem(p, itemId)
        if (f) f.item.note = note
      }, `note-${itemId}`)
    } catch (e) {
      ui.notify((e as Error).message, 'error')
    }
  }

  // Après un regroupement, on quitte la sélection multiple.
  const groupQuadrat = (ids: string[]) => {
    const ok = run('Grouper en carré', (p) => void items.groupQuadrat(p, ids))
    if (ok) ui.multiSelect = false
    return ok
  }
  const ungroup = (groupId: string) => run('Défaire le carré', (p) => items.ungroup(p, groupId))
  const makeCartouche = (ids: string[]) => {
    const ok = run('Créer un cartouche', (p) => void items.makeCartouche(p, ids))
    if (ok) ui.multiSelect = false
    return ok
  }
  const removeGroup = (groupId: string) => run('Retirer le cartouche', (p) => items.removeGroup(p, groupId))

  function moveInOrder(itemId: string, delta: -1 | 1) {
    return run(delta < 0 ? 'Avancer le signe dans l’ordre' : 'Reculer le signe dans l’ordre', (p) => {
      if (!items.moveInOrder(p, itemId, delta)) throw new Error(delta < 0 ? 'Déjà en tête.' : 'Déjà en dernier.')
    })
  }

  function autoOrder(lineId: string) {
    return run("Recalculer l'ordre de lecture", (p) => {
      const line = p.lines.find((l) => l.id === lineId)
      if (line) items.reorderLine(p, line, true)
    })
  }

  function deleteItems(ids: string[]) {
    if (!ids.length) return false
    const ok = run(ids.length > 1 ? `Supprimer ${ids.length} signes` : 'Supprimer le signe', (p) => items.deleteItems(p, ids))
    if (ok) ui.selectedItemIds = []
    return ok
  }

  /** Va à la boîte voisine dans l'ordre de lecture de toute la stèle. */
  function go(delta: -1 | 1): boolean {
    const p = store.project
    const cur = ui.selectedItemIds[0]
    if (!p) return false
    const next = cur ? items.neighbourItem(p, cur, delta) : items.allItemsInOrder(p)[0]?.item ?? null
    if (!next) {
      ui.notify(delta > 0 ? 'C’était la dernière boîte.' : 'C’est la première boîte.')
      return false
    }
    select(next.id)
    return true
  }

  return { select, assign, setStatus, setNote, groupQuadrat, ungroup, makeCartouche, removeGroup, moveInOrder, autoOrder, deleteItems, go }
}
