import { useSyncExternalStore } from 'react'

/** Phone layout breakpoint (bottom tab bar, row cards, stacked inspector). */
export const MOBILE_QUERY = '(max-width: 700px)'

const mql = typeof window !== 'undefined' ? window.matchMedia(MOBILE_QUERY) : null
const subscribe = (cb: () => void) => {
  mql?.addEventListener('change', cb)
  return () => mql?.removeEventListener('change', cb)
}

export function useIsMobile(): boolean {
  return useSyncExternalStore(subscribe, () => !!mql?.matches)
}
