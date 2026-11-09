import { useEffect, useState } from 'react'
import { create } from 'zustand'

// ---------- hash router ----------
export type Route =
  | { name: 'dashboard' }
  | { name: 'formula'; id: string }
  | { name: 'assemble'; id: string }
  | { name: 'library' }
  | { name: 'compare'; a?: string; b?: string }
  | { name: 'settings' }

export function parseHash(hash: string): Route {
  const [path, query = ''] = hash.replace(/^#/, '').split('?')
  const parts = path.split('/').filter(Boolean)
  const q = new URLSearchParams(query)
  switch (parts[0]) {
    case 'formula':
      if (parts[1] && parts[2] === 'assemble') return { name: 'assemble', id: parts[1] }
      return parts[1] ? { name: 'formula', id: parts[1] } : { name: 'dashboard' }
    case 'library':
      return { name: 'library' }
    case 'compare':
      return { name: 'compare', a: q.get('a') ?? undefined, b: q.get('b') ?? undefined }
    case 'settings':
      return { name: 'settings' }
    default:
      return { name: 'dashboard' }
  }
}

export function navigate(path: string) {
  location.hash = path.startsWith('#') ? path : `#${path}`
}

export function useRoute(): Route {
  const [route, setRoute] = useState(() => parseHash(location.hash))
  useEffect(() => {
    const on = () => setRoute(parseHash(location.hash))
    window.addEventListener('hashchange', on)
    return () => window.removeEventListener('hashchange', on)
  }, [])
  return route
}

// ---------- toasts & confirm dialog ----------
interface Toast {
  id: number
  text: string
}

interface ConfirmReq {
  title: string
  message: string
  confirmLabel: string
  resolve: (ok: boolean) => void
}

interface UiState {
  toasts: Toast[]
  confirmReq: ConfirmReq | null
  toast(text: string): void
  dismiss(id: number): void
  setConfirm(req: ConfirmReq | null): void
}

let toastId = 0

export const useUi = create<UiState>((set) => ({
  toasts: [],
  confirmReq: null,
  toast(text) {
    const id = ++toastId
    set((s) => ({ toasts: [...s.toasts, { id, text }] }))
    setTimeout(() => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })), 3200)
  },
  dismiss(id) {
    set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }))
  },
  setConfirm(req) {
    set({ confirmReq: req })
  }
}))

export function toast(text: string) {
  useUi.getState().toast(text)
}

export function confirmDialog(title: string, message: string, confirmLabel = 'Delete'): Promise<boolean> {
  return new Promise((resolve) => useUi.getState().setConfirm({ title, message, confirmLabel, resolve }))
}
