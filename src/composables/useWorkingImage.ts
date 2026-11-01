/**
 * Accès partagé à l'image de travail affichée (redressée + filtres lourds),
 * pour que d'autres composants (mode comparer) puissent en découper un
 * morceau. La visionneuse la publie ici à chaque nouveau rendu.
 */
import { ref, shallowRef } from 'vue'

const canvas = shallowRef<HTMLCanvasElement | null>(null)
/** Change à chaque nouveau rendu : sert à redessiner les découpes. */
const version = ref(0)
/** Filtre CSS « léger » appliqué à l'affichage (gris, inversion…). */
const cssFilter = ref('none')

export function useWorkingImage() {
  return { canvas, version, cssFilter }
}
