import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { closeContextMenu, useContextMenu, useProgress, useUi } from '@/store/ui'

export function ConfirmHost() {
  const req = useUi((s) => s.confirmReq)
  const setConfirm = useUi((s) => s.setConfirm)

  useEffect(() => {
    if (!req) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') done(false)
      if (e.key === 'Enter') done(true)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  if (!req) return null
  function done(ok: boolean) {
    req!.resolve(ok)
    setConfirm(null)
  }
  // Portal + higher layer, so the dialog always sits above bottom sheets / pickers.
  return createPortal(
    <div className="overlay confirm-overlay" onMouseDown={() => done(false)}>
      <div className="modal" onMouseDown={(e) => e.stopPropagation()}>
        <h3>{req.title}</h3>
        <p>{req.message}</p>
        <div className="modal-actions">
          <button className="btn btn-ghost" onClick={() => done(false)}>
            Cancel
          </button>
          <button className="btn btn-primary" autoFocus onClick={() => done(true)}>
            {req.confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}

export function ToastHost() {
  const toasts = useUi((s) => s.toasts)
  const dismiss = useUi((s) => s.dismiss)
  return (
    <div className="toasts">
      {toasts.map((t) => (
        <div key={t.id} className="toast" onClick={() => dismiss(t.id)}>
          {t.text}
        </div>
      ))}
    </div>
  )
}

export function Stars({ value, onChange }: { value: number; onChange?: (v: number) => void }) {
  return (
    <span className={`stars${onChange ? '' : ' readonly'}`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <button
          key={i}
          className={i <= value ? 'on' : ''}
          onClick={onChange ? () => onChange(i === value ? 0 : i) : undefined}
          tabIndex={onChange ? 0 : -1}
          aria-label={`${i} stars`}
        >
          ★
        </button>
      ))}
    </span>
  )
}

/** Blocking progress card with a flat bar (determinate when a value is known). */
export function ProgressHost() {
  const p = useProgress((s) => s.progress)
  if (!p) return null
  return createPortal(
    <div className="overlay confirm-overlay progress-overlay">
      <div className="modal progress-card" role="progressbar" aria-label={p.label} aria-valuenow={p.value == null ? undefined : Math.round(p.value * 100)}>
        <div className="row">
          <span className="label">{p.label}</span>
          <div className="spacer" />
          <span className="small muted">{p.value == null ? '' : `${Math.round(p.value * 100)}%`}</span>
        </div>
        <div className={`progress-track${p.value == null ? ' indeterminate' : ''}`}>
          <div style={p.value == null ? undefined : { width: `${Math.max(2, p.value * 100)}%` }} />
        </div>
      </div>
    </div>,
    document.body
  )
}

/** Right-click menu: flat glass panel at the cursor, kept inside the window. */
export function ContextMenuHost() {
  const menu = useContextMenu((s) => s.menu)
  const ref = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null)

  useLayoutEffect(() => {
    if (!menu || !ref.current) return setPos(null)
    const r = ref.current.getBoundingClientRect()
    const pad = 8
    setPos({
      left: Math.max(pad, Math.min(menu.x, window.innerWidth - r.width - pad)),
      top: Math.max(pad, menu.y + r.height > window.innerHeight - pad ? menu.y - r.height : menu.y)
    })
  }, [menu])

  useEffect(() => {
    if (!menu) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && closeContextMenu()
    const close = () => closeContextMenu()
    window.addEventListener('keydown', onKey)
    window.addEventListener('resize', close)
    window.addEventListener('blur', close)
    document.addEventListener('scroll', close, true)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('resize', close)
      window.removeEventListener('blur', close)
      document.removeEventListener('scroll', close, true)
    }
  }, [menu])

  if (!menu) return null
  return createPortal(
    <div
      className="ctx-overlay"
      onMouseDown={closeContextMenu}
      onContextMenu={(e) => {
        e.preventDefault()
        closeContextMenu()
      }}
    >
      <div
        ref={ref}
        className="ctx-menu"
        role="menu"
        style={pos ? { left: pos.left, top: pos.top } : { left: menu.x, top: menu.y, visibility: 'hidden' }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        {menu.items.map((it, i) => (
          <button
            key={i}
            role="menuitem"
            className={`ctx-item${it.danger ? ' danger' : ''}${it.sep && i > 0 ? ' sep' : ''}`}
            disabled={it.disabled}
            onClick={() => {
              closeContextMenu()
              it.onSelect()
            }}
          >
            {it.label}
          </button>
        ))}
      </div>
    </div>,
    document.body
  )
}
