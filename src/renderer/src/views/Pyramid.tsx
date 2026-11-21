import { Fragment, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useIsMobile } from '@/lib/useMobile'
import type { Formula, NoteLevel, NotePyramid } from '@shared/types'
import { NOTE_ORDER } from '@shared/defaults'
import { NOTE_CATEGORIES, canonicalNote, noteCategory, noteSymbol } from '@/data/noteCatalog'
import { confirmDialog, toast } from '@/store/ui'
import { useStore } from '@/store/store'
import { IconPlus, IconX } from '@/components/Icons'
import { Seg } from '@/components/Seg'

const TIER_LABEL: Record<NoteLevel, string> = { top: 'Top notes', heart: 'Heart notes', base: 'Base notes' }
const TIER_MARK: Record<NoteLevel, string> = { top: 'T', heart: 'H', base: 'B' }
const EMPTY: NotePyramid = { top: [], heart: [], base: [] }
const key = (s: string) => s.trim().toLowerCase()

/** Center-crop a picked picture to a small square JPEG (keeps the data file light). */
async function toThumb(file: File, size = 200): Promise<string> {
  // data: URL (the page's CSP allows data: images, not blob:)
  const src = await new Promise<string>((res, rej) => {
    const r = new FileReader()
    r.onload = () => res(String(r.result))
    r.onerror = () => rej(r.error)
    r.readAsDataURL(file)
  })
  const img = new Image()
  img.src = src
  await img.decode()
  const s = Math.min(img.naturalWidth, img.naturalHeight)
  const c = document.createElement('canvas')
  c.width = c.height = size
  const ctx = c.getContext('2d')!
  ctx.fillStyle = '#000'
  ctx.fillRect(0, 0, size, size)
  ctx.drawImage(img, (img.naturalWidth - s) / 2, (img.naturalHeight - s) / 2, s, s, 0, 0, size, size)
  return c.toDataURL('image/jpeg', 0.82)
}

type Sel = { tier: NoteLevel; idx: number } | null
type Drag = { name: string; from: NoteLevel | null } | null

