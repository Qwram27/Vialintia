import { Fragment, useMemo, useState } from 'react'
import type { Formula, NoteLevel, NotePyramid } from '@shared/types'
import { NOTE_ORDER } from '@shared/defaults'
import { NOTE_CATEGORIES, canonicalNote, noteCategory, noteSymbol } from '@/data/noteCatalog'
import { confirmDialog } from '@/store/ui'
import { IconX } from '@/components/Icons'
import { Seg } from '@/components/Seg'

const TIER_LABEL: Record<NoteLevel, string> = { top: 'Top notes', heart: 'Heart notes', base: 'Base notes' }
const TIER_MARK: Record<NoteLevel, string> = { top: 'T', heart: 'H', base: 'B' }
const EMPTY: NotePyramid = { top: [], heart: [], base: [] }
const key = (s: string) => s.trim().toLowerCase()

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
    return (
      <button
        key={id}
        type="button"
        className={`ntile${opts.on ? ' on' : ''}${over === id ? ' drop' : ''}`}
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
        <span className="ntile-sym">{noteSymbol(name)}</span>
        <span className="ntile-name">{name}</span>
      </button>
    )
  }

  return (
    <div className="pyr">
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
                  {active === t && <span className="pyr-hint">Adding here</span>}
                </div>
                <div className="pyr-tiles">
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
                  {list.length === 0 && <div className="pyr-empty">Pick notes below{active === t ? '' : ' — tap to add here'}</div>}
                </div>
                {sel?.tier === t && selName && (
                  <div className="pyr-actions" onClick={(e) => e.stopPropagation()}>
                    <span className="pyr-sel-name">{selName}</span>
                    <div className="spacer" />
                    <button className="btn btn-sm" title="Move left" disabled={sel.idx === 0} onClick={() => shift(-1)}>←</button>
                    <button className="btn btn-sm" title="Move right" disabled={sel.idx >= list.length - 1} onClick={() => shift(1)}>→</button>
                    <button className="btn btn-sm" title="Up a tier" disabled={t === 'top'} onClick={() => toTier(-1)}>↑</button>
                    <button className="btn btn-sm" title="Down a tier" disabled={t === 'base'} onClick={() => toTier(1)}>↓</button>
                    <button className="btn btn-sm btn-icon" title="Remove" onClick={() => remove(selName)}>
                      <IconX size={14} />
                    </button>
                  </div>
                )}
              </div>
            </Fragment>
          )
        })}
        {total > 0 && (
          <div className="row" style={{ justifyContent: 'flex-end' }}>
            <button
              className="btn btn-ghost btn-sm"
              onClick={async () => {
                if (await confirmDialog('Clear the pyramid?', 'All notes are taken out of top, heart and base.', 'Clear')) {
                  setP(() => ({ ...EMPTY }))
                  setSel(null)
                }
              }}
            >
              Clear pyramid
            </button>
          </div>
        )}
      </div>

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
    </div>
  )
}
