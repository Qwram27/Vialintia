import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { Material } from '@shared/types'
import { NOTE_LABELS } from '@shared/defaults'
import { familyById, useStore } from '@/store/store'
import { useIsMobile } from '@/lib/useMobile'
import { IconSearch } from './Icons'

interface Props {
  material?: Material
  missing?: boolean
  onPick: (m: Material) => void
  autoOpen?: boolean
  onClose?: () => void
}

function score(m: Material, q: string): number {
  if (!q) return 1
  const name = m.name.toLowerCase()
  if (name.startsWith(q)) return 3
  if (name.split(/[\s\-()]+/).some((w) => w.startsWith(q))) return 2
  if (name.includes(q) || m.cas?.includes(q) || m.description?.toLowerCase().includes(q)) return 1
  return 0
}

export function MaterialPicker({ material, missing, onPick, autoOpen, onClose }: Props) {
  const materials = useStore((s) => s.materials)
  const settings = useStore((s) => s.settings)
  const addMaterial = useStore((s) => s.addMaterial)
  const [open, setOpen] = useState(!!autoOpen)
  const [q, setQ] = useState('')
  const [hl, setHl] = useState(0)
  const btnRef = useRef<HTMLButtonElement>(null)
  const popRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState({ left: 0, top: 0 })
  const mobile = useIsMobile()

  const results = useMemo(() => {
    const query = q.trim().toLowerCase()
    return materials
      .map((m) => ({ m, s: score(m, query) }))
      .filter((x) => x.s > 0)
      .sort((a, b) => b.s - a.s || a.m.name.localeCompare(b.m.name))
      .slice(0, 60)
      .map((x) => x.m)
  }, [materials, q])

  const canCreate = q.trim().length > 1 && !materials.some((m) => m.name.toLowerCase() === q.trim().toLowerCase())
  const total = results.length + (canCreate ? 1 : 0)

  useLayoutEffect(() => {
    if (!open || !btnRef.current) return
    const r = btnRef.current.getBoundingClientRect()
    const below = window.innerHeight - r.bottom
    setPos({ left: Math.min(r.left, window.innerWidth - 370), top: below > 380 ? r.bottom + 4 : Math.max(8, r.top - 372) })
  }, [open])

  useEffect(() => {
    if (!open) return
    const onDown = (e: PointerEvent) => {
      if (popRef.current?.contains(e.target as Node) || btnRef.current?.contains(e.target as Node)) return
      close()
    }
    document.addEventListener('pointerdown', onDown)
    return () => document.removeEventListener('pointerdown', onDown)
  })

  useEffect(() => setHl(0), [q])
  useEffect(() => {
    listRef.current?.querySelector('.hl')?.scrollIntoView({ block: 'nearest' })
  }, [hl])

  function close() {
    setOpen(false)
    setQ('')
    onClose?.()
  }

  function choose(i: number) {
    if (i < results.length) onPick(results[i])
    else if (canCreate) onPick(addMaterial({ name: q.trim() }))
    close()
  }

  const fam = material ? familyById(settings, material.family) : null

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      setHl((h) => Math.min(total - 1, h + 1))
      e.preventDefault()
    } else if (e.key === 'ArrowUp') {
      setHl((h) => Math.max(0, h - 1))
      e.preventDefault()
    } else if (e.key === 'Enter') {
      if (total > 0) choose(hl)
      e.preventDefault()
    } else if (e.key === 'Escape') close()
  }

  const search = (
    <input
      className="input"
      autoFocus
      autoComplete="off"
      autoCorrect="off"
      spellCheck={false}
      enterKeyHint="done"
      placeholder="Search by name, CAS or odour…"
      value={q}
      onChange={(e) => setQ(e.target.value)}
      onKeyDown={onKeyDown}
    />
  )

  const list = (
    <div className="picker-list" ref={listRef}>
      {results.map((m, i) => {
        const f = familyById(settings, m.family)
        return (
          <div
            key={m.id}
            className={`picker-opt${i === hl ? ' hl' : ''}`}
            style={{ '--i': Math.min(i, 14) } as React.CSSProperties}
            onMouseEnter={() => setHl(i)}
            onMouseDown={(e) => {
              e.preventDefault()
              choose(i)
            }}
          >
            <span className="dot" style={{ background: f.color }} />
            <span className="nm">{m.name}</span>
            <span className="meta">
              {f.name} · {NOTE_LABELS[m.note]}
              {m.defaultDilution < 100 ? ` · ${m.defaultDilution}%` : ''}
            </span>
          </div>
        )
      })}
      {canCreate && (
        <div
          className={`picker-opt create${hl === results.length ? ' hl' : ''}`}
          onMouseEnter={() => setHl(results.length)}
          onMouseDown={(e) => {
            e.preventDefault()
            choose(results.length)
          }}
        >
          + Create “{q.trim()}” in library
        </div>
      )}
      {total === 0 && <div className="picker-opt faint">No materials found</div>}
    </div>
  )

  return (
    <div className="picker">
      <button ref={btnRef} className="picker-btn" onClick={() => (open ? close() : setOpen(true))}>
        {material ? (
          <>
            <span className="dot" style={{ background: fam!.color }} />
            <span className="name">{material.name}</span>
          </>
        ) : missing ? (
          <span className="missing">Missing material</span>
        ) : (
          <span className="faint">Choose material…</span>
        )}
      </button>
      {open &&
        createPortal(
          mobile ? (
            // Phone: full-height sheet sized to the visible viewport (above the keyboard).
            <div className="overlay picker-overlay">
              <div ref={popRef} className="picker-sheet">
                <div className="picker-sheet-head">
                  <div className="search">
                    <IconSearch />
                    {search}
                  </div>
                  <button className="btn btn-ghost" onClick={close}>
                    Cancel
                  </button>
                </div>
                <div className="picker-count">
                  {results.length >= 60 ? '60+' : String(results.length).padStart(2, '0')} {q.trim() ? 'matches' : 'materials'}
                </div>
                {list}
              </div>
            </div>
          ) : (
            <div ref={popRef} className="picker-pop fade-in" style={{ left: pos.left, top: pos.top }}>
              {search}
              {list}
            </div>
          ),
          document.body
        )}
    </div>
  )
}
