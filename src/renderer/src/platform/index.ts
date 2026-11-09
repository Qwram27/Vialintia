import { createWebApi } from './web'

/** True when running as the browser / iPhone web app (no Electron preload). */
export const isWeb = typeof window !== 'undefined' && !('vialintia' in window)

/** Install the browser StoreApi when the Electron preload is not present. */
export function installPlatform(): void {
  if (isWeb) window.vialintia = createWebApi()
}
