/** Identifiant unique court. crypto.randomUUID n'existe que dans un contexte sécurisé. */
export function newId(prefix = ''): string {
  const raw =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID().replace(/-/g, '').slice(0, 12)
      : Math.random().toString(36).slice(2, 14)
  return prefix + raw
}

/**
 * Copie profonde d'un objet simple. On n'utilise pas structuredClone car il
 * échoue sur les objets « réactifs » de Vue (ce sont des Proxy).
 */
export function clone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T
}
