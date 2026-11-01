/**
 * Chargement d'image côté interface.
 *
 * Les photos d'appareil récent font souvent 24 à 50 mégapixels : trop pour
 * la mémoire d'une tablette. On travaille donc sur une copie limitée à
 * MAX_PIXELS. Le calcul est déterministe : la même photo donne toujours la
 * même taille, donc les coordonnées des boîtes restent valables.
 */
export const MAX_PIXELS = 12_000_000

export function workingSize(width: number, height: number, maxPixels = MAX_PIXELS) {
  const scale = Math.min(1, Math.sqrt(maxPixels / (width * height)))
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) }
}

/** Décode un fichier image en ImageBitmap à la taille de travail. */
export async function decodeImage(blob: Blob): Promise<ImageBitmap> {
  // imageOrientation 'from-image' : respecte la rotation EXIF des photos de téléphone.
  const probe = await createImageBitmap(blob, { imageOrientation: 'from-image' })
  const size = workingSize(probe.width, probe.height)
  if (size.width === probe.width && size.height === probe.height) return probe
  probe.close()
  return createImageBitmap(blob, {
    imageOrientation: 'from-image',
    resizeWidth: size.width,
    resizeHeight: size.height,
    resizeQuality: 'high',
  })
}

/** Petite vignette JPEG (data URL) pour la liste des stèles. */
export function makeThumbnail(bitmap: ImageBitmap, maxSide = 240): string {
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(bitmap.width * scale))
  canvas.height = Math.max(1, Math.round(bitmap.height * scale))
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  return canvas.toDataURL('image/jpeg', 0.75)
}
