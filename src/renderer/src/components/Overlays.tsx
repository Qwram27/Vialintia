import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useUi } from '@/store/ui'

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
