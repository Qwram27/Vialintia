import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { AmountUnit, Formula, FormulaRow, FormulaStatus, Material, ProductType, Settings, TestNote, TestPhase, TestStage } from '@shared/types'
import { NOTE_LABELS, NOTE_ORDER, PRODUCT_PRESETS } from '@shared/defaults'
import { currentVersion, familyById, useAccordIndex, useMaterialMap, useStore, withRows } from '@/store/store'
import { confirmDialog, navigate, openContextMenu, toast, withProgress } from '@/store/ui'
import { isWeb } from '@/platform'
import { computeFormula, fmt, fmtPct, fmtSmart, inkOn, moveRow, reduceAccordRow, removeRow, roundToStep, sectionBlocks, stepRow, type RowDrop, rowIfraEntry, scaleRows, type FormulaCalc } from '@/lib/calc'
import { formulaToCsv, formulaToPdfHtml } from '@/lib/exports'
import { uid } from '@/lib/id'
import { NumberInput } from '@/components/NumberInput'
import { MaterialPicker } from '@/components/MaterialPicker'
import { IfraBadge, statusColor } from '@/components/Ifra'
import { EvolutionChart, FamilyDonut, StructureChart } from '@/components/Charts'
import { Seg } from '@/components/Seg'
import { catalogNo, seasonCode, shortDate } from '@/lib/archive'
import { Stars } from '@/components/Overlays'
import { Sheet } from '@/components/Sheet'
import { useIsMobile } from '@/lib/useMobile'
import {
  IconAlert, IconAnalyze, IconCheck, IconPercent, IconCopy, IconDownload, IconFile, IconGrip, IconPlus,
  IconRedo, IconSort, IconTrash, IconUndo, IconX
} from '@/components/Icons'

const STATUS_LABEL: Record<FormulaStatus, string> = { testing: 'Testing', final: 'Final' }
const UNIT_LABEL: Record<AmountUnit, string> = { g: 'g', drops: 'drops' }
const UNIT_NAME: Record<AmountUnit, string> = { g: 'Weight', drops: 'Drops' }

export function FormulaEditor({ id }: { id: string }) {
  const formula = useStore((s) => s.formulas.find((f) => f.id === id))
  const settings = useStore((s) => s.settings)
  const history = useStore((s) => s.history[id])
  const updateFormula = useStore((s) => s.updateFormula)
  const undo = useStore((s) => s.undo)
  const redo = useStore((s) => s.redo)
  const materials = useMaterialMap()
  const accords = useAccordIndex()
  const [tab, setTab] = useState<'composition' | 'notes' | 'details'>('composition')
  const mobile = useIsMobile()

  const version = formula ? currentVersion(formula) : null
  const calc = useMemo(
    () => (formula && version ? computeFormula(formula, version.rows, materials, settings, accords) : null),
    [formula, version, materials, settings, accords]
  )

  // Undo / redo shortcuts (only when not typing in a field).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = document.activeElement as HTMLElement | null
      const typing = el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT')
      if (typing || !(e.ctrlKey || e.metaKey)) return
      const k = e.key.toLowerCase()
      if (k === 'z' && !e.shiftKey) {
        undo(id)
        e.preventDefault()
      } else if (k === 'y' || (k === 'z' && e.shiftKey)) {
        redo(id)
        e.preventDefault()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [id, undo, redo])

  if (!formula || !version || !calc) {
    return (
      <div className="page">
        <div className="card empty">
          <h3>Formula not found</h3>
          <button className="btn mt" onClick={() => navigate('/')}>
            Back to formulas
          </button>
        </div>
      </div>
    )
  }

  const update = (fn: (f: Formula) => Formula, history = true) => updateFormula(id, fn, { history })
  const setRows = (rows: FormulaRow[]) => update((f) => withRows(f, rows))

  return (
    <div className={`page page-wide editor-page${mobile ? ' m-editor' : ''}`}>
      <Header formula={formula} update={update} calc={calc} versionLabel={version.label} canUndo={!!history?.past.length} canRedo={!!history?.future.length} onUndo={() => undo(id)} onRedo={() => redo(id)} settings={settings}>
        <Versions formula={formula} update={update} />
      </Header>

      <div className="workspace">
        <div className="card pane">
          <div className="pane-head">
            <Seg
              size="lg"
              value={tab}
              onChange={setTab}
              options={[
                { value: 'composition', label: <>{mobile ? 'Formula' : 'Composition'}<span className="count">{String(version.rows.length).padStart(2, '0')}</span></> },
                { value: 'notes', label: <>{mobile ? 'Notes' : 'Test notes'}<span className="count">{String(formula.notes.length).padStart(2, '0')}</span></> },
                { value: 'details', label: 'Details' }
              ]}
            />
          </div>
          <div className="pane-body">
            {tab === 'composition' &&
              (mobile ? (
                <MobileComposition formula={formula} rows={version.rows} calc={calc} setRows={setRows} update={update} settings={settings} />
              ) : (
                <Composition formula={formula} rows={version.rows} calc={calc} setRows={setRows} update={update} settings={settings} />
              ))}
            {tab === 'notes' && <Notes formula={formula} update={update} />}
            {tab === 'details' && <Details formula={formula} update={update} />}
          </div>
        </div>

        <Inspector formula={formula} calc={calc} update={update} settings={settings} mobile={mobile} />
      </div>
      <EditorFoot formula={formula} calc={calc} versionLabel={version.label} settings={settings} update={update} />
    </div>
  )
}

