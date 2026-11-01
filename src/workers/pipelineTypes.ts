import type { Perspective, ReliefMode } from '../types/models'

export type PipelineRequest =
  | { type: 'load'; jobId: number; bitmap: ImageBitmap }
  | {
      type: 'render'
      jobId: number
      perspective: Perspective | null
      autoContrast: boolean
      relief: number
      reliefMode: ReliefMode
    }

export type PipelineResponse =
  | { type: 'loaded'; jobId: number; width: number; height: number }
  | { type: 'rendered'; jobId: number; bitmap: ImageBitmap; width: number; height: number }
  | { type: 'error'; jobId: number; message: string }
