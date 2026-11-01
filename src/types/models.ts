/**
 * Modèle de données de Hieroglyph Reader.
 *
 * Toutes les coordonnées (lignes, boîtes) sont exprimées en pixels de
 * l'« image de travail » : l'image redressée si une correction de
 * perspective est appliquée, sinon l'image d'origine.
 */

export interface Point {
  x: number
  y: number
}

export interface Rect {
  x: number
  y: number
  w: number
  h: number
}

/** Quadrilatère : coins haut-gauche, haut-droit, bas-droit, bas-gauche (dans cet ordre). */
export type Quad = [Point, Point, Point, Point]

/** Correction de perspective : 4 coins dans l'image d'origine + taille de sortie. */
export interface Perspective {
  corners: Quad
  width: number
  height: number
}

export type ReliefMode = 'unsharp' | 'emboss'

/** Réglages d'affichage. Ils ne modifient jamais l'image d'origine. */
export interface ImageFilters {
  grayscale: boolean
  invert: boolean
  autoContrast: boolean
  /** Luminosité en % (100 = neutre). */
  brightness: number
  /** Contraste en % (100 = neutre). */
  contrast: number
  /** Intensité d'accentuation du relief (0 = désactivée). */
  relief: number
  reliefMode: ReliefMode
}

export const DEFAULT_FILTERS: ImageFilters = {
  grayscale: false,
  invert: false,
  autoContrast: false,
  brightness: 100,
  contrast: 100,
  relief: 0,
  reliefMode: 'unsharp',
}

// ---------------------------------------------------------------------------
// Signes de la bibliothèque (étape 3)
// ---------------------------------------------------------------------------

export type SignKind =
  | 'ideogram' // idéogramme (logogramme)
  | 'uniliteral' // phonogramme unilitère
  | 'biliteral' // phonogramme bilitère
  | 'triliteral' // phonogramme trilitère
  | 'determinative' // déterminatif

export interface Sign {
  /** Code Gardiner, ex. « G17 », « Aa1 ». */
  gardiner: string
  /** Caractère Unicode (bloc Egyptian Hieroglyphs), peut être vide. */
  unicode: string
  /** Valeurs de translittération, ex. ["m"]. */
  translit: string[]
  /** Types d'emploi (un signe peut en avoir plusieurs). */
  kind: SignKind[]
  descriptionFr: string
  /** Catégorie Gardiner : A…Z ou Aa. */
  category: string
  verified: boolean
  notes?: string
}

// ---------------------------------------------------------------------------
// Lignes, boîtes et groupes (étapes 2 et 4)
// ---------------------------------------------------------------------------

/** Sens de lecture : vers la gauche (rtl) ou vers la droite (ltr). */
export type Direction = 'rtl' | 'ltr'
/** Ligne horizontale (row) ou colonne verticale (column). */
export type Orientation = 'row' | 'column'

export type LineGeometry =
  | { type: 'rect'; rect: Rect }
  | { type: 'polygon'; points: Point[] }

export type SignStatus = 'certain' | 'probable' | 'incertain' | 'lacune'

export interface Item {
  id: string
  bbox: Rect
  /** Carré (quadrat) auquel la boîte appartient, s'il y en a un. */
  groupId?: string
  signCode?: string
  status: SignStatus
  note: string
}

export interface Line {
  id: string
  number: number
  direction: Direction
  orientation: Orientation
  geometry: LineGeometry
  /** Boîtes, rangées dans l'ordre de lecture. */
  items: Item[]
  /** true si l'ordre a été corrigé à la main (on ne le recalcule plus). */
  manualOrder: boolean
}

export type GroupKind = 'quadrat' | 'cartouche'

export interface Group {
  id: string
  lineId: string
  kind: GroupKind
  /** Pour un carré : ids des boîtes. Pour un cartouche : ids des boîtes aussi. */
  memberIds: string[]
  /** Disposition MdC forcée à la main (sinon calculée d'après les boîtes). */
  layoutOverride?: string
}

// ---------------------------------------------------------------------------
// Projet
// ---------------------------------------------------------------------------

export const PROJECT_FORMAT_VERSION = 1

export interface Project {
  id: string
  name: string
  formatVersion: number
  createdAt: number
  updatedAt: number
  /** Informations sur l'image d'origine (le fichier lui-même est stocké à part). */
  image: { name: string; type: string; width: number; height: number } | null
  perspective: Perspective | null
  filters: ImageFilters
  lines: Line[]
  groups: Group[]
  notes: string
}

/** Résumé affiché dans la liste des stèles. */
export interface ProjectMeta {
  id: string
  name: string
  createdAt: number
  updatedAt: number
  lineCount: number
  signCount: number
  /** Petite vignette JPEG en data URL. */
  thumbnail?: string
}
