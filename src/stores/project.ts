/**
 * La stèle ouverte : son contenu, ses modifications, la sauvegarde
 * automatique et l'historique annuler/rétablir.
 *
 * Règle d'or : toute modification passe par `mutate()`. Ainsi, chaque
 * action peut être annulée et est enregistrée automatiquement.
 */
import { defineStore } from 'pinia'
import { computed, ref, shallowRef } from 'vue'
import * as db from '../persistence/db'
import { useHistoryStore } from './history'
import { useUiStore } from './ui'
import type { Project } from '../types/models'

const SAVE_DELAY_MS = 500

export const useProjectStore = defineStore('project', () => {
  const project = ref<Project | null>(null)
  const imageBlob = shallowRef<Blob | null>(null)
  const saveState = ref<'saved' | 'pending' | 'saving' | 'error'>('saved')
  const history = useHistoryStore()
  let saveTimer: ReturnType<typeof setTimeout> | undefined

  const isOpen = computed(() => project.value !== null)
  /** Taille de l'image de travail (redressée si une perspective est appliquée). */
  const workingSize = computed(() => {
    const p = project.value
    if (!p?.image) return { width: 0, height: 0 }
    if (p.perspective) return { width: p.perspective.width, height: p.perspective.height }
    return { width: p.image.width, height: p.image.height }
  })

  async function open(id: string): Promise<boolean> {
    await flush()
    const p = await db.loadProject(id)
    if (!p) return false
    imageBlob.value = (await db.loadImage(id)) ?? null
    project.value = p
    history.clear('project')
    saveState.value = 'saved'
    return true
  }

  async function close() {
    await flush()
    project.value = null
    imageBlob.value = null
    history.clear('project')
  }

  // La stèle ouverte est un « domaine » de l'historique annuler/rétablir.
  history.register('project', {
    snapshot: () => JSON.stringify(project.value),
    restore: (text) => {
      project.value = JSON.parse(text)
      scheduleSave()
    },
  })

  /**
   * Modifie le projet de façon annulable.
   * @param label  texte affiché dans « Annuler … »
   * @param fn     la modification
   * @param key    regroupe les modifications rapprochées (ex. un curseur qu'on fait glisser)
   */
  function mutate(label: string, fn: (p: Project) => void, key?: string) {
    if (!project.value) return
    history.record('project', label, key)
    fn(project.value)
    project.value.updatedAt = Date.now()
    scheduleSave()
  }

  function undo() {
    const label = history.undo()
    if (label) useUiStore().notify(`Annulé : ${label}`)
  }

  function redo() {
    const label = history.redo()
    if (label) useUiStore().notify(`Rétabli : ${label}`)
  }

  function scheduleSave() {
    saveState.value = 'pending'
    clearTimeout(saveTimer)
    saveTimer = setTimeout(() => void flush(), SAVE_DELAY_MS)
  }

  /** Enregistre immédiatement si une sauvegarde est en attente. */
  async function flush() {
    clearTimeout(saveTimer)
    if (!project.value || saveState.value === 'saved') return
    saveState.value = 'saving'
    try {
      await db.saveProject(project.value)
      saveState.value = 'saved'
    } catch (e) {
      saveState.value = 'error'
      useUiStore().notify(`Échec de l'enregistrement : ${(e as Error).message}`, 'error', 6000)
    }
  }

  /** Raccourci : modifier une ligne précise de façon annulable. */
  function mutateLine(id: string, label: string, fn: (line: Project['lines'][number], p: Project) => void, key?: string) {
    const line = project.value?.lines.find((l) => l.id === id)
    if (!line) return
    mutate(label, (p) => fn(p.lines.find((l) => l.id === id)!, p), key)
  }

  return { project, imageBlob, saveState, isOpen, workingSize, open, close, mutate, mutateLine, undo, redo, flush }
})
