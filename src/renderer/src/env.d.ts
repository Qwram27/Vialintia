import type { StoreApi } from '@shared/types'

declare global {
  interface Window {
    vialintia: StoreApi
  }
}

export {}