// ---------------------------------------------------------------- footer actions
function EditorFoot({
  formula, calc, versionLabel, settings, update
}: {
  formula: Formula
  calc: FormulaCalc
  versionLabel: string
  settings: Settings
  update: (fn: (f: Formula) => Formula, history?: boolean) => void
}) {
  const all = useStore((s) => s.formulas)
  const materials = useStore((s) => s.materials)
  const addMaterial = useStore((s) => s.addMaterial)
  const [scaling, setScaling] = useState(false)
  const safeName = formula.name.replace(/[\\/:*?"<>|]+/g, '').trim() || 'formula'
  const fileBase = `${safeName} - ${versionLabel}`
  const accord = materials.find((m) => m.accordFormulaId === formula.id)

  const saveAsAccord = () => {
    // family / note of the accord = where most of its neat mass sits
    const fam = calc.byFamily[0]?.familyId ?? 'other'
    const note = (['top', 'heart', 'base'] as const).reduce((a, b) => (calc.byNote[b] > calc.byNote[a] ? b : a), 'heart')
    addMaterial({
      name: `${formula.name} (accord)`,
      family: fam,
      note,
      type: 'base',
      accordFormulaId: formula.id,
      defaultDilution: 100,
      description: `Accord built from formula N°${catalogNo(formula, all)} — its composition and IFRA contributions follow that formula's current version.`
    })
    toast('Saved to Materials as an accord')
  }

  return (
    <div className="editor-foot">
      <button className="btn" onClick={() => setScaling(true)} disabled={calc.totalGrams <= 0}>
        <IconPercent /> Scale
      </button>
      {accord ? (
        <button className="btn" onClick={() => navigate('/library')} title="This formula is in Materials as an accord">
          <IconCheck /> Accord in library
        </button>
      ) : (
        <button className="btn" onClick={saveAsAccord} disabled={calc.totalGrams <= 0} title="Use this formula as one ingredient in other formulas">
          <IconPlus /> Save as accord
        </button>
      )}
      <div className="spacer" />
      <button className="btn" title="Analyze & compare versions" onClick={() => navigate(`/compare?a=${formula.id}`)}>
        <IconAnalyze /> Analyze
      </button>
      <button
        className="btn"
        title="Export this formula (with the materials it uses) to import on another device"
        onClick={async () => {
          const used = new Set(formula.versions.flatMap((v) => v.rows.map((r) => r.materialId)))
          const file = { app: 'Vialintia', kind: 'formulas', version: 2, formulas: [formula], refMaterials: materials.filter((m) => used.has(m.id)) }
          const p = await window.vialintia.exportJson(JSON.stringify(file, null, 2), `${fileBase}.json`)
          if (p) toast('Formula exported')
        }}
      >
        <IconDownload /> Export
      </button>
      <button
        className="btn"
        title="Export CSV"
        onClick={async () => {
          const p = await window.vialintia.exportText(formulaToCsv(formula, calc, settings), `${fileBase}.csv`, 'csv')
          if (p) toast('CSV exported')
        }}
      >
        <IconDownload /> CSV
      </button>
      <button
        className="btn"
        title="Export PDF formula sheet"
        onClick={async () => {
          const html = formulaToPdfHtml(formula, versionLabel, calc, settings, catalogNo(formula, all))
          // web builds its own progress; the desktop app prints via Electron — show the bar meanwhile
          const p = isWeb ? await window.vialintia.printPdf(html, `${fileBase}.pdf`) : await withProgress('Exporting PDF', () => window.vialintia.printPdf(html, `${fileBase}.pdf`))
          if (p) toast('PDF saved')
        }}
      >
        <IconFile /> PDF
      </button>
      {scaling && <ScaleDialog formula={formula} calc={calc} settings={settings} update={update} onClose={() => setScaling(false)} />}
    </div>
  )
}

// ---------------------------------------------------------------- scale dialog
function ScaleDialog({
  formula, calc, settings, update, onClose
}: {
  formula: Formula
  calc: FormulaCalc
  settings: Settings
  update: (fn: (f: Formula) => Formula, history?: boolean) => void
  onClose: () => void
}) {
  const [mode, setMode] = useState<'mass' | 'bottles'>('mass')
  const [mass, setMass] = useState(roundToStep(calc.totalGrams, 1) || 10)
  const [bottles, setBottles] = useState(formula.batch.bottles || 1)
  const [ml, setMl] = useState(formula.batch.bottleMl || 50)
  const [asNew, setAsNew] = useState(true)
  const step = settings.balanceStep || 0.01
  const target = mode === 'mass' ? mass : (bottles * ml * settings.productDensity * formula.concentration) / 100
  const v = currentVersion(formula)
  const scaled = scaleRows(v.rows, formula.unit, settings, target)
  const total = scaled.reduce((a, r) => a + r.amount, 0)

  const apply = () => {
    update((f) => {
      const cur = currentVersion(f)
      const rows = scaleRows(cur.rows, f.unit, settings, target)
      const batch = mode === 'bottles' ? { ...f.batch, mode: 'bottles' as const, bottles, bottleMl: ml } : { ...f.batch, mode: 'mass' as const, massG: f.concentration > 0 ? (target * 100) / f.concentration : target }
      if (!asNew) return { ...f, unit: 'g', batch, versions: f.versions.map((x) => (x.id === cur.id ? { ...x, rows } : x)) }
      const nums = f.versions.map((x) => Number(/(\d+)\s*$/.exec(x.label)?.[1] ?? 0))
      const nv = { id: uid(), label: `V${Math.max(f.versions.length, ...nums) + 1}`, createdAt: new Date().toISOString(), comment: `Scaled from ${cur.label} to ${fmtSmart(target)} g concentrate`, rows: rows.map((r) => ({ ...r, id: uid() })) }
      return { ...f, unit: 'g', batch, versions: [...f.versions, nv], currentVersionId: nv.id }
    })
    toast(asNew ? 'Scaled into a new version' : 'Formula scaled')
    onClose()
  }

  return createPortal(
    <div className="overlay" onMouseDown={onClose}>
      <div className="modal" onMouseDown={(e) => e.stopPropagation()}>
        <h3>Scale formula</h3>
        <p>Recalculate the amounts so the concentrate weighs a target mass. Amounts are converted to grams and rounded to your balance step ({String(step)} g).</p>
        <Seg block value={mode} onChange={setMode} options={[{ value: 'mass', label: 'Concentrate mass' }, { value: 'bottles', label: 'Bottles' }]} />
        <div className="grid-2 mt">
          {mode === 'mass' ? (
            <div className="field" style={{ gridColumn: '1 / -1' }}>
              <label>Concentrate</label>
              <div className="suffix">
                <NumberInput value={mass} min={0} onCommit={(x) => setMass(x ?? 0)} />
                <span>g</span>
              </div>
            </div>
          ) : (
            <>
              <div className="field">
                <label>Bottles</label>
                <NumberInput value={bottles} min={0} onCommit={(x) => setBottles(Math.round(x ?? 0))} />
              </div>
              <div className="field">
                <label>Size</label>
                <div className="suffix">
                  <NumberInput value={ml} min={0} onCommit={(x) => setMl(x ?? 0)} />
                  <span>ml</span>
                </div>
              </div>
            </>
          )}
        </div>
        <div className="divider" />
        <div className="stat-row"><span className="k">Now</span><span className="v">{fmtSmart(calc.totalGrams)} g</span></div>
        <div className="stat-row"><span className="k">Target concentrate</span><span className="v">{fmtSmart(roundToStep(target, step))} g</span></div>
        <div className="stat-row"><span className="k">After rounding</span><span className="v">{fmtSmart(roundToStep(total, step))} g · × {fmtSmart(calc.totalGrams > 0 ? target / calc.totalGrams : 0)}</span></div>
        <label className="row small muted mt" style={{ gap: 8, cursor: 'pointer' }}>
          <input type="checkbox" checked={asNew} onChange={(e) => setAsNew(e.target.checked)} /> Save as a new version (keeps the original)
        </label>
        <div className="modal-actions mt">
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" disabled={!(target > 0)} onClick={apply}>Scale</button>
        </div>
      </div>
    </div>,
    document.body
  )
}

// ---------------------------------------------------------------- header
function Header({
  formula, update, calc, versionLabel, canUndo, canRedo, onUndo, onRedo, settings, children
}: {
  children?: React.ReactNode
  formula: Formula
  update: (fn: (f: Formula) => Formula, history?: boolean) => void
  calc: FormulaCalc
  versionLabel: string
  canUndo: boolean
  canRedo: boolean
  onUndo: () => void
  onRedo: () => void
  settings: Settings
}) {
  const [name, setName] = useState(formula.name)
  const [tagText, setTagText] = useState('')
  const duplicateFormula = useStore((s) => s.duplicateFormula)
  const deleteFormula = useStore((s) => s.deleteFormula)
  const all = useStore((s) => s.formulas)
  useEffect(() => setName(formula.name), [formula.name])


  const addTag = () => {
    const t = tagText.trim()
    if (t && !formula.tags.includes(t)) update((f) => ({ ...f, tags: [...f.tags, t] }))
    setTagText('')
  }

  return (
    <div className="editor-head">
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="page-kicker">
          N°{catalogNo(formula, all)} · {seasonCode(formula.createdAt)} · {versionLabel} · {shortDate(formula.createdAt)}
        </div>
        <input
          className="title-input"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={() => name.trim() && name !== formula.name && update((f) => ({ ...f, name: name.trim() }))}
          onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
        />
        <div className="head-meta">
          <Seg
            value={formula.status}
            onChange={(v) => update((f) => ({ ...f, status: v }))}
            options={(['testing', 'final'] as const).map((s) => ({ value: s, label: STATUS_LABEL[s] }))}
          />
          {formula.tags.map((t) => (
            <span key={t} className="tag">
              {t}
              <button onClick={() => update((f) => ({ ...f, tags: f.tags.filter((x) => x !== t) }))} aria-label={`Remove ${t}`}>
                ×
              </button>
            </span>
          ))}
          <input
            className="input input-sm"
            style={{ width: 120 }}
            placeholder="+ tag"
            value={tagText}
            onChange={(e) => setTagText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addTag()}
            onBlur={addTag}
          />
          {children}
        </div>
      </div>
      <div className="btn-group">
        <button className="btn btn-ghost btn-icon" title="Undo (Ctrl+Z)" disabled={!canUndo} onClick={onUndo}>
          <IconUndo />
        </button>
        <button className="btn btn-ghost btn-icon" title="Redo (Ctrl+Y)" disabled={!canRedo} onClick={onRedo}>
          <IconRedo />
        </button>
        <button className="btn btn-primary" title="Weigh this formula step by step" onClick={() => navigate(`/formula/${formula.id}/assemble`)}>
          Assemble fragrance
        </button>
        <button
          className="btn btn-ghost btn-icon"
          title="Duplicate formula"
          onClick={() => {
            const c = duplicateFormula(formula.id)
            if (c) {
              navigate(`/formula/${c.id}`)
              toast('Formula duplicated')
            }
          }}
        >
          <IconCopy />
        </button>
        <button
          className="btn btn-ghost btn-icon btn-danger"
          title="Delete formula"
          onClick={async () => {
            if (await confirmDialog('Delete formula?', `“${formula.name}” and all its versions and notes will be removed.`)) {
              deleteFormula(formula.id)
              navigate('/')
              toast('Formula deleted')
            }
          }}
        >
          <IconTrash />
        </button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------- versions
function Versions({ formula, update }: { formula: Formula; update: (fn: (f: Formula) => Formula, history?: boolean) => void }) {
  const [editing, setEditing] = useState<string | null>(null)
  const [label, setLabel] = useState('')

  const newVersion = () => {
    const src = currentVersion(formula)
    const nums = formula.versions.map((v) => Number(/(\d+)\s*$/.exec(v.label)?.[1] ?? 0))
    const v = {
      id: uid(),
      label: `V${Math.max(formula.versions.length, ...nums) + 1}`,
      createdAt: new Date().toISOString(),
      rows: src.rows.map((r) => ({ ...r, id: uid() }))
    }
    update((f) => ({ ...f, versions: [...f.versions, v], currentVersionId: v.id }))
    toast(`${v.label} created from ${src.label}`)
  }

  const removeVersion = async (vid: string) => {
    const v = formula.versions.find((x) => x.id === vid)!
    const n = formula.notes.filter((x) => x.versionId === vid).length
    if (!(await confirmDialog(`Delete ${v.label}?`, `This version${n ? ` and its ${n} test note${n > 1 ? 's' : ''}` : ''} will be removed.`))) return
    update((f) => {
      const versions = f.versions.filter((x) => x.id !== vid)
      return {
        ...f,
        versions,
        notes: f.notes.filter((x) => x.versionId !== vid),
        currentVersionId: f.currentVersionId === vid ? versions[versions.length - 1].id : f.currentVersionId
      }
    })
  }

  const commitLabel = () => {
    if (editing && label.trim()) {
      const vid = editing
      update((f) => ({ ...f, versions: f.versions.map((v) => (v.id === vid ? { ...v, label: label.trim() } : v)) }))
    }
    setEditing(null)
  }

  return (
    <div className="versions">
      <span className="label" style={{ marginRight: 6 }}>Versions</span>
      {formula.versions.map((v) =>
        editing === v.id ? (
          <input
            key={v.id}
            className="input input-sm"
            style={{ width: 120, borderRadius: 99 }}
            autoFocus
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            onBlur={commitLabel}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitLabel()
              if (e.key === 'Escape') setEditing(null)
            }}
          />
        ) : (
          <button
            key={v.id}
            className={`vchip${v.id === formula.currentVersionId ? ' on' : ''}`}
            title={`${new Date(v.createdAt).toLocaleString('en-GB')} — double-click to rename`}
            onClick={() => update((f) => ({ ...f, currentVersionId: v.id }), false)}
            onDoubleClick={() => {
              setEditing(v.id)
              setLabel(v.label)
            }}
          >
            {v.label}
            {formula.versions.length > 1 && v.id === formula.currentVersionId && (
              <span
                role="button"
                title="Delete version"
                onClick={(e) => {
                  e.stopPropagation()
                  removeVersion(v.id)
                }}
                style={{ opacity: 0.6, display: 'inline-flex' }}
              >
                <IconX size={12} />
              </span>
            )}
          </button>
        )
      )}
      <button className="btn btn-ghost btn-sm" onClick={newVersion} title="Save the current composition as a new modification">
        <IconPlus size={14} /> New version
      </button>
    </div>
  )
}

// ---------------------------------------------------------------- composition table
/** Weighed % per divider (keyed by the row that starts it). */
function sectionTotals(calc: FormulaCalc) {
  const out = new Map<string, { weighed: number; count: number }>()
  for (const block of sectionBlocks(calc.rows.map((r) => ({ ...r, section: r.row.section })))) {
    out.set(block[0].row.id, { weighed: block.reduce((a, r) => a + r.weighedPct, 0), count: block.length })
  }
  return out
}

/** Divider label: edited in place, committed on blur / Enter. */
function SectionHead({
  label, totals, onRename, onRemove, onMenu
}: {
  label: string
  totals?: { weighed: number; count: number }
  onRename: (v: string) => void
  onRemove: () => void
  onMenu?: (e: React.MouseEvent) => void
}) {
  const [text, setText] = useState(label)
  useEffect(() => setText(label), [label])
  return (
    <div className="sec-head" onContextMenu={onMenu}>
      <input
        className="sec-input"
        value={text}
        placeholder="Section"
        style={{ width: `calc(${Math.max(7, text.length + 1)}ch + ${Math.max(7, text.length + 1) * 0.24}em)` }}
        onChange={(e) => setText(e.target.value)}
        onBlur={() => text.trim() !== label && onRename(text.trim())}
        onKeyDown={(e) => {
          if (e.key === 'Escape') setText(label)
          if (e.key === 'Enter' || e.key === 'Escape') (e.target as HTMLInputElement).blur()
        }}
      />
      <span className="spacer" />
      {totals && (
        <small>
          {fmtPct(totals.weighed)} · {totals.count} mat.
        </small>
      )}
      <button className="btn btn-ghost btn-icon row-del" title="Remove divider" onClick={onRemove}>
        <IconX size={14} />
      </button>
    </div>
  )
}

/** Row actions shared by the desktop table (right-click menu) and the phone row sheet. */
function useRowActions(formula: Formula, rows: FormulaRow[], setRows: (rows: FormulaRow[]) => void, settings: Settings) {
  const formulas = useStore((s) => s.formulas)
  const materials = useMaterialMap()
  const accordOf = (r: FormulaRow) => {
    const fid = materials.get(r.materialId)?.accordFormulaId
    return fid ? formulas.find((f) => f.id === fid) ?? null : null
  }
  const reduce = async (r: FormulaRow) => {
    const accord = accordOf(r)
    const m = materials.get(r.materialId)
    if (!accord || !m) return
    const next = reduceAccordRow(rows, r.id, formula.unit, accord, settings, uid, m.name)
    if (!next) return toast(`${m.name} has no materials to reduce to`)
    const added = next.length - rows.length + 1
    setRows(next)
    toast(`${m.name} reduced to its materials${added > 0 ? ` · ${added} row${added > 1 ? 's' : ''}` : ''}`)
  }
  /** Apply a reorder; say so when a divider was left empty and dropped (Ctrl+Z brings it back). */
  const reorder = (next: FormulaRow[]) => {
    const labels = (rs: FormulaRow[]) => rs.filter((r) => r.section != null).map((r) => r.section as string)
    const before = labels(rows)
    const after = labels(next)
    if (after.length < before.length) {
      const lost = before.find((l) => !after.includes(l))
      toast(lost ? `Section “${lost}” removed — it had no materials left` : 'Empty section removed')
    }
    setRows(next)
  }
  const move = (rid: string, dir: -1 | 1) => reorder(stepRow(rows, rid, dir))
  const duplicate = (r: FormulaRow) => {
    const i = rows.findIndex((x) => x.id === r.id)
    setRows([...rows.slice(0, i + 1), { ...r, id: uid() }, ...rows.slice(i + 1)])
  }
  const remove = (rid: string) => setRows(removeRow(rows, rid))
  const setSection = (rid: string, section: string | undefined) =>
    setRows(rows.map((r) => (r.id === rid ? { ...r, section } : r)))
  /** Sort by note within each divider block; the divider stays at the top of its block. */
  const sortByNote = (rank: (r: FormulaRow) => number, grams: Map<string, number>) =>
    setRows(
      sectionBlocks(rows).flatMap((block) => {
        const label = block[0].section
        const sorted = block
          .map((r): FormulaRow => ({ ...r, section: undefined }))
          .sort((a, b) => rank(a) - rank(b) || (grams.get(b.id) ?? 0) - (grams.get(a.id) ?? 0))
        if (label != null) sorted[0] = { ...sorted[0], section: label }
        return sorted
      })
    )
  return { accordOf, reduce, move, reorder, duplicate, remove, setSection, sortByNote }
}

function Composition({
  formula, rows, calc, setRows, update, settings
}: {
  formula: Formula
  rows: FormulaRow[]
  calc: FormulaCalc
  setRows: (rows: FormulaRow[]) => void
  update: (fn: (f: Formula) => Formula, history?: boolean) => void
  settings: Settings
}) {
  const accords = useAccordIndex()
  const [adding, setAdding] = useState(false)
  const [focusRow, setFocusRow] = useState<string | null>(null)
  const [dragId, setDragId] = useState<string | null>(null)
  const [over, setOver] = useState<RowDrop | null>(null)
  const [armed, setArmed] = useState<string | null>(null)
  const amountRefs = useRef(new Map<string, HTMLInputElement>())
  const showBatch = calc.batch.concentrateG > 0
  const act = useRowActions(formula, rows, setRows, settings)

  const rowMenu = (e: React.MouseEvent, row: FormulaRow, idx: number) => {
    const accord = act.accordOf(row)
    openContextMenu(e, [
      accord && { label: 'Reduce accord', onSelect: () => act.reduce(row) },
      accord && { label: 'Open accord formula', onSelect: () => navigate(`/formula/${accord.id}`) },
      row.section == null
        ? { label: 'Add divider above', onSelect: () => act.setSection(row.id, ''), sep: !!accord }
        : { label: 'Remove divider above', onSelect: () => act.setSection(row.id, undefined), sep: !!accord },
      { label: 'Duplicate row', onSelect: () => act.duplicate(row) },
      { label: 'Move up', disabled: idx === 0, onSelect: () => act.move(row.id, -1) },
      { label: 'Move down', disabled: idx === rows.length - 1, onSelect: () => act.move(row.id, 1) },
      { label: 'Remove', danger: true, sep: true, onSelect: () => act.remove(row.id) }
    ])
  }

  useEffect(() => {
    if (focusRow) {
      amountRefs.current.get(focusRow)?.focus()
      setFocusRow(null)
    }
  }, [focusRow, rows])

  const patchRow = (rid: string, patch: Partial<FormulaRow>) => setRows(rows.map((r) => (r.id === rid ? { ...r, ...patch } : r)))

  const addMaterial = (m: Material) => {
    const row: FormulaRow = { id: uid(), materialId: m.id, amount: 0, dilution: m.defaultDilution ?? 100, solvent: m.solvent ?? (m.defaultDilution < 100 ? 'EtOH' : undefined) }
    setRows([...rows, row])
    setFocusRow(row.id)
  }

  const sortByNote = () => {
    const rank = (r: FormulaRow) => {
      const m = calc.rows.find((c) => c.row.id === r.id)?.material
      return m ? NOTE_ORDER.indexOf(m.note) : 3
    }
    act.sortByNote(rank, new Map(calc.rows.map((c) => [c.row.id, c.neatGrams])))
  }
  const totals = sectionTotals(calc)

  const onEnter = (idx: number) => {
    if (idx < rows.length - 1) setFocusRow(rows[idx + 1].id)
    else setAdding(true)
  }

  const drop = () => {
    if (dragId && over) act.reorder(moveRow(rows, dragId, over))
    setOver(null)
  }
  const endDrag = () => {
    setDragId(null)
    setOver(null)
    setArmed(null)
  }
  /** Upper half of a row = drop above it, lower half = below it. */
  const overRow = (e: React.DragEvent, rowId: string) => {
    if (!dragId) return
    e.preventDefault()
    const box = (e.currentTarget as HTMLElement).getBoundingClientRect()
    const where = e.clientY < box.top + box.height / 2 ? 'above' : 'below'
    if (!over || !('rowId' in over) || over.rowId !== rowId || over.where !== where) setOver({ rowId, where })
  }
  const dropClass = (rowId: string) =>
    !dragId || dragId === rowId || !over || !('rowId' in over) || over.rowId !== rowId ? '' : over.where === 'above' ? ' drop-above' : ' drop-below'

  return (
    <>
      <div className="row mb" style={{ gap: 10 }}>
        <span className="label">Amounts in</span>
        <Seg
          value={formula.unit}
          onChange={(u) => update((f) => ({ ...f, unit: u }))}
          options={(['g', 'drops'] as const).map((u) => ({ value: u, label: UNIT_NAME[u] }))}
        />
        {formula.unit === 'drops' && <span className="faint small">1 drop = {settings.dropMassG} g</span>}
        <div className="spacer" />
        <button className="btn btn-ghost btn-sm" onClick={sortByNote} disabled={rows.length < 2}>
          <IconSort size={14} /> Sort by note
        </button>
      </div>

      <div className="table-wrap">
        <table className="ftable">
          <thead>
            <tr>
              <th className="l" style={{ width: 30 }}>N°</th>
              <th className="l">Material</th>
              <th className="l">Note</th>
              <th>Amount ({UNIT_LABEL[formula.unit]})</th>
              <th>Dilution</th>
              <th title="Share of the concentrate as weighed">Weighed %</th>
              <th title="Neat (undiluted) material as % of the concentrate">Active %</th>
              <th>IFRA</th>
              {showBatch && <th title="Weighed grams for the batch set in the sidebar">Batch g</th>}
              <th style={{ width: 30 }} />
            </tr>
          </thead>
          <tbody>
            {calc.rows.map((r, idx) => {
              const m = r.material
              return (
                <Fragment key={r.row.id}>
                {r.row.section != null && (
                  <tr
                    className={`sec-row${idx === 0 ? ' first' : ''}${dragId && over && 'sectionOf' in over && over.sectionOf === r.row.id ? ' drop-below' : ''}`}
                    onDragOver={(e) => {
                      if (!dragId) return
                      e.preventDefault()
                      if (!over || !('sectionOf' in over) || over.sectionOf !== r.row.id) setOver({ sectionOf: r.row.id })
                    }}
                    onDrop={(e) => {
                      e.preventDefault()
                      drop()
                    }}
                  >
                    <td colSpan={showBatch ? 10 : 9} className="l">
                      <SectionHead
                        label={r.row.section}
                        totals={totals.get(r.row.id)}
                        onRename={(v) => act.setSection(r.row.id, v)}
                        onRemove={() => act.setSection(r.row.id, undefined)}
                        onMenu={(e) =>
                          openContextMenu(e, [{ label: 'Remove divider', danger: true, onSelect: () => act.setSection(r.row.id, undefined) }])
                        }
                      />
                    </td>
                  </tr>
                )}
                <tr
                  draggable={armed === r.row.id}
                  className={`${dragId === r.row.id ? 'dragging' : ''}${dropClass(r.row.id)}`}
                  onContextMenu={(e) => rowMenu(e, r.row, idx)}
                  onDragStart={(e) => {
                    setDragId(r.row.id)
                    e.dataTransfer.effectAllowed = 'move'
                  }}
                  onDragOver={(e) => overRow(e, r.row.id)}
                  onDrop={(e) => {
                    e.preventDefault()
                    drop()
                  }}
                  onDragEnd={endDrag}
                >
                  <td style={{ width: 30 }}>
                    <span className="rowno">{String(idx + 1).padStart(2, '0')}</span>
                    <span className="grip" onMouseDown={() => setArmed(r.row.id)} onMouseUp={() => setArmed(null)} title="Drag to reorder">
                      <IconGrip size={14} />
                    </span>
                  </td>
                  <td className="l">
                    <MaterialPicker
                      material={m}
                      missing={!m}
                      onPick={(nm) => patchRow(r.row.id, { materialId: nm.id, dilution: nm.defaultDilution ?? 100, solvent: nm.solvent ?? r.row.solvent })}
                    />
                  </td>
                  <td className="l">
                    {m && (
                      <span className="note-pill" style={{ background: settings.noteColors[m.note], color: inkOn(settings.noteColors[m.note]) }}>
                        {NOTE_LABELS[m.note]}
                      </span>
                    )}
                  </td>
                  <td>
                    <NumberInput
                      ref={(el) => {
                        if (el) amountRefs.current.set(r.row.id, el)
                        else amountRefs.current.delete(r.row.id)
                      }}
                      className="cell-input"
                      value={r.row.amount}
                      min={0}
                      onCommit={(v) => patchRow(r.row.id, { amount: v ?? 0 })}
                      onEnter={() => onEnter(idx)}
                      title={formula.unit === 'drops' ? `${fmtSmart(r.grams)} g` : undefined}
                    />
                  </td>
                  <td>
                    <div className="row" style={{ gap: 2, justifyContent: 'flex-end' }}>
                      <NumberInput
                        className="cell-input narrow"
                        value={r.row.dilution}
                        min={0.0001}
                        max={100}
                        onCommit={(v) => patchRow(r.row.id, { dilution: v ?? 100 })}
                        title="% of material in what you weigh (100 = neat)"
                      />
                      <span className="dim">%</span>
                      {r.row.dilution < 100 ? (
                        <select
                          className="select solv-select"
                          value={r.row.solvent ?? ''}
                          onChange={(e) => patchRow(r.row.id, { solvent: e.target.value || undefined })}
                        >
                          <option value="">—</option>
                          {settings.solvents.map((s) => (
                            <option key={s} value={s}>
                              {s}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <span className="dim small" style={{ width: 38, textAlign: 'left', paddingLeft: 4 }}>
                          neat
                        </span>
                      )}
                    </div>
                  </td>
                  <td title={`Neat in concentrate: ${fmtSmart(r.neatPct)}%${r.cost ? ` · cost ${settings.currency}${fmt(r.cost, 2)}` : ''}`}>{fmtPct(r.weighedPct)}</td>
                  <td>{fmtPct(r.neatPct)}</td>
                  <td>
                    <IfraBadge entry={rowIfraEntry(calc.ifra, m, accords)} />
                  </td>
                  {showBatch && <td className="muted">{fmtSmart(r.batchGrams)}</td>}
                  <td>
                    <button className="btn btn-ghost btn-icon row-del btn-danger" title="Remove row" onClick={() => act.remove(r.row.id)}>
                      <IconX size={14} />
                    </button>
                  </td>
                </tr>
                </Fragment>
              )
            })}
          </tbody>
          {rows.length > 0 && (
            <tfoot>
              <tr>
                <td />
                <td className="l">Total</td>
                <td />
                <td>{fmtSmart(rows.reduce((s, r) => s + (r.amount || 0), 0))}</td>
                <td className="muted" style={{ fontWeight: 400 }}>
                  {formula.unit !== 'g' ? `${fmtSmart(calc.totalGrams)} g` : ''}
                </td>
                <td>100.0%</td>
                <td>{fmtPct(calc.rows.reduce((s, r) => s + (r.neatPct || 0), 0))}</td>
                <td />
                {showBatch && <td>{fmt(calc.batch.concentrateG, 2)}</td>}
                <td />
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      <div className="add-row">
        {adding ? (
          <MaterialPicker
            autoOpen
            onPick={(m) => {
              addMaterial(m)
              setAdding(false)
            }}
            onClose={() => setAdding(false)}
          />
        ) : (
          <button className="btn btn-sm" onClick={() => setAdding(true)}>
            <IconPlus size={14} /> Add material
          </button>
        )}
        <span className="faint small">
          <span className="kbd">Enter</span> in an amount moves to the next row · <span className="kbd">↑</span>/<span className="kbd">↓</span> ±1 (Shift ±10, Alt ±0.1)
        </span>
      </div>
      {rows.length === 0 && !adding && (
        <div className="empty" style={{ padding: '40px 20px' }}>
          <div className="mark">00</div>
          <h3>No materials</h3>
          <p>Add the first material to start the composition.</p>
        </div>
      )}
    </>
  )
}

// ---------------------------------------------------------------- composition (phone)
function MobileComposition({
  formula, rows, calc, setRows, update, settings
}: {
  formula: Formula
  rows: FormulaRow[]
  calc: FormulaCalc
  setRows: (rows: FormulaRow[]) => void
  update: (fn: (f: Formula) => Formula, history?: boolean) => void
  settings: Settings
}) {
  const accords = useAccordIndex()
  const [adding, setAdding] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const showBatch = calc.batch.concentrateG > 0
  const unit = UNIT_LABEL[formula.unit]

  const patchRow = (rid: string, patch: Partial<FormulaRow>) => setRows(rows.map((r) => (r.id === rid ? { ...r, ...patch } : r)))

  const addMaterial = (m: Material) => {
    const row: FormulaRow = { id: uid(), materialId: m.id, amount: 0, dilution: m.defaultDilution ?? 100, solvent: m.solvent ?? (m.defaultDilution < 100 ? 'EtOH' : undefined) }
    setRows([...rows, row])
    setEditId(row.id)
  }

  const sortByNote = () => {
    const rank = (r: FormulaRow) => {
      const m = calc.rows.find((c) => c.row.id === r.id)?.material
      return m ? NOTE_ORDER.indexOf(m.note) : 3
    }
    act.sortByNote(rank, new Map(calc.rows.map((c) => [c.row.id, c.neatGrams])))
  }
  const totals = sectionTotals(calc)

  const act = useRowActions(formula, rows, setRows, settings)
  const move = act.move

  const editing = calc.rows.find((r) => r.row.id === editId)
  const editIdx = editing ? calc.rows.indexOf(editing) : -1

  return (
    <>
      <div className="row mb m-comp-tools">
        <Seg
          value={formula.unit}
          onChange={(u) => update((f) => ({ ...f, unit: u }))}
          options={(['g', 'drops'] as const).map((u) => ({ value: u, label: UNIT_NAME[u] }))}
        />
        <div className="spacer" />
        <button className="btn btn-ghost btn-sm" onClick={sortByNote} disabled={rows.length < 2}>
          <IconSort size={14} /> Sort
        </button>
      </div>

      <div className="m-rows">
        {calc.rows.map((r, idx) => {
          const m = r.material
          const entry = rowIfraEntry(calc.ifra, m, accords)
          return (
            <Fragment key={r.row.id}>
            {r.row.section != null && (
              <div className={`m-sec${idx === 0 ? ' first' : ''}`}>
                <SectionHead
                  label={r.row.section}
                  totals={totals.get(r.row.id)}
                  onRename={(v) => act.setSection(r.row.id, v)}
                  onRemove={() => act.setSection(r.row.id, undefined)}
                />
              </div>
            )}
            <button className={`m-row${entry?.status === 'over' ? ' over' : ''}`} onClick={() => setEditId(r.row.id)}>
              <span className="m-row-no">{String(idx + 1).padStart(2, '0')}</span>
              <span className="m-row-main">
                <span className="m-row-name">
                  {m ? (
                    <>
                      <span className="dot" style={{ background: familyById(settings, m.family).color }} />
                      <span className="nm">{m.name}</span>
                    </>
                  ) : (
                    <span className="missing">Missing material</span>
                  )}
                </span>
                <span className="m-row-meta">
                  {m && (
                    <span className="note-pill" style={{ background: settings.noteColors[m.note], color: inkOn(settings.noteColors[m.note]) }}>
                      {NOTE_LABELS[m.note].slice(0, 1)}
                    </span>
                  )}
                  <span>{r.row.dilution < 100 ? `${fmtSmart(r.row.dilution)}%${r.row.solvent ? ` ${r.row.solvent}` : ''}` : 'neat'}</span>
                  <span>·</span>
                  <span>{fmtPct(r.neatPct)} active</span>
                  {showBatch && (
                    <>
                      <span>·</span>
                      <span>{fmtSmart(r.batchGrams)} g batch</span>
                    </>
                  )}
                </span>
              </span>
              <span className="m-row-amt">
                <span className="v">{fmtSmart(r.row.amount)}</span>
                <span className="u">{unit}</span>
                <IfraBadge entry={entry} />
              </span>
            </button>
            </Fragment>
          )
        })}
      </div>

      {rows.length > 0 && (
        <div className="m-total">
          <span>Total</span>
          <span>
            {fmtSmart(rows.reduce((s, r) => s + (r.amount || 0), 0))} {unit}
            {formula.unit !== 'g' ? ` · ${fmtSmart(calc.totalGrams)} g` : ''}
          </span>
          <span className="faint">{fmtPct(formula.concentration)} in product</span>
        </div>
      )}

      <div className="add-row">
        {adding ? (
          <MaterialPicker
            autoOpen
            onPick={(m) => {
              addMaterial(m)
              setAdding(false)
            }}
            onClose={() => setAdding(false)}
          />
        ) : (
          <button className="btn btn-block" onClick={() => setAdding(true)}>
            <IconPlus size={14} /> Add material
          </button>
        )}
      </div>
      {rows.length === 0 && !adding && (
        <div className="empty" style={{ padding: '30px 20px' }}>
          <div className="mark">00</div>
          <h3>No materials</h3>
          <p>Add the first material to start the composition.</p>
        </div>
      )}

      {editing && (
        <Sheet onClose={() => setEditId(null)} title={`N°${String(editIdx + 1).padStart(2, '0')} · Row`}>
          <div className="field">
            <label>Material</label>
            <MaterialPicker
              material={editing.material}
              missing={!editing.material}
              onPick={(nm) => patchRow(editing.row.id, { materialId: nm.id, dilution: nm.defaultDilution ?? 100, solvent: nm.solvent ?? editing.row.solvent })}
            />
          </div>
          <div className="grid-2">
            <div className="field">
              <label>Amount</label>
              <div className="suffix">
                <NumberInput value={editing.row.amount} min={0} onCommit={(v) => patchRow(editing.row.id, { amount: v ?? 0 })} />
                <span>{unit}</span>
              </div>
            </div>
            <div className="field">
              <label>Dilution</label>
              <div className="suffix">
                <NumberInput value={editing.row.dilution} min={0.0001} max={100} onCommit={(v) => patchRow(editing.row.id, { dilution: v ?? 100 })} />
                <span>%</span>
              </div>
            </div>
          </div>
          {editing.row.dilution < 100 && (
            <div className="field">
              <label>Solvent</label>
              <select className="select" value={editing.row.solvent ?? ''} onChange={(e) => patchRow(editing.row.id, { solvent: e.target.value || undefined })}>
                <option value="">—</option>
                {settings.solvents.map((sv) => (
                  <option key={sv} value={sv}>
                    {sv}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div className="m-sheet-stats">
            <div>
              <span className="k">Weighed</span>
              <span className="v">{fmtPct(editing.weighedPct)}</span>
            </div>
            <div>
              <span className="k">Active</span>
              <span className="v">{fmtPct(editing.neatPct)}</span>
            </div>
            <div>
              <span className="k">Batch</span>
              <span className="v">{showBatch ? `${fmtSmart(editing.batchGrams)} g` : '—'}</span>
            </div>
            <div>
              <span className="k">IFRA</span>
              <span className="v">
                <IfraBadge entry={rowIfraEntry(calc.ifra, editing.material, accords)} />
              </span>
            </div>
          </div>
          <div className="row m-sheet-actions">
            <button className="btn btn-icon" title="Move up" disabled={editIdx <= 0} onClick={() => move(editing.row.id, -1)}>
              ↑
            </button>
            <button className="btn btn-icon" title="Move down" disabled={editIdx >= rows.length - 1} onClick={() => move(editing.row.id, 1)}>
              ↓
            </button>
            <button
              className="btn"
              title={editing.row.section != null ? 'Remove the divider above this row' : 'Add a divider above this row'}
              onClick={() => act.setSection(editing.row.id, editing.row.section != null ? undefined : '')}
            >
              {editing.row.section != null ? '− Divider' : '+ Divider'}
            </button>
            {act.accordOf(editing.row) && (
              <button
                className="btn"
                title="Replace the accord with its materials in real amounts"
                onClick={() => {
                  act.reduce(editing.row)
                  setEditId(null)
                }}
              >
                Reduce
              </button>
            )}
            <div className="spacer" />
            <button
              className="btn btn-danger"
              onClick={() => {
                act.remove(editing.row.id)
                setEditId(null)
              }}
            >
              <IconTrash size={14} /> Remove
            </button>
            <button className="btn btn-primary" onClick={() => setEditId(null)}>
              Done
            </button>
          </div>
        </Sheet>
      )}
    </>
  )
}

// ---------------------------------------------------------------- inspector
function Inspector({
  formula, calc, update, settings, mobile
}: {
  mobile?: boolean
  formula: Formula
  calc: FormulaCalc
  update: (fn: (f: Formula) => Formula, history?: boolean) => void
  settings: Settings
}) {
  const [tab, setTab] = useState<'setup' | 'ifra' | 'analysis'>('setup')
  const b = calc.batch
  const ifra = calc.ifra
  const over = ifra.entries.filter((e) => e.status === 'over').length
  const near = ifra.entries.filter((e) => e.status === 'near').length
  const cur = settings.currency
  const setBatch = (patch: Partial<Formula['batch']>) => update((f) => ({ ...f, batch: { ...f.batch, ...patch } }))

  const setupPanel = (
    <>
      <section className="insp-sec">
        <h3 className="card-title">
          Product <small>{fmt(formula.concentration, 1)}% concentrate</small>
        </h3>
        <div className="grid-2">
          <div className="field">
            <label>Type</label>
            <select
              className="select"
              value={formula.productType}
              onChange={(e) => {
                const t = e.target.value as ProductType
                update((f) => ({ ...f, productType: t, concentration: t === 'custom' ? f.concentration : PRODUCT_PRESETS[t].concentration }))
              }}
            >
              {Object.entries(PRODUCT_PRESETS).map(([k, p]) => (
                <option key={k} value={k}>
                  {p.label}
                </option>
              ))}
              <option value="custom">Author</option>
            </select>
          </div>
          <div className="field">
            <label>Concentration</label>
            <div className="suffix">
              <NumberInput
                value={formula.concentration}
                min={0}
                max={100}
                onCommit={(v) => {
                  const c = v ?? 0
                  const match = Object.entries(PRODUCT_PRESETS).find(([, p]) => p.concentration === c)?.[0] as ProductType | undefined
                  update((f) => ({ ...f, concentration: c, productType: match ?? 'custom' }))
                }}
              />
              <span>%</span>
            </div>
          </div>
        </div>
      </section>
      <section className="insp-sec">
        <h3 className="card-title">
          Batch
          <Seg
            value={formula.batch.mode}
            onChange={(m) => setBatch({ mode: m })}
            options={[
              { value: 'bottles', label: 'Bottles' },
              { value: 'mass', label: 'Mass' }
            ]}
          />
        </h3>
        {formula.batch.mode === 'bottles' ? (
          <div className="grid-2">
            <div className="field">
              <label>Bottles</label>
              <NumberInput value={formula.batch.bottles} min={0} onCommit={(v) => setBatch({ bottles: Math.round(v ?? 0) })} />
            </div>
            <div className="field">
              <label>Size</label>
              <div className="suffix">
                <NumberInput value={formula.batch.bottleMl} min={0} onCommit={(v) => setBatch({ bottleMl: v ?? 0 })} />
                <span>ml</span>
              </div>
            </div>
          </div>
        ) : (
          <div className="field">
            <label>Total weight</label>
            <div className="suffix">
              <NumberInput value={formula.batch.massG} min={0} onCommit={(v) => setBatch({ massG: v ?? 0 })} />
              <span>g</span>
            </div>
          </div>
        )}
        <div className="divider" />
        <div className="stat-row">
          <span className="k">Finished product</span>
          <span className="v">
            {fmt(b.productMl, 1)} ml · {fmt(b.productG, 1)} g
          </span>
        </div>
        <div className="stat-row">
          <span className="k">Concentrate</span>
          <span className="v">{fmt(b.concentrateG, 2)} g</span>
        </div>
        <div className="stat-row">
          <span className="k">Alcohol</span>
          <span className="v">
            {fmt(b.alcoholG, 2)} g · {fmt(b.alcoholMl, 1)} ml
          </span>
        </div>
        <div className="stat-row">
          <span className="k">Scale factor</span>
          <span className="v">× {fmtSmart(b.scale)}</span>
        </div>
        {(b.costTotal > 0 || calc.costPerKg > 0) && (
          <>
            <div className="divider" />
            <div className="stat-row">
              <span className="k">Batch cost</span>
              <span className="v">
                {cur}
                {fmt(b.costTotal, 2)}
              </span>
            </div>
            {b.costPerBottle != null && (
              <div className="stat-row">
                <span className="k">Per bottle</span>
                <span className="v">
                  {cur}
                  {fmt(b.costPerBottle, 2)}
                </span>
              </div>
            )}
          </>
        )}
      </section>
            {calc.solventGrams > 0.00001 && (
              <section className="insp-sec">
                <h3 className="card-title">Dilution</h3>
                <div className="stat-row">
                  <span className="k">Neat material</span>
                  <span className="v">{fmtSmart(calc.neatGrams)} g</span>
                </div>
                <div className="stat-row">
                  <span className="k">Solvent in dilutions</span>
                  <span className="v">{fmtSmart(calc.solventGrams)} g</span>
                </div>
              </section>
            )}
    </>
  )
  const ifraPanel = (
    <>
      <section className="insp-sec">
        <h3 className="card-title">
          IFRA <small>Category 4</small>
        </h3>
        {ifra.entries.length === 0 ? (
          <div className="muted small">
            No IFRA limits set for the materials used. Add them in the Library to get live compliance checks.
          </div>
        ) : (
          <>
            <div
              className="ifra-summary"
              style={{
                background: over ? 'var(--over-bg)' : near ? 'var(--near-bg)' : 'var(--ok-bg)',
                color: statusColor(over ? 'over' : near ? 'near' : 'ok'),
                border: over ? '1px solid rgba(255,255,255,.45)' : '1px solid transparent'
              }}
            >
              {over ? <IconAlert /> : <IconCheck />}
              <span>
                {over
                  ? `${over} material${over > 1 ? 's' : ''} over the limit`
                  : near
                    ? `Within limits · ${near} close to the limit`
                    : 'All within entered limits'}
              </span>
            </div>
            {ifra.maxConcentration != null && (
              <div className="stat-row">
                <span className="k">Max concentration</span>
                <span className="v" title={ifra.limiting ? `Limited by ${ifra.limiting.name}` : undefined}>
                  {fmt(ifra.maxConcentration, 2)}%
                </span>
              </div>
            )}
            {ifra.limiting && (
              <div className="faint small" style={{ marginBottom: 8 }}>
                limited by {ifra.limiting.name}
              </div>
            )}
            <div className="ifra-list">
              {ifra.entries.map((e) => (
                <div className="ifra-line" key={e.material.id}>
                  <span>{e.material.name}</span>
                  <span className="num muted">
                    {fmtSmart(e.productPct)} / {fmtSmart(e.limit)}%
                  </span>
                  <div className="meter">
                    <div style={{ width: `${Math.min(100, e.ratio * 100)}%`, background: statusColor(e.status) }} />
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
        <div className="faint small mt">Uses the limits you enter per material — verify against the current IFRA Standards.</div>
      </section>
    </>
  )
  const analysisPanel = (
    <>
            <section className="insp-sec">
              <h3 className="card-title">Structure</h3>
              <StructureChart byNote={calc.byNote} settings={settings} />
            </section>
            <section className="insp-sec">
              <h3 className="card-title">Families</h3>
              <FamilyDonut byFamily={calc.byFamily} settings={settings} />
            </section>
            <section className="insp-sec">
              <h3 className="card-title">Evolution</h3>
              <EvolutionChart rows={calc.rows} settings={settings} />
            </section>
    </>
  )

  if (mobile) {
    return (
      <div className="m-insp">
        <Collapsible title="Setup" meta={`${fmt(formula.concentration, 1)}% · ${fmt(b.concentrateG, 2)} g`} defaultOpen>
          {setupPanel}
        </Collapsible>
        <Collapsible
          title="IFRA"
          meta={ifra.entries.length === 0 ? '—' : over ? `! ${over} over` : near ? `◐ ${near} near` : '✓ ok'}
          alert={over > 0}
          defaultOpen={over > 0}
        >
          {ifraPanel}
        </Collapsible>
        <Collapsible title="Analysis">{analysisPanel}</Collapsible>
      </div>
    )
  }

  return (
    <div className="card pane">
      <div className="pane-head">
        <Seg
          block
          value={tab}
          onChange={setTab}
          options={[
            { value: 'setup', label: 'Setup' },
            { value: 'ifra', label: <>IFRA{over ? <span className="tab-alert">!</span> : null}</> },
            { value: 'analysis', label: 'Analysis' }
          ]}
        />
      </div>
      <div className="pane-body" key={tab}>
        <div className="insp fade-in">
          {tab === 'setup' ? setupPanel : tab === 'ifra' ? ifraPanel : analysisPanel}
        </div>
      </div>
    </div>
  )
}

function Collapsible({
  title, meta, alert, defaultOpen, children
}: {
  title: string
  meta?: React.ReactNode
  alert?: boolean
  defaultOpen?: boolean
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(!!defaultOpen)
  return (
    <div className={`card m-block${open ? ' open' : ''}${alert ? ' alert' : ''}`}>
      <button className="m-block-head" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <span className="t">{title}</span>
        {meta != null && <span className="m">{meta}</span>}
        <span className="chev" aria-hidden>
          {open ? '−' : '+'}
        </span>
      </button>
      {open && <div className="m-block-body insp">{children}</div>}
    </div>
  )
}

// ---------------------------------------------------------------- notes
const STAGES: Record<TestStage, string> = { blotter: 'Blotter', skin: 'Skin', fabric: 'Fabric' }
const PHASES: Record<TestPhase, string> = { opening: 'Opening', heart: 'Evolution', drydown: 'End' }

function Notes({ formula, update }: { formula: Formula; update: (fn: (f: Formula) => Formula, history?: boolean) => void }) {
  const [text, setText] = useState('')
  const [stage, setStage] = useState<TestStage>('blotter')
  const [phase, setPhase] = useState<TestPhase>('opening')
  const [rating, setRating] = useState(0)
  const [onlyThis, setOnlyThis] = useState(false)
  const labels = new Map(formula.versions.map((v) => [v.id, v.label]))

  const add = () => {
    if (!text.trim()) return
    const note: TestNote = { id: uid(), date: new Date().toISOString(), versionId: formula.currentVersionId, stage, phase, rating, text: text.trim() }
    update((f) => ({ ...f, notes: [note, ...f.notes] }))
    setText('')
    setRating(0)
  }

  const notes = formula.notes
    .filter((n) => !onlyThis || n.versionId === formula.currentVersionId)
    .sort((a, b) => b.date.localeCompare(a.date))

  return (
    <div>
      <div className="card card-pad" style={{ background: 'var(--panel-2)', marginBottom: 16 }}>
        <div className="row mb" style={{ gap: 10, flexWrap: 'wrap' }}>
          <span className="label">New note for</span>
          <span className="tag">{labels.get(formula.currentVersionId)}</span>
          <select className="select input-sm" style={{ width: 110 }} value={stage} onChange={(e) => setStage(e.target.value as TestStage)}>
            {Object.entries(STAGES).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
          <select className="select input-sm" style={{ width: 120 }} value={phase} onChange={(e) => setPhase(e.target.value as TestPhase)}>
            {Object.entries(PHASES).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
          <Stars value={rating} onChange={setRating} />
        </div>
        <textarea
          className="textarea"
          placeholder="Impressions, what to change in the next mod… (Ctrl+Enter to save)"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && e.ctrlKey && add()}
        />
        <div className="row mt">
          <div className="spacer" />
          <button className="btn btn-primary btn-sm" onClick={add} disabled={!text.trim()}>
            Add note
          </button>
        </div>
      </div>

      <div className="row mb">
        <label className="row small muted" style={{ gap: 6, cursor: 'pointer' }}>
          <input type="checkbox" checked={onlyThis} onChange={(e) => setOnlyThis(e.target.checked)} /> Only notes for the current version
        </label>
      </div>
      <div className="col" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {notes.map((n) => (
          <div key={n.id} className="card note-card">
            <div className="when">
              <span className="tag">{labels.get(n.versionId) ?? '—'}</span>
              <span>{new Date(n.date).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })}</span>
              <span>·</span>
              <span>{STAGES[n.stage]}</span>
              <span>·</span>
              <span>{PHASES[n.phase]}</span>
              {n.rating > 0 && <Stars value={n.rating} />}
            </div>
            <button
              className="btn btn-ghost btn-icon btn-danger"
              title="Delete note"
              onClick={() => update((f) => ({ ...f, notes: f.notes.filter((x) => x.id !== n.id) }))}
            >
              <IconTrash size={14} />
            </button>
            <p>{n.text}</p>
          </div>
        ))}
        {notes.length === 0 && <div className="muted small">No test notes yet.</div>}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------- details
function Details({ formula, update }: { formula: Formula; update: (fn: (f: Formula) => Formula, history?: boolean) => void }) {
  const [desc, setDesc] = useState(formula.description)
  const v = currentVersion(formula)
  const [comment, setComment] = useState(v.comment ?? '')
  useEffect(() => setDesc(formula.description), [formula.description])
  useEffect(() => setComment(v.comment ?? ''), [v.id, v.comment])

  const macDays = formula.macerationStart
    ? Math.floor((Date.now() - new Date(formula.macerationStart).getTime()) / 86400000)
    : null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 720 }}>
      <div className="field">
        <label>Description / brief</label>
        <textarea
          className="textarea"
          rows={4}
          value={desc}
          placeholder="Concept, inspiration, target audience…"
          onChange={(e) => setDesc(e.target.value)}
          onBlur={() => desc !== formula.description && update((f) => ({ ...f, description: desc }))}
        />
      </div>
      <div className="field">
        <label>Comment for {v.label}</label>
        <textarea
          className="textarea"
          rows={2}
          value={comment}
          placeholder="What changed in this modification?"
          onChange={(e) => setComment(e.target.value)}
          onBlur={() =>
            comment !== (v.comment ?? '') &&
            update((f) => ({ ...f, versions: f.versions.map((x) => (x.id === v.id ? { ...x, comment } : x)) }))
          }
        />
      </div>
      <div className="grid-2">
        <div className="field">
          <label>Maceration started</label>
          <input
            type="date"
            className="input"
            value={formula.macerationStart?.slice(0, 10) ?? ''}
            onChange={(e) => update((f) => ({ ...f, macerationStart: e.target.value || undefined }))}
          />
          {macDays != null && macDays >= 0 && (
            <span className="hint">
              Macerating for {macDays} day{macDays === 1 ? '' : 's'}
            </span>
          )}
        </div>
        <div className="field">
          <label>History</label>
          <div className="small muted" style={{ lineHeight: 1.9 }}>
            Created {new Date(formula.createdAt).toLocaleString('en-GB')}
            <br />
            Last edited {new Date(formula.updatedAt).toLocaleString('en-GB')}
            <br />
            {formula.versions.length} version{formula.versions.length === 1 ? '' : 's'} · {formula.notes.length} test note{formula.notes.length === 1 ? '' : 's'}
          </div>
        </div>
      </div>
      <div className="field">
        <label>Version timeline</label>
        <div style={{ borderLeft: '1px solid var(--line)', marginLeft: 6, paddingLeft: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
          {[...formula.versions].reverse().map((x) => (
            <div key={x.id} style={{ position: 'relative' }}>
              <span
                className="dot"
                style={{
                  position: 'absolute', left: -21, top: 5,
                  background: x.id === formula.currentVersionId ? 'var(--accent-hi)' : 'var(--line)'
                }}
              />
              <div className="row">
                <b style={{ fontWeight: 500 }}>{x.label}</b>
                <span className="faint small">{new Date(x.createdAt).toLocaleDateString('en-GB')}</span>
                <span className="faint small">· {x.rows.length} rows</span>
              </div>
              {x.comment && <div className="small muted">{x.comment}</div>}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