/** Note pyramid editor: pick named notes from a catalogue and arrange them in top / heart / base. */
export function Pyramid({ formula, update }: { formula: Formula; update: (fn: (f: Formula) => Formula, history?: boolean) => void }) {
  const p = formula.pyramid ?? EMPTY
  const [active, setActive] = useState<NoteLevel>('top')
  const [sel, setSel] = useState<Sel>(null)
  const [query, setQuery] = useState('')
  const [cat, setCat] = useState('all')
  const [drag, setDrag] = useState<Drag>(null)
  const [over, setOver] = useState<string | null>(null)
  const [picking, setPicking] = useState(false)
  const images = useStore((s) => s.settings.noteImages) ?? {}
  const updateSettings = useStore((s) => s.updateSettings)
  const fileRef = useRef<HTMLInputElement>(null)
  const imgFor = useRef<string | null>(null)

  const setImage = (name: string, url: string | null) => {
    const next = { ...(useStore.getState().settings.noteImages ?? {}) }
    if (url) next[key(name)] = url
    else delete next[key(name)]
    updateSettings({ noteImages: next })
  }
  const chooseImage = (name: string) => {
    imgFor.current = name
    fileRef.current?.click()
  }

  const placed = useMemo(() => {
    const m = new Map<string, NoteLevel>()
    for (const t of NOTE_ORDER) for (const n of p[t] ?? []) m.set(key(n), t)
    return m
  }, [p])
  const total = NOTE_ORDER.reduce((a, t) => a + (p[t]?.length ?? 0), 0)

  const setP = (fn: (p: NotePyramid) => NotePyramid) => update((f) => ({ ...f, pyramid: fn({ ...EMPTY, ...(f.pyramid ?? {}) }) }))

  /** Put a note into a tier at a position (removing it from wherever it was). */
  const place = (raw: string, tier: NoteLevel, at?: number) => {
    const name = canonicalNote(raw)
    if (!name) return
    setP((q) => {
      const out: NotePyramid = { top: [...q.top], heart: [...q.heart], base: [...q.base] }
      let pos = at
      for (const t of NOTE_ORDER) {
        const i = out[t].findIndex((n) => key(n) === key(name))
        if (i >= 0) {
          out[t].splice(i, 1)
          if (t === tier && pos != null && i < pos) pos--
        }
      }
      const list = out[tier]
      list.splice(pos == null ? list.length : Math.max(0, Math.min(pos, list.length)), 0, name)
      return out
    })
  }
  const remove = (name: string) => {
    setP((q) => ({ top: q.top.filter((n) => key(n) !== key(name)), heart: q.heart.filter((n) => key(n) !== key(name)), base: q.base.filter((n) => key(n) !== key(name)) }))
    setSel(null)
  }

  /** Catalogue tap: add to the active tier, move it there, or take it out if it already is there. */
  const pick = (name: string) => {
    const t = placed.get(key(name))
    if (t === active) remove(name)
    else place(name, active)
  }

  const selName = sel ? p[sel.tier]?.[sel.idx] : undefined
  const shift = (d: -1 | 1) => {
    if (!sel || !selName) return
    const len = p[sel.tier].length
    const to = sel.idx + d
    if (to < 0 || to >= len) return
    place(selName, sel.tier, d > 0 ? to + 1 : to)
    setSel({ tier: sel.tier, idx: to })
  }
  const toTier = (d: -1 | 1) => {
    if (!sel || !selName) return
    const ti = NOTE_ORDER.indexOf(sel.tier) + d
    if (ti < 0 || ti > 2) return
    const t = NOTE_ORDER[ti]
    place(selName, t)
    setSel({ tier: t, idx: p[t].filter((n) => key(n) !== key(selName)).length })
    setActive(t)
  }

  const drop = (tier: NoteLevel, at?: number) => {
    if (drag) place(drag.name, tier, at)
    setDrag(null)
    setOver(null)
    setSel(null)
  }

  // catalogue
  const q = query.trim().toLowerCase()
  const groups = useMemo(() => {
    const cats = cat === 'all' || q ? NOTE_CATEGORIES : NOTE_CATEGORIES.filter((c) => c.id === cat)
    return cats
      .map((c) => ({ c, notes: q ? c.notes.filter((n) => n.toLowerCase().includes(q)) : c.notes }))
      .filter((g) => g.notes.length)
  }, [cat, q])
  const exact = q && NOTE_CATEGORIES.some((c) => c.notes.some((n) => n.toLowerCase() === q))
  const own = NOTE_ORDER.flatMap((t) => p[t] ?? []).filter((n) => noteCategory(n).id === 'own')

  const tile = (name: string, opts: { tier?: NoteLevel; idx?: number; mark?: NoteLevel; on?: boolean; onClick: () => void }) => {
    const c = noteCategory(name)
    const id = opts.tier ? `${opts.tier}:${opts.idx}` : `cat:${name}`
    const img = images[key(name)]
    return (
      <button
        key={id}
        type="button"
        className={`ntile${img ? ' has-img' : ''}${opts.on ? ' on' : ''}${over === id ? ' drop' : ''}`}
        title={`${name} · ${c.name}`}
        draggable
        onDragStart={(e) => {
          e.dataTransfer.effectAllowed = 'move'
          e.dataTransfer.setData('text/plain', name)
          setDrag({ name, from: opts.tier ?? null })
        }}
        onDragEnd={() => {
          setDrag(null)
          setOver(null)
        }}
        onDragOver={
          opts.tier
            ? (e) => {
                if (!drag) return
                e.preventDefault()
                e.stopPropagation()
                setOver(id)
              }
            : undefined
        }
        onDrop={
          opts.tier
            ? (e) => {
                e.preventDefault()
                e.stopPropagation()
                drop(opts.tier!, opts.idx)
              }
            : undefined
        }
        onClick={opts.onClick}
      >
        <span className="ntile-code">{c.code}</span>
        {opts.mark && <span className="ntile-mark">{TIER_MARK[opts.mark]}</span>}
        {img ? <img className="ntile-img" src={img} alt="" draggable={false} /> : <span className="ntile-sym">{noteSymbol(name)}</span>}
        <span className="ntile-name">{name}</span>
      </button>
    )
  }

  return (
    <div className="pyr-wrap">
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        hidden
        onChange={async (e) => {
          const f = e.target.files?.[0]
          e.target.value = ''
          const name = imgFor.current
          if (!f || !name) return
          try {
            setImage(name, await toThumb(f))
            toast(`Picture set for ${name}`)
          } catch {
            toast('This picture could not be read')
          }
        }}
      />
      <div className="pyr-head">
        <span className="label">Note pyramid</span>
        <span className="faint small">{String(total).padStart(2, '0')}</span>
        <div className="spacer" />
        {picking && total > 0 && (
          <button
            className="btn btn-ghost btn-sm"
            onClick={async () => {
              if (await confirmDialog('Clear the pyramid?', 'All notes are taken out of top, heart and base.', 'Clear')) {
                setP(() => ({ ...EMPTY }))
                setSel(null)
              }
            }}
          >
            Clear
          </button>
        )}
        <button className={`btn btn-sm${picking ? ' btn-primary' : ''}`} onClick={() => setPicking(!picking)}>
          {picking ? 'Done' : <><IconPlus size={12} /> Pick notes</>}
        </button>
      </div>
    <div className={`pyr${picking ? ' picking' : ''}`}>
      <div className="pyr-tiers">
        {NOTE_ORDER.map((t) => {
          const list = p[t] ?? []
          return (
            <Fragment key={t}>
              <div
                className={`pyr-tier${active === t ? ' active' : ''}${over === t ? ' drop' : ''}`}
                onClick={() => setActive(t)}
                onDragOver={(e) => {
                  if (!drag) return
                  e.preventDefault()
                  setOver(t)
                }}
                onDragLeave={(e) => {
                  if (!e.currentTarget.contains(e.relatedTarget as Node)) setOver((o) => (o === t ? null : o))
                }}
                onDrop={(e) => {
                  e.preventDefault()
                  drop(t)
                }}
              >
                <div className="pyr-tier-head">
                  <span className="pyr-tier-label" style={{ ['--nc' as string]: `var(--note-${t})` }}>
                    <i />
                    {TIER_LABEL[t]}
                  </span>
                  <span className="faint">{String(list.length).padStart(2, '0')}</span>
                  <div className="spacer" />
                  {picking && active === t && <span className="pyr-hint">Adding here</span>}
                </div>
                <BalancedTiles count={list.length}>
                  {list.map((n, i) =>
                    tile(n, {
                      tier: t,
                      idx: i,
                      on: sel?.tier === t && sel.idx === i,
                      onClick: () => {
                        setActive(t)
                        setSel(sel?.tier === t && sel.idx === i ? null : { tier: t, idx: i })
                      }
                    })
                  )}
                  {list.length === 0 && <div className="pyr-empty">{picking ? (active === t ? 'Pick notes from the catalogue' : 'Tap to add notes here') : '—'}</div>}
                </BalancedTiles>
                {sel?.tier === t && selName && (
                  <div className="pyr-actions" onClick={(e) => e.stopPropagation()}>
                    <span className="pyr-sel-name">{selName}</span>
                    <div className="spacer" />
                    <button className="btn btn-sm" title="Move left" disabled={sel.idx === 0} onClick={() => shift(-1)}>←</button>
                    <button className="btn btn-sm" title="Move right" disabled={sel.idx >= list.length - 1} onClick={() => shift(1)}>→</button>
                    <button className="btn btn-sm" title="Up a tier" disabled={t === 'top'} onClick={() => toTier(-1)}>↑</button>
                    <button className="btn btn-sm" title="Down a tier" disabled={t === 'base'} onClick={() => toTier(1)}>↓</button>
                    <button className="btn btn-sm" title="Add or change the picture of this note (used in every formula)" onClick={() => chooseImage(selName)}>
                      {images[key(selName)] ? 'Image' : <><IconPlus size={12} /> Image</>}
                    </button>
                    {images[key(selName)] && (
                      <button
                        className="btn btn-sm"
                        title="Remove the picture (back to the symbol tile)"
                        onClick={async () => {
                          if (await confirmDialog('Remove picture?', `${selName} goes back to its symbol tile in every formula.`, 'Remove')) setImage(selName, null)
                        }}
                      >
                        No image
                      </button>
                    )}
                    <button className="btn btn-sm btn-icon" title="Remove from the pyramid" onClick={() => remove(selName)}>
                      <IconX size={14} />
                    </button>
                  </div>
                )}
              </div>
            </Fragment>
          )
        })}
      </div>

      {picking && (
      <div className="pyr-cat">
        <div className="pyr-cat-head">
          <div className="pyr-addto">
            <span className="label">Add to</span>
            <Seg
              value={active}
              onChange={(t) => {
                setActive(t)
                setSel(null)
              }}
              options={NOTE_ORDER.map((t) => ({ value: t, label: TIER_LABEL[t].replace(' notes', '') }))}
            />
          </div>
          <input
            className="input search"
            placeholder="Search notes or type your own…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && query.trim()) {
                const first = groups[0]?.notes[0]
                place(exact || !first ? query : first, active)
                setQuery('')
              }
            }}
          />
          {!q && (
            <div className="pyr-chips">
              <button className={`vchip${cat === 'all' ? ' on' : ''}`} onClick={() => setCat('all')}>All</button>
              {NOTE_CATEGORIES.map((c) => (
                <button key={c.id} className={`vchip${cat === c.id ? ' on' : ''}`} onClick={() => setCat(c.id)}>
                  {c.name}
                </button>
              ))}
            </div>
          )}
        </div>

        {q && !exact && (
          <div className="pyr-group">
            <div className="pyr-group-head"><span className="label">Own note</span></div>
            <div className="pyr-grid">
              <button
                type="button"
                className="ntile ntile-add"
                onClick={() => {
                  place(query, active)
                  setQuery('')
                }}
              >
                <span className="ntile-code">OW</span>
                <span className="ntile-sym">+</span>
                <span className="ntile-name">Add “{query.trim()}”</span>
              </button>
            </div>
          </div>
        )}
        {!q && cat === 'all' && own.length > 0 && (
          <div className="pyr-group">
            <div className="pyr-group-head"><span className="label">Own</span><span className="faint small">{own.length}</span></div>
            <div className="pyr-grid">{own.map((n) => tile(n, { mark: placed.get(key(n)), on: !!placed.get(key(n)), onClick: () => pick(n) }))}</div>
          </div>
        )}
        {groups.map(({ c, notes }) => (
          <div key={c.id} className="pyr-group">
            <div className="pyr-group-head">
              <span className="label">{c.code} · {c.name}</span>
              <span className="faint small">{notes.length}</span>
            </div>
            <div className="pyr-grid">
              {notes.map((n) => {
                const t = placed.get(key(n))
                return tile(n, { mark: t, on: !!t, onClick: () => pick(n) })
              })}
            </div>
          </div>
        ))}
        {q && groups.length === 0 && <div className="faint small" style={{ padding: '4px 2px' }}>No catalogue note matches — add it as your own.</div>}
      </div>
      )}
    </div>
    </div>
  )
}

