/**
 * Pilote du Web Worker d'image. Si l'on bouge un curseur rapidement, seules
 * les demandes les plus récentes nous intéressent : les réponses périmées
 * sont ignorées.
 */
import type { PipelineRequest, PipelineResponse } from '../workers/pipelineTypes'
import type { Perspective, ReliefMode } from '../types/models'

export interface RenderOptions {
  perspective: Perspective | null
  autoContrast: boolean
  relief: number
  reliefMode: ReliefMode
}

export class ImagePipeline {
  private worker = new Worker(new URL('../workers/imagePipeline.worker.ts', import.meta.url), {
    type: 'module',
  })
  private nextId = 1
  private latestRender = 0
  private pending = new Map<number, { resolve: (r: PipelineResponse) => void; reject: (e: Error) => void }>()

  constructor() {
    this.worker.onmessage = (ev: MessageEvent<PipelineResponse>) => {
      const p = this.pending.get(ev.data.jobId)
      if (!p) return
      this.pending.delete(ev.data.jobId)
      if (ev.data.type === 'error') p.reject(new Error(ev.data.message))
      else p.resolve(ev.data)
    }
  }

  private send(msg: PipelineRequest, transfer: Transferable[] = []): Promise<PipelineResponse> {
    return new Promise((resolve, reject) => {
      this.pending.set(msg.jobId, { resolve, reject })
      this.worker.postMessage(msg, transfer)
    })
  }

  async load(bitmap: ImageBitmap): Promise<{ width: number; height: number }> {
    const r = await this.send({ type: 'load', jobId: this.nextId++, bitmap }, [bitmap])
    if (r.type !== 'loaded') throw new Error('Réponse inattendue du worker.')
    return { width: r.width, height: r.height }
  }

  /** Renvoie null si une demande plus récente a été faite entre-temps. */
  async render(opts: RenderOptions): Promise<ImageBitmap | null> {
    const jobId = this.nextId++
    this.latestRender = jobId
    const r = await this.send({ type: 'render', jobId, ...JSON.parse(JSON.stringify(opts)) })
    if (r.type !== 'rendered') throw new Error('Réponse inattendue du worker.')
    if (jobId !== this.latestRender) {
      r.bitmap.close()
      return null
    }
    return r.bitmap
  }

  dispose() {
    this.worker.terminate()
    this.pending.clear()
  }
}
