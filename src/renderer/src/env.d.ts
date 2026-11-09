/// <reference types="vite/client" />
import type { StoreApi } from '@shared/types'

declare global {
  const __BUILD_TIME__: string
  interface Window {
    vialintia: StoreApi
  }
}

export {}
