/**
 * Bibliothèque de signes = signes de départ (fichier signs.seed.json)
 * + vos ajouts et modifications (enregistrés dans le navigateur).
 *
 * Un signe modifié par vous remplace celui de départ portant le même code ;
 * « Rétablir l'original » efface votre version.
 */
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import seedFile from '../data/signs.seed.json'
import * as db from '../persistence/db'
import { downloadText } from '../persistence/projectFile'
import { compareCodes, normalizeCode, categoryOf, unicodeFor } from '../core/gardiner'
import { normalizeTranslit } from '../core/translit'
import { useHistoryStore } from './history'
import { useUiStore } from './ui'
import type { Sign, SignKind } from '../types/models'

export type SignOrigin = 'seed' | 'modified' | 'custom'
export interface LibrarySign extends Sign {
  origin: SignOrigin
}

const SEED: Sign[] = (seedFile as { signs: Sign[] }).signs
const SEED_BY_CODE = new Map(SEED.map((s) => [s.gardiner, s]))
export const SEED_WARNING: string = (seedFile as { avertissement: string }).avertissement
const KINDS: SignKind[] = ['ideogram', 'uniliteral', 'biliteral', 'triliteral', 'determinative']

/** Nettoie et vérifie un signe saisi à la main. Lance une erreur lisible si invalide. */
export function sanitizeSign(input: Partial<Sign>): Sign {
  const code = normalizeCode(input.gardiner ?? '')
  if (!code) throw new Error('Code Gardiner invalide (exemples : G17, Aa1, N35A).')
  const kind = (input.kind ?? []).filter((k): k is SignKind => KINDS.includes(k as SignKind))
  if (!kind.length) throw new Error('Choisissez au moins un type.')
  return {
    gardiner: code,
    unicode: (input.unicode ?? '').trim() || unicodeFor(code),
    translit: [...new Set((input.translit ?? []).map((t) => normalizeTranslit(t.trim())).filter(Boolean))],
    kind,
    descriptionFr: (input.descriptionFr ?? '').trim(),
    category: categoryOf(code),
    verified: !!input.verified,
    notes: input.notes?.trim() || undefined,
  }
}

export const useLibraryStore = defineStore('library', () => {
  /** Vos signes (ajoutés ou modifiés). */
  const custom = ref<Sign[]>([])
  const loaded = ref(false)
  const history = useHistoryStore()

  const signs = computed<LibrarySign[]>(() => {
    const map = new Map<string, LibrarySign>()
    for (const s of SEED) map.set(s.gardiner, { ...s, origin: 'seed' })
    for (const s of custom.value) map.set(s.gardiner, { ...s, origin: SEED_BY_CODE.has(s.gardiner) ? 'modified' : 'custom' })
    return [...map.values()].sort((a, b) => compareCodes(a.gardiner, b.gardiner))
  })
  const byCode = computed(() => new Map(signs.value.map((s) => [s.gardiner, s])))
  const stats = computed(() => ({
    total: signs.value.length,
    verified: signs.value.filter((s) => s.verified).length,
    custom: custom.value.length,
  }))

  history.register('library', {
    snapshot: () => JSON.stringify(custom.value),
    restore: (text) => {
      custom.value = JSON.parse(text)
      void db.replaceCustomSigns(custom.value)
    },
  })

  async function load() {
    if (loaded.value) return
    try {
      custom.value = await db.listCustomSigns()
    } catch (e) {
      useUiStore().notify(`Bibliothèque personnelle illisible : ${(e as Error).message}`, 'error')
    }
    loaded.value = true
  }

  function get(code: string): LibrarySign | undefined {
    return byCode.value.get(code)
  }

  /** Ajoute ou remplace un signe. `previousCode` : si l'on a changé le code d'un signe existant. */
  async function save(input: Partial<Sign>, previousCode?: string): Promise<Sign> {
    const sign = sanitizeSign(input)
    const isNew = !byCode.value.has(sign.gardiner)
    history.record('library', isNew ? `Ajouter le signe ${sign.gardiner}` : `Modifier le signe ${sign.gardiner}`)
    let next = custom.value.filter((s) => s.gardiner !== sign.gardiner)
    if (previousCode && previousCode !== sign.gardiner) next = next.filter((s) => s.gardiner !== previousCode)
    // Si le signe est identique à l'original, inutile de garder une copie.
    const seed = SEED_BY_CODE.get(sign.gardiner)
    if (!seed || JSON.stringify(sanitizeSign(seed)) !== JSON.stringify(sign)) next.push(sign)
    custom.value = next
    await db.replaceCustomSigns(next)
    return sign
  }

  async function setVerified(code: string, verified: boolean) {
    const s = get(code)
    if (!s) return
    const { origin: _origin, ...plain } = s
    await save({ ...plain, verified })
  }

  /** Signe personnel : le supprime. Signe de départ modifié : rétablit l'original. */
  async function removeOrRevert(code: string) {
    const s = get(code)
    if (!s || s.origin === 'seed') return
    history.record('library', s.origin === 'custom' ? `Supprimer le signe ${code}` : `Rétablir le signe ${code}`)
    custom.value = custom.value.filter((x) => x.gardiner !== code)
    await db.replaceCustomSigns(custom.value)
  }

  /** Télécharge toute la bibliothèque (départ + vos modifications). */
  function exportLibrary() {
    const data = {
      format: 'hieroglyph-reader-signs',
      formatVersion: 1,
      exportedAt: new Date().toISOString(),
      avertissement: SEED_WARNING,
      signs: signs.value.map(({ origin: _o, ...s }) => s),
    }
    downloadText('bibliotheque-signes.json', JSON.stringify(data, null, 1))
  }

  /** Importe des signes : ceux qui diffèrent de la bibliothèque actuelle sont ajoutés/remplacés. */
  async function importLibrary(file: File): Promise<number> {
    let data: unknown
    try {
      data = JSON.parse(await file.text())
    } catch {
      throw new Error("Ce fichier n'est pas un JSON valide.")
    }
    const list = (data as { signs?: unknown }).signs
    if (!Array.isArray(list)) throw new Error('Aucune liste « signs » dans ce fichier.')
    const incoming: Sign[] = []
    const errors: string[] = []
    for (const raw of list) {
      try {
        incoming.push(sanitizeSign(raw as Partial<Sign>))
      } catch (e) {
        errors.push(`${(raw as Sign)?.gardiner ?? '?'} : ${(e as Error).message}`)
      }
    }
    const changed = incoming.filter((s) => {
      const cur = get(s.gardiner)
      if (!cur) return true
      const { origin: _o, ...plain } = cur
      return JSON.stringify(sanitizeSign(plain)) !== JSON.stringify(s)
    })
    if (changed.length) {
      history.record('library', `Importer ${changed.length} signe(s)`)
      const codes = new Set(changed.map((s) => s.gardiner))
      custom.value = [...custom.value.filter((s) => !codes.has(s.gardiner)), ...changed]
      await db.replaceCustomSigns(custom.value)
    }
    if (errors.length) useUiStore().notify(`${errors.length} signe(s) ignoré(s) : ${errors.slice(0, 3).join(' ; ')}`, 'error', 8000)
    return changed.length
  }

  return { signs, byCode, stats, loaded, load, get, save, setVerified, removeOrRevert, exportLibrary, importLibrary }
})
