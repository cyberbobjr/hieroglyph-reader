/** Liste des stèles enregistrées (écran d'accueil). */
import { defineStore } from 'pinia'
import { ref } from 'vue'
import * as db from '../persistence/db'
import { buildProjectFile, dataUrlToBlob, downloadText, parseProjectFile, safeFilename } from '../persistence/projectFile'
import { decodeImage, makeThumbnail } from '../core/imageLoading'
import { newId } from '../core/ids'
import { DEFAULT_FILTERS, PROJECT_FORMAT_VERSION, type Project, type ProjectMeta } from '../types/models'

export function emptyProject(name: string): Project {
  const now = Date.now()
  return {
    id: newId('p_'),
    name,
    formatVersion: PROJECT_FORMAT_VERSION,
    createdAt: now,
    updatedAt: now,
    image: null,
    perspective: null,
    filters: { ...DEFAULT_FILTERS },
    lines: [],
    groups: [],
    notes: '',
  }
}

export const useProjectsStore = defineStore('projects', () => {
  const list = ref<ProjectMeta[]>([])
  const loading = ref(false)

  async function refresh() {
    loading.value = true
    try {
      list.value = await db.listProjects()
    } finally {
      loading.value = false
    }
  }

  /** Crée une stèle à partir d'une photo. Renvoie son identifiant. */
  async function createFromImage(file: File, name?: string): Promise<string> {
    const bitmap = await decodeImage(file)
    const p = emptyProject(name || file.name.replace(/\.[^.]+$/, '') || 'Nouvelle stèle')
    p.image = { name: file.name, type: file.type, width: bitmap.width, height: bitmap.height }
    const thumbnail = makeThumbnail(bitmap)
    bitmap.close()
    await db.saveProject(p, { image: file, thumbnail })
    await refresh()
    return p.id
  }

  async function remove(id: string) {
    await db.deleteProject(id)
    await refresh()
  }

  async function rename(id: string, name: string) {
    await db.renameProject(id, name.trim() || 'Sans titre')
    await refresh()
  }

  async function duplicate(id: string) {
    const p = await db.loadProject(id)
    if (!p) return
    const img = await db.loadImage(id)
    const meta = list.value.find((m) => m.id === id)
    const copy: Project = { ...structuredClone(p), id: newId('p_'), name: `${p.name} (copie)`, updatedAt: Date.now() }
    await db.saveProject(copy, { image: img, thumbnail: meta?.thumbnail })
    await refresh()
  }

  async function exportToFile(id: string) {
    const p = await db.loadProject(id)
    if (!p) return
    const file = await buildProjectFile(p, await db.loadImage(id))
    downloadText(`${safeFilename(p.name)}.hieroglyph.json`, JSON.stringify(file, null, 2))
  }

  /** Importe un fichier projet. S'il existe déjà, on crée une copie. */
  async function importFile(file: File): Promise<string> {
    const parsed = parseProjectFile(await file.text())
    const p = parsed.project
    if (await db.loadProject(p.id)) {
      p.id = newId('p_')
      p.name = `${p.name} (importé)`
    }
    let image: Blob | undefined
    let thumbnail: string | undefined
    if (parsed.image) {
      image = await dataUrlToBlob(parsed.image)
      const bitmap = await decodeImage(image)
      thumbnail = makeThumbnail(bitmap)
      bitmap.close()
    }
    await db.saveProject(p, { image, thumbnail })
    await refresh()
    return p.id
  }

  return { list, loading, refresh, createFromImage, remove, rename, duplicate, exportToFile, importFile }
})
