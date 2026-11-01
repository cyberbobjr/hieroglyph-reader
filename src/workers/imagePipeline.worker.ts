/// <reference lib="webworker" />
/**
 * Web Worker : calcule l'image de travail (redressement + filtres lourds)
 * en arrière-plan, pour que l'interface reste fluide.
 */
import { warpPerspective, type PixelBuffer } from '../core/homography'
import { autoContrast, enhanceRelief } from '../core/imageOps'
import type { PipelineRequest, PipelineResponse } from './pipelineTypes'

let original: PixelBuffer | null = null
let rectified: { key: string; buf: PixelBuffer } | null = null

function readPixels(bitmap: ImageBitmap): PixelBuffer {
  const canvas = new OffscreenCanvas(bitmap.width, bitmap.height)
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!
  ctx.drawImage(bitmap, 0, 0)
  bitmap.close()
  const img = ctx.getImageData(0, 0, canvas.width, canvas.height)
  return { data: img.data, width: img.width, height: img.height }
}

function toBitmap(buf: PixelBuffer): ImageBitmap {
  const canvas = new OffscreenCanvas(buf.width, buf.height)
  const ctx = canvas.getContext('2d')!
  ctx.putImageData(new ImageData(new Uint8ClampedArray(buf.data), buf.width, buf.height), 0, 0)
  return canvas.transferToImageBitmap()
}

const post = (msg: PipelineResponse, transfer: Transferable[] = []) =>
  (self as unknown as DedicatedWorkerGlobalScope).postMessage(msg, transfer)

self.onmessage = (ev: MessageEvent<PipelineRequest>) => {
  const msg = ev.data
  try {
    if (msg.type === 'load') {
      original = readPixels(msg.bitmap)
      rectified = null
      post({ type: 'loaded', jobId: msg.jobId, width: original.width, height: original.height })
      return
    }
    if (!original) throw new Error('Aucune image chargée.')
    let base = original
    if (msg.perspective) {
      const key = JSON.stringify(msg.perspective)
      if (!rectified || rectified.key !== key) {
        const p = msg.perspective
        rectified = { key, buf: warpPerspective(original, p.corners, p.width, p.height) }
      }
      base = rectified.buf
    }
    let buf = base
    if (msg.autoContrast) buf = autoContrast(buf)
    if (msg.relief > 0) buf = enhanceRelief(buf, msg.relief, msg.reliefMode)
    const bitmap = toBitmap(buf)
    post({ type: 'rendered', jobId: msg.jobId, bitmap, width: buf.width, height: buf.height }, [bitmap])
  } catch (e) {
    post({ type: 'error', jobId: msg.jobId, message: e instanceof Error ? e.message : String(e) })
  }
}
