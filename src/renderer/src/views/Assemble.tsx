import { useMemo, useState } from 'react'
import type { Assembly, Formula } from '@shared/types'
import { currentVersion, familyById, useAccordIndex, useMaterialMap, useStore } from '@/store/store'
import { confirmDialog, navigate, toast } from '@/store/ui'
import { computeFormula, fmt, fmtSmart, roundToStep } from '@/lib/calc'
import { uid } from '@/lib/id'
import { concLabel } from '@/lib/archive'
import { NumberInput } from '@/components/NumberInput'
import { IconCheck, IconChevronLeft } from '@/components/Icons'

/** Weighing session: ingredient by ingredient, target vs. actually weighed, running scale reading. */
export function Assemble({ id }: { id: string }) {
  const formula = useStore((s) => s.formulas.find((f) => f.id === id))
  const settings = useStore((s) => s.settings)
  const updateFormula = useStore((s) => s.updateFormula)
  const materials = useMaterialMap()
  const accords = useAccordIndex()
  const version = formula ? currentVersion(formula) : null
  const calc = useMemo(
    () => (formula && version ? computeFormula(formula, version.rows, materials, settings, accords) : null),
    [formula, version, materials, settings, accords]
  )
  const [editing, setEditing] = useState<string | null>(null)
  if (!formula || !version || !calc) {
    return (
      <div className="page">
        <div className="card empty">
          <h3>Formula not found</h3>
          <button className="btn mt" onClick={() => navigate('/')}>Back to formulas</button>
        </div>
      </div>
    )
  }

  const step = settings.balanceStep || 0.01
  const r = (v: number) => roundToStep(v, step)
  const show = (v: number | null | undefined) => (v == null ? '—' : fmt(v, Math.max(0, Math.ceil(-Math.log10(step) - 1e-9))))
  const assemblies = formula.assemblies ?? []
  const draft = [...assemblies].reverse().find((a) => !a.finishedAt)
  // Rows are counted in drops when the formula is written in drops (or the running session was).
  const drops = (draft ? draft.unit : formula.unit) === 'drops'
  const dropG = settings.dropMassG || 0.02
  const toDrops = (g: number) => (g > 0 ? Math.max(1, Math.round(g / dropG)) : 0)
  const ru = (v: number) => (drops ? Math.round(v) : r(v))
  const showU = (v: number | null | undefined) => (v == null ? '—' : drops ? fmt(v, 0) : show(v))
  const U = drops ? 'drops' : 'g'
  const history = assemblies.filter((a) => a.finishedAt).reverse()
  const labels = new Map(formula.versions.map((v) => [v.id, v.label]))
  const save = (fn: (list: Assembly[]) => Assembly[]) =>
    updateFormula(id, (f: Formula) => ({ ...f, assemblies: fn(f.assemblies ?? []) }), { history: false })
  const patchDraft = (fn: (a: Assembly) => Assembly) => save((list) => list.map((a) => (a.id === draft?.id ? fn(a) : a)))

  const start = () => {
    const a: Assembly = {
      id: uid(),
      versionId: version.id,
      startedAt: new Date().toISOString(),
      concentrateG: calc.batch.concentrateG,
      alcoholG: r(calc.batch.alcoholG),
      alcoholActual: null,
      unit: drops ? 'drops' : 'g',
      rows: calc.rows
        .filter((x) => x.material && x.batchGrams > 0)
        .map((x) => ({ rowId: x.row.id, materialId: x.row.materialId, dilution: x.row.dilution, target: drops ? toDrops(x.batchGrams) : r(x.batchGrams), actual: null }))
    }
    save((list) => [...list.filter((x) => x.finishedAt), a])
  }

  const head = (
    <div className="page-head">
      <div>
        <div className="page-kicker">
          {concLabel(formula)} · {labels.get(draft?.versionId ?? version.id)} · Assemble
        </div>
        <h1 className="page-title">{formula.name}</h1>
        <div className="page-sub">
          {drops ? `Counting drops · 1 drop ≈ ${String(dropG)} g · set in Settings` : `Balance step ${String(step)} g · set in Settings`}
        </div>
      </div>
      <div className="btn-group">
        <button className="btn" onClick={() => navigate(`/formula/${formula.id}`)}>
          <IconChevronLeft /> Back to formula
        </button>
      </div>
    </div>
  )

  if (!draft) {
    const b = calc.batch
    return (
      <div className="page asm">
        {head}
        <div className="card card-pad">
          <h3 className="card-title">Batch</h3>
          <div className="stat-row"><span className="k">Version</span><span className="v">{version.label}</span></div>
          <div className="stat-row">
            <span className="k">Batch</span>
            <span className="v">{formula.batch.mode === 'bottles' ? `${formula.batch.bottles} × ${fmtSmart(formula.batch.bottleMl)} ml` : `${fmt(b.productG, 2)} g product`}</span>
          </div>
          {drops ? (
            <div className="stat-row">
              <span className="k">Concentrate to count</span>
              <span className="v">{fmt(calc.rows.reduce((s, x) => s + (x.material ? toDrops(x.batchGrams) : 0), 0), 0)} drops · ≈ {show(r(b.concentrateG))} g</span>
            </div>
          ) : (
            <div className="stat-row"><span className="k">Materials together</span><span className="v">{show(r(b.concentrateG))} g</span></div>
          )}
          <div className="stat-row"><span className="k">Then alcohol</span><span className="v">{show(r(b.alcoholG))} g · {fmt(b.alcoholMl, 1)} ml</span></div>
          <div className="stat-row"><span className="k">Ingredients</span><span className="v">{calc.rows.filter((x) => x.material && x.batchGrams > 0).length}</span></div>
          {calc.rows.some((x) => x.material && x.batchGrams > 0 && x.row.dilution < 100) && (
            <p className="faint small">
              Diluted materials are weighed as their solutions — the alcohol amount already allows for the solvent they bring.
            </p>
          )}
          <p className="faint small">Change the batch size in the formula (Setup → Batch) before you start.</p>
          <button className="btn btn-primary mt" disabled={!(b.concentrateG > 0) || calc.rows.length === 0} onClick={start}>
            Start
          </button>
        </div>
        <History history={history} labels={labels} show={show} />
      </div>
    )
  }

  // running scale reading: actual where weighed, target where still to do
  let reading = 0
  const current = draft.rows.findIndex((x) => x.actual == null)
  const rows = draft.rows.map((x, i) => {
    reading += x.actual ?? x.target
    return { ...x, i, reading: r(reading) }
  })
  const weighed = draft.rows.reduce((s, x) => s + (x.actual ?? 0), 0)
  const doneCount = draft.rows.filter((x) => x.actual != null).length
  const setActual = (rowId: string, v: number | null) =>
    patchDraft((a) => ({ ...a, rows: a.rows.map((x) => (x.rowId === rowId ? { ...x, actual: v == null ? null : ru(v) } : x)) }))
  const doneTarget = draft.rows.filter((x) => x.actual != null).reduce((s, x) => s + x.target, 0)
  const deviation = ru(weighed - doneTarget)

  const alcoholDone = draft.alcoholActual != null
  const allDone = current === -1 && alcoholDone
  const amount = (v: number) => (drops ? `${fmt(v, 0)} drop${v === 1 ? '' : 's'}` : `${show(v)} g`)

  return (
    <div className="page asm">
      {head}

      <div className="card asm-guide">
        <div className="asm-progress">
          <span className="k">
            {doneCount} of {draft.rows.length} in{alcoholDone ? ' · alcohol added' : ''}
          </span>
          <span className="track">
            <span style={{ width: `${((doneCount + (alcoholDone ? 1 : 0)) / (draft.rows.length + 1)) * 100}%` }} />
          </span>
        </div>
        <p>
          {drops
            ? 'Count the drops of each material into the bottle, in this order. Tap ✓ when it is in. Added a different number? Tap the amount and type what went in.'
            : 'Put the bottle on the scale and tare it. Add each material in this order and tap ✓ when it is in. Weighed a bit more or less? Tap the amount and type what the scale showed.'}
        </p>
      </div>

      <div className="asm-steps">
        {rows.map((x) => {
          const m = materials.get(x.materialId)
          const done = x.actual != null
          const off = done && x.actual !== x.target
          return (
            <div key={x.rowId} className={`asm-step${x.i === current ? ' current' : ''}${done ? ' done' : ''}`}>
              <span className="asm-no">{String(x.i + 1).padStart(2, '0')}</span>
              <span className="asm-what">
                <span className="nm">
                  {m && <span className="dot" style={{ background: familyById(settings, m.family).color }} />}
                  {m?.name ?? 'Missing material'}
                </span>
                <span className="sub">{x.dilution < 100 ? `${Number(x.dilution.toFixed(2))}% solution` : 'neat'}</span>
              </span>
              <span className="asm-amt">
                {editing === x.rowId ? (
                  <NumberInput
                    className="input asm-input"
                    value={x.actual ?? x.target}
                    min={0}
                    autoFocus
                    onCommit={(v) => {
                      setActual(x.rowId, v ?? x.target)
                      setEditing(null)
                    }}
                  />
                ) : (
                  <button type="button" className="asm-amt-btn" onClick={() => setEditing(x.rowId)} title="Type the amount that actually went in">
                    <span className="v">{amount(x.actual ?? x.target)}</span>
                    <span className="hint">
                      {off ? `planned ${amount(x.target)}` : drops ? `≈ ${show(r(x.target * dropG))} g` : `scale ${show(x.reading)} g`}
                    </span>
                  </button>
                )}
              </span>
              <button
                type="button"
                className={`asm-tick${done ? ' on' : ''}`}
                aria-label={done ? 'Undo' : 'In'}
                onClick={() => {
                  setEditing(null)
                  setActual(x.rowId, done ? null : x.target)
                }}
              >
                <IconCheck size={18} />
              </button>
            </div>
          )
        })}

        <div className={`asm-step asm-alc${current === -1 && !alcoholDone ? ' current' : ''}${alcoholDone ? ' done' : ''}`}>
          <span className="asm-no">+</span>
          <span className="asm-what">
            <span className="nm">Alcohol</span>
            <span className="sub">top up last · {fmt(calc.batch.alcoholMl, 1)} ml</span>
          </span>
          <span className="asm-amt">
            {editing === 'alcohol' ? (
              <NumberInput
                className="input asm-input"
                value={draft.alcoholActual ?? draft.alcoholG}
                min={0}
                autoFocus
                onCommit={(v) => {
                  patchDraft((a) => ({ ...a, alcoholActual: r(v ?? a.alcoholG) }))
                  setEditing(null)
                }}
              />
            ) : (
              <button type="button" className="asm-amt-btn" onClick={() => setEditing('alcohol')}>
                <span className="v">{show(draft.alcoholActual ?? draft.alcoholG)} g</span>
                <span className="hint">
                  {draft.alcoholActual != null && draft.alcoholActual !== draft.alcoholG
                    ? `planned ${show(draft.alcoholG)} g`
                    : drops
                      ? 'on the scale'
                      : `scale ${show(r(reading + (draft.alcoholActual ?? draft.alcoholG)))} g`}
                </span>
              </button>
            )}
          </span>
          <button
            type="button"
            className={`asm-tick${alcoholDone ? ' on' : ''}`}
            aria-label={alcoholDone ? 'Undo' : 'In'}
            onClick={() => {
              setEditing(null)
              patchDraft((a) => ({ ...a, alcoholActual: a.alcoholActual != null ? null : a.alcoholG }))
            }}
          >
            <IconCheck size={18} />
          </button>
        </div>
      </div>

      {doneCount > 0 && Math.abs(deviation) > 0 && (
        <p className="faint small asm-dev">
          So far {deviation > 0 ? 'more' : 'less'} than planned by {showU(Math.abs(deviation))} {U} ({showU(ru(weighed))} instead of {showU(ru(doneTarget))} {U}).
        </p>
      )}

      <div className="asm-actions">
        <button
          className="btn btn-ghost"
          onClick={async () => {
            if (await confirmDialog('Discard this session?', 'What you ticked so far will be removed.', 'Discard')) save((list) => list.filter((a) => a.id !== draft.id))
          }}
        >
          Discard
        </button>
        <div className="spacer" />
        <button
          className="btn btn-primary"
          onClick={() => {
            patchDraft((a) => ({ ...a, finishedAt: new Date().toISOString() }))
            toast(allDone ? 'Assembly saved' : 'Saved — not every step was ticked')
          }}
        >
          <IconCheck size={14} /> Finish
        </button>
      </div>
      <History history={history} labels={labels} show={show} />
    </div>
  )
}

function History({ history, labels, show }: { history: Assembly[]; labels: Map<string, string>; show: (v: number | null) => string }) {
  if (!history.length) return null
  return (
    <div className="card card-pad mt">
      <h3 className="card-title">Assembled <small>{history.length}</small></h3>
      {history.map((a) => {
        const done = a.rows.filter((x) => x.actual != null)
        const weighed = done.reduce((s, x) => s + (x.actual ?? 0), 0)
        const target = done.reduce((s, x) => s + x.target, 0)
        const worst = done.reduce((w, x) => (x.target > 0 ? Math.max(w, Math.abs((x.actual! - x.target) / x.target)) : w), 0)
        const u = a.unit === 'drops' ? 'drops' : 'g'
        const v = (n: number) => (a.unit === 'drops' ? fmt(n, 0) : show(n))
        return (
          <div className="stat-row" key={a.id}>
            <span className="k">
              {new Date(a.finishedAt!).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })} · {labels.get(a.versionId) ?? '—'}
            </span>
            <span className="v">
              {v(weighed)} / {v(target)} {u} · {done.length}/{a.rows.length} · max dev {fmtSmart(worst * 100)}%
            </span>
          </div>
        )
      })}
    </div>
  )
}