/**
 * Tier row layout: tiles shrink (down to a minimum) when that saves a row, and
 * rows are balanced — 5 notes go 3 + 2, not 4 + 1 with one tile left hanging.
 */
function BalancedTiles({ count, children }: { count: number; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  const mobile = useIsMobile()
  const [w, setW] = useState(0)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const measure = () => setW(el.clientWidth)
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const sizes = mobile ? [76, 68, 60] : [84, 76, 68]
  const gap = mobile ? 6 : 8
  let size = sizes[0]
  let per = count
  if (w > 0 && count > 0) {
    const fit = (s: number) => Math.max(1, Math.floor((w + gap) / (s + gap)))
    const rowsAt = sizes.map((s) => Math.ceil(count / fit(s)))
    const minRows = Math.min(...rowsAt)
    size = sizes[rowsAt.indexOf(minRows)] // largest size that needs the fewest rows
    per = Math.ceil(count / minRows) // spread evenly over those rows
  }
  const maxWidth = count > 0 && w > 0 ? per * size + (per - 1) * gap : undefined

  return (
    <div ref={ref} className="pyr-tiles-wrap">
      <div className="pyr-tiles" style={{ ['--ts' as string]: `${size}px`, ['--tg' as string]: `${gap}px`, maxWidth }}>
        {children}
      </div>
    </div>
  )
}
