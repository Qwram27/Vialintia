import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { Formula, NoteLevel, NotePyramid } from '@shared/types'
import { NOTE_ORDER } from '@shared/defaults'
import { NOTE_CATEGORIES, canonicalNote, noteCategory, noteSymbol } from '@/data/noteCatalog'
import { confirmDialog, toast, withProgress } from '@/store/ui'
import { fileToThumb, noteQuery, searchCommons, urlToThumb, type CommonsImage } from '@/lib/noteImages'
import { useStore } from '@/store/store'
import { IconPlus, IconX } from '@/components/Icons'
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
  const [picking, setPicking] = useState(false)
  const images = useStore((s) => s.settings.noteImages) ?? {}
  const updateSettings = useStore((s) => s.updateSettings)
  const fileRef = useRef<HTMLInputElement>(null)
  const imgFor = useRef<string | null>(null)

  const [imgDialog, setImgDialog] = useState<string | null>(null)
  const setImage = (name: string, url: string | null, credit?: string) => {
    const st = useStore.getState().settings
    const next = { ...(st.noteImages ?? {}) }
    const cred = { ...(st.noteImageCredits ?? {}) }
    if (url) next[key(name)] = url
    else delete next[key(name)]
    if (url && credit) cred[key(name)] = credit
    else delete cred[key(name)]
    updateSettings({ noteImages: next, noteImageCredits: cred })
  }
  const chooseFile = (name: string) => {
    imgFor.current = name
    fileRef.current?.click()
  }

  /** Fill every placed note that has no picture yet with the first Commons result. */
  const findAll = async () => {
    const todo = NOTE_ORDER.flatMap((t) => p[t] ?? []).filter((n) => !images[key(n)])
    if (!todo.length) return toast('Every note already has a picture')
    let ok = 0
    await withProgress('Finding pictures', async (step) => {
      for (let i = 0; i < todo.length; i++) {
        step(i / todo.length, `Finding pictures · ${todo[i]}`)
        try {
          const hit = (await searchCommons(noteQuery(todo[i]), 3))[0]
          if (hit) {
            setImage(todo[i], await urlToThumb(hit.thumb), hit.credit)
            ok++
          }
        } catch {
          /* offline or nothing found — leave the symbol tile */
        }
      }
    })
    toast(ok ? `${ok} of ${todo.length} pictures added — tap a note → Image to pick another` : 'No pictures found (are you online?)')
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
            setImage(name, await fileToThumb(f))
            toast(`Picture set for ${name}`)
          } catch {
            toast('This picture could not be read')
          }
        }}
      />
      {imgDialog && (
        <ImageDialog
          name={imgDialog}
          current={images[key(imgDialog)]}
          credit={useStore.getState().settings.noteImageCredits?.[key(imgDialog)]}
          onPick={(url, credit) => setImage(imgDialog, url, credit)}
          onFile={() => chooseFile(imgDialog)}
          onClose={() => setImgDialog(null)}
        />
      )}
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
        {total > 0 && !picking && (
          <button className="btn btn-sm" title="Look up pictures on Wikimedia Commons for notes that have none" onClick={findAll}>
            Find pictures
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
                  {list.length === 0 && <div className="pyr-empty">{picking ? (active === t ? 'Pick notes from the catalogue' : 'Tap to add notes here') : '—'}</div>}
                </div>
                {sel?.tier === t && selName && (
                  <div className="pyr-actions" onClick={(e) => e.stopPropagation()}>
                    <span className="pyr-sel-name">{selName}</span>
                    <div className="spacer" />
                    <button className="btn btn-sm" title="Move left" disabled={sel.idx === 0} onClick={() => shift(-1)}>←</button>
                    <button className="btn btn-sm" title="Move right" disabled={sel.idx >= list.length - 1} onClick={() => shift(1)}>→</button>
                    <button className="btn btn-sm" title="Up a tier" disabled={t === 'top'} onClick={() => toTier(-1)}>↑</button>
                    <button className="btn btn-sm" title="Down a tier" disabled={t === 'base'} onClick={() => toTier(1)}>↓</button>
                    <button className="btn btn-sm" title="Picture of this note (shared by every formula)" onClick={() => setImgDialog(selName)}>
                      {images[key(selName)] ? 'Image' : <><IconPlus size={12} /> Image</>}
                    </button>
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

/** Choose a note's picture: Wikimedia Commons results, a file from the device, or none. */
function ImageDialog({
  name, current, credit, onPick, onFile, onClose
}: {
  name: string
  current?: string
  credit?: string
  onPick: (url: string | null, credit?: string) => void
  onFile: () => void
  onClose: () => void
}) {
  const [q, setQ] = useState(noteQuery(name))
  const [results, setResults] = useState<CommonsImage[] | null>(null)
  const [state, setState] = useState<'idle' | 'loading' | 'error'>('idle')
  const [busy, setBusy] = useState<string | null>(null)

  const search = async (text: string) => {
    if (!text.trim()) return
    setState('loading')
    try {
      setResults(await searchCommons(text.trim(), 12))
      setState('idle')
    } catch {
      setResults(null)
      setState('error')
    }
  }
  useEffect(() => {
    search(q)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const use = async (r: CommonsImage) => {
    setBusy(r.thumb)
    try {
      onPick(await urlToThumb(r.thumb), r.credit)
      toast(`Picture set for ${name}`)
      onClose()
    } catch {
      toast('This picture could not be downloaded')
    } finally {
      setBusy(null)
    }
  }

  return createPortal(
    <div className="overlay confirm-overlay" onMouseDown={onClose}>
      <div className="modal nimg-modal" onMouseDown={(e) => e.stopPropagation()}>
        <h3>Picture · {name}</h3>
        {current && (
          <div className="nimg-current">
            <img src={current} alt="" />
            <div className="small muted">{credit ? <>Wikimedia Commons<br />{credit}</> : 'Own picture'}</div>
          </div>
        )}
        <form
          className="row"
          style={{ gap: 8 }}
          onSubmit={(e) => {
            e.preventDefault()
            search(q)
          }}
        >
          <input className="input" style={{ flex: 1 }} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search pictures…" />
          <button className="btn" type="submit">Search</button>
        </form>
        <div className="nimg-grid">
          {state === 'loading' && <div className="faint small nimg-msg">Searching Wikimedia Commons…</div>}
          {state === 'error' && <div className="faint small nimg-msg">No connection to Wikimedia Commons. Pictures can be looked up when online — or use one from this device.</div>}
          {state === 'idle' && results?.length === 0 && <div className="faint small nimg-msg">Nothing found — try other words.</div>}
          {state === 'idle' &&
            results?.map((r) => (
              <button key={r.thumb} type="button" className={`nimg-opt${busy === r.thumb ? ' busy' : ''}`} title={`${r.title}\n${r.credit}`} disabled={!!busy} onClick={() => use(r)}>
                <img src={r.thumb} alt={r.title} loading="lazy" />
              </button>
            ))}
        </div>
        <p className="nimg-note">Freely licensed pictures from Wikimedia Commons, saved only on this device. Author and licence are kept with the picture.</p>
        <div className="modal-actions">
          {current && (
            <button
              className="btn btn-ghost"
              onClick={() => {
                onPick(null)
                onClose()
              }}
            >
              No image
            </button>
          )}
          <div className="spacer" />
          <button
            className="btn"
            onClick={() => {
              onFile()
              onClose()
            }}
          >
            From device…
          </button>
          <button className="btn btn-ghost" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>,
    document.body
  )
}
