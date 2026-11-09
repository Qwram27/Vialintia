import { useEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { IconX } from './Icons'

/**
 * Phone bottom sheet: dimmed backdrop, spring-in, drag the handle / header down to dismiss.
 */
export function Sheet({ title, onClose, children, className = '' }: { title?: ReactNode; onClose: () => void; children: ReactNode; className?: string }) {
  const [dy, setDy] = useState(0)
  const [closing, setClosing] = useState(false)
  const start = useRef<number | null>(null)

  const close = () => {
    if (closing) return
    setClosing(true)
    setTimeout(onClose, 260)
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const drag = {
    onPointerDown: (e: React.PointerEvent) => {
      if ((e.target as HTMLElement).closest('button, input, select, textarea')) return
      start.current = e.clientY
      ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    },
    onPointerMove: (e: React.PointerEvent) => {
      if (start.current != null) setDy(Math.max(0, e.clientY - start.current))
    },
    onPointerUp: () => {
      if (start.current == null) return
      start.current = null
      if (dy > 90) close()
      else setDy(0)
    }
  }

  return createPortal(
    <div className={`overlay sheet-overlay${closing ? ' closing' : ''}`} onClick={close}>
      <div
        className={`sheet ${className}${dy ? ' dragging' : ''}`}
        style={dy ? { transform: `translateY(${dy}px)` } : undefined}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
      >
        <div className="sheet-head" {...drag}>
          <div className="sheet-grab" />
          {title != null && (
            <div className="row">
              <span className="page-kicker" style={{ margin: 0 }}>
                {title}
              </span>
              <div className="spacer" />
              <button className="btn btn-ghost btn-icon" onClick={close} title="Close">
                <IconX />
              </button>
            </div>
          )}
        </div>
        <div className="sheet-body">{children}</div>
      </div>
    </div>,
    document.body
  )
}
