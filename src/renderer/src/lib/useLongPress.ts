import { useRef } from 'react'

type Point = { clientX: number; clientY: number; preventDefault(): void; stopPropagation(): void }

/**
 * Touch long-press (hold ~0.45 s without moving) → `fn` at the finger's position.
 * One hook serves a whole list: `const press = useLongPress(); <div {...press(() => …)} />`.
 * The click that follows a long-press is swallowed, so the item isn't opened as well.
 */
export function useLongPress(ms = 450) {
  const timer = useRef<number | null>(null)
  const start = useRef<{ x: number; y: number } | null>(null)
  const fired = useRef(false)
  const clear = () => {
    if (timer.current) window.clearTimeout(timer.current)
    timer.current = null
  }
  return (fn: (p: Point) => void) => ({
    onTouchStart: (e: React.TouchEvent) => {
      const t = e.touches[0]
      if (!t || e.touches.length > 1) return clear()
      start.current = { x: t.clientX, y: t.clientY }
      fired.current = false
      clear()
      timer.current = window.setTimeout(() => {
        fired.current = true
        timer.current = null
        try {
          navigator.vibrate?.(8)
        } catch {
          /* not supported */
        }
        fn({ clientX: t.clientX, clientY: t.clientY, preventDefault() {}, stopPropagation() {} })
      }, ms)
    },
    onTouchMove: (e: React.TouchEvent) => {
      const t = e.touches[0]
      if (t && start.current && Math.hypot(t.clientX - start.current.x, t.clientY - start.current.y) > 8) clear()
    },
    onTouchEnd: (e: React.TouchEvent) => {
      clear()
      if (fired.current && e.cancelable) e.preventDefault()
    },
    onTouchCancel: clear,
    onClickCapture: (e: React.MouseEvent) => {
      if (fired.current) {
        e.preventDefault()
        e.stopPropagation()
        fired.current = false
      }
    }
  })
}
