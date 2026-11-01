/**
 * Stockage local dans IndexedDB (la base de données intégrée au navigateur).
 * Rien ne quitte l'appareil.
 *
 *  - projects : le projet complet (lignes, boîtes…), sans l'image
 *  - meta     : un résumé léger pour la liste des stèles
 *  - images   : le fichier photo d'origine (Blob)
 *  - signs    : les signes ajoutés ou modifiés dans la bibliothèque
 */
import { openDB, type DBSchema, type IDBPDatabase } from 'idb'
import type { Project, ProjectMeta, Sign } from '../types/models'

interface HRSchema extends DBSchema {
  projects: { key: string; value: Project }
  meta: { key: string; value: ProjectMeta; indexes: { updatedAt: number } }
  images: { key: string; value: { id: string; blob: Blob } }
  signs: { key: string; value: Sign }
}

let dbPromise: Promise<IDBPDatabase<HRSchema>> | null = null

export function getDb() {
  if (!dbPromise) {
    dbPromise = openDB<HRSchema>('hieroglyph-reader', 1, {
      upgrade(db) {
        db.createObjectStore('projects', { keyPath: 'id' })
        const meta = db.createObjectStore('meta', { keyPath: 'id' })
        meta.createIndex('updatedAt', 'updatedAt')
        db.createObjectStore('images', { keyPath: 'id' })
        db.createObjectStore('signs', { keyPath: 'gardiner' })
      },
    })
  }
  return dbPromise
}

export function metaOf(p: Project, thumbnail?: string): ProjectMeta {
  return {
    id: p.id,
    name: p.name,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
    lineCount: p.lines.length,
    signCount: p.lines.reduce((n, l) => n + l.items.length, 0),
    thumbnail,
  }
}

export async function listProjects(): Promise<ProjectMeta[]> {
  const db = await getDb()
  const all = await db.getAll('meta')
  return all.sort((a, b) => b.updatedAt - a.updatedAt)
}

export async function loadProject(id: string): Promise<Project | undefined> {
  return (await getDb()).get('projects', id)
}

export async function loadImage(id: string): Promise<Blob | undefined> {
  return (await getDb()).get('images', id).then((r) => r?.blob)
}

/** Enregistre le projet (et son image si fournie) en une seule transaction. */
export async function saveProject(p: Project, opts: { image?: Blob; thumbnail?: string } = {}) {
  const db = await getDb()
  const tx = db.transaction(['projects', 'meta', 'images'], 'readwrite')
  const previous = await tx.objectStore('meta').get(p.id)
  // JSON aller-retour : retire les proxys réactifs de Vue avant stockage.
  const plain: Project = JSON.parse(JSON.stringify(p))
  await tx.objectStore('projects').put(plain)
  await tx.objectStore('meta').put(metaOf(plain, opts.thumbnail ?? previous?.thumbnail))
  if (opts.image) await tx.objectStore('images').put({ id: p.id, blob: opts.image })
  await tx.done
}

export async function deleteProject(id: string) {
  const db = await getDb()
  const tx = db.transaction(['projects', 'meta', 'images'], 'readwrite')
  await Promise.all([
    tx.objectStore('projects').delete(id),
    tx.objectStore('meta').delete(id),
    tx.objectStore('images').delete(id),
    tx.done,
  ])
}

export async function renameProject(id: string, name: string) {
  const p = await loadProject(id)
  if (!p) return
  p.name = name
  p.updatedAt = Date.now()
  await saveProject(p)
}

// --- Bibliothèque personnalisée (étape 3) ---------------------------------
export async function listCustomSigns(): Promise<Sign[]> {
  return (await getDb()).getAll('signs')
}
export async function saveCustomSign(s: Sign) {
  await (await getDb()).put('signs', JSON.parse(JSON.stringify(s)))
}
export async function deleteCustomSign(code: string) {
  await (await getDb()).delete('signs', code)
}
