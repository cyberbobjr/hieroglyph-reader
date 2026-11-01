/**
 * Fichier projet JSON : contient tout le projet ET la photo (encodée en
 * base64), pour pouvoir le sauvegarder ou le transférer sur un autre appareil.
 */
import { PROJECT_FORMAT_VERSION, DEFAULT_FILTERS, type Project } from '../types/models'

export const FILE_FORMAT = 'hieroglyph-reader-project'

export interface ProjectFile {
  format: typeof FILE_FORMAT
  formatVersion: number
  exportedAt: string
  project: Project
  /** Photo d'origine en data URL (peut être absente). */
  image?: string
}

export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(r.result as string)
    r.onerror = () => reject(r.error)
    r.readAsDataURL(blob)
  })
}

export async function dataUrlToBlob(dataUrl: string): Promise<Blob> {
  return (await fetch(dataUrl)).blob()
}

export async function buildProjectFile(project: Project, image?: Blob): Promise<ProjectFile> {
  return {
    format: FILE_FORMAT,
    formatVersion: PROJECT_FORMAT_VERSION,
    exportedAt: new Date().toISOString(),
    project: JSON.parse(JSON.stringify(project)),
    image: image ? await blobToDataUrl(image) : undefined,
  }
}

/** Vérifie le contenu d'un fichier importé et complète les champs manquants. */
export function parseProjectFile(text: string): ProjectFile {
  let data: unknown
  try {
    data = JSON.parse(text)
  } catch {
    throw new Error("Ce fichier n'est pas un JSON valide.")
  }
  const f = data as Partial<ProjectFile>
  if (!f || f.format !== FILE_FORMAT || !f.project) {
    throw new Error("Ce fichier n'est pas un projet Hieroglyph Reader.")
  }
  if ((f.formatVersion ?? 0) > PROJECT_FORMAT_VERSION) {
    throw new Error('Ce projet vient d’une version plus récente de l’application.')
  }
  const p = f.project as Project
  if (typeof p.id !== 'string' || !Array.isArray(p.lines)) {
    throw new Error('Projet incomplet ou endommagé.')
  }
  p.filters = { ...DEFAULT_FILTERS, ...(p.filters ?? {}) }
  p.groups ??= []
  p.notes ??= ''
  p.perspective ??= null
  return f as ProjectFile
}

/** Déclenche le téléchargement d'un fichier texte. */
export function downloadText(filename: string, text: string, type = 'application/json') {
  const url = URL.createObjectURL(new Blob([text], { type }))
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function safeFilename(name: string): string {
  return (
    name
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-zA-Z0-9-_]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .toLowerCase() || 'stele'
  )
}
