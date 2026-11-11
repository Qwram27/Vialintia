import { useMemo } from 'react'
import type { Assembly, Formula } from '@shared/types'
import { currentVersion, familyById, useAccordIndex, useMaterialMap, useStore } from '@/store/store'
import { confirmDialog, navigate, toast } from '@/store/ui'
import { computeFormula, fmt, fmtSmart, roundToStep } from '@/lib/calc'
import { uid } from '@/lib/id'
import { catalogNo } from '@/lib/archive'
import { NumberInput } from '@/components/NumberInput'
import { IconCheck, IconChevronLeft } from '@/components/Icons'

/** Weighing session: ingredient by ingredient, target vs. actually weighed, running scale reading. */
export function Assemble({ id }: { id: string }) {
  const formula = useStore((s) => s.formulas.find((f) => f.id === id))
  const all = useStore((s) => s.formulas)
  const settings = useStore((s) => s.settings)
  const updateFormula = useStore((s) => s.updateFormula)
  const materials = useMaterialMap()
  const accords = useAccordIndex()
  const version = formula ? currentVersion(formula) : null
  const calc = useMemo(
    () => (formula && version ? computeFormula(formula, version.rows, materials, settings, accords) : null),
    [formula, version, materials, settings, accords]
  )
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
          N°{catalogNo(formula, all)} · {labels.get(draft?.versionId ?? version.id)} · Assemble
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
            <span className="v">{formula.batch.mode === 'bottles' ? `${formula.batch.bottles} × ${fmtSmart(formula.batch.bottleMl)} ml` : `${fmt(b.concentrateG, 2)} g concentrate`}</span>
          </div>
          {drops ? (
            <div className="stat-row">
              <span className="k">Concentrate to count</span>
              <span className="v">{fmt(calc.rows.reduce((s, x) => s + (x.material ? toDrops(x.batchGrams) : 0), 0), 0)} drops · ≈ {show(r(b.concentrateG))} g</span>
            </div>
          ) : (
            <div className="stat-row"><span className="k">Total weight</span><span className="v">{show(r(b.concentrateG))} g</span></div>
          )}
          <div className="stat-row"><span className="k">Then alcohol</span><span className="v">{show(r(b.alcoholG))} g · {fmt(b.alcoholMl, 1)} ml</span></div>
          <div className="stat-row"><span className="k">Ingredients</span><span className="v">{calc.rows.filter((x) => x.material && x.batchGrams > 0).length}</span></div>
          <p className="faint small">Change the batch size in the formula (Setup → Batch) before you start.</p>
          <button className="btn btn-primary mt" disabled={!(b.concentrateG > 0) || calc.rows.length === 0} onClick={start}>
            Start assembling
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
  const targetTotal = draft.rows.reduce((s, x) => s + x.target, 0)
  const doneCount = draft.rows.filter((x) => x.actual != null).length
  const setActual = (rowId: string, v: number | null) =>
    patchDraft((a) => ({ ...a, rows: a.rows.map((x) => (x.rowId === rowId ? { ...x, actual: v == null ? null : ru(v) } : x)) }))
  const doneTarget = draft.rows.filter((x) => x.actual != null).reduce((s, x) => s + x.target, 0)
  const deviation = ru(weighed - doneTarget)

  return (
    <div className="page asm">
      {head}
      <div className="asm-summary card">
        <div className="metric"><div className="k">Done</div><div className="v">{doneCount}<small>/ {draft.rows.length}</small></div></div>
        <div className="metric"><div className="k">{drops ? 'Counted' : 'Weighed'}</div><div className="v">{showU(ru(weighed))}<small>{U}</small></div></div>
        <div className="metric"><div className="k">Target</div><div className="v">{showU(ru(targetTotal))}<small>{U}</small></div></div>
        <div className="metric">
          <div className="k">Deviation</div>
          <div className="v">{doneCount ? `${deviation >= 0 ? '+' : ''}${showU(deviation)}` : '—'}<small>{U}</small></div>
        </div>
      </div>

      <div className="card asm-list">
        <div className="asm-row asm-headrow">
          <span>N°</span><span>Material</span><span className="n">Target {U}</span><span className="n">{drops ? 'Counted' : 'Weighed g'}</span><span className="n">{drops ? '≈ g' : 'Scale'}</span><span />
        </div>
        {rows.map((x) => {
          const m = materials.get(x.materialId)
          const dev = x.actual != null ? x.actual - x.target : null
          return (
            <div key={x.rowId} className={`asm-row${x.i === current ? ' current' : ''}${x.actual != null ? ' done' : ''}`}>
              <span className="no">{String(x.i + 1).padStart(2, '0')}</span>
              <span className="mat">
                <span className="nm">
                  {m && <span className="dot" style={{ background: familyById(settings, m.family).color }} />}
                  {m?.name ?? 'Missing material'}
                </span>
                <span className="meta">{x.dilution < 100 ? `${fmtSmart(x.dilution)}% dilution` : 'neat'}{dev != null && (drops ? dev !== 0 : Math.abs(dev) >= step / 2) ? ` · ${dev > 0 ? '+' : ''}${showU(ru(dev))} ${U}` : ''}</span>
              </span>
              <span className="n tgt">{showU(x.target)}</span>
              <span className="n">
                <NumberInput className="input asm-input" value={x.actual} min={0} allowEmpty placeholder={showU(x.target)} onCommit={(v) => setActual(x.rowId, v)} />
              </span>
              <span className="n faint">{drops ? show(r((x.actual ?? x.target) * dropG)) : show(x.reading)}</span>
              <span className="n">
                <button
                  className={`btn btn-icon${x.actual != null ? ' btn-primary' : ''}`}
                  title={x.actual != null ? 'Clear' : 'Weighed exactly the target'}
                  onClick={() => setActual(x.rowId, x.actual != null ? null : x.target)}
                >
                  <IconCheck size={15} />
                </button>
              </span>
            </div>
          )
        })}
        <div className={`asm-row asm-alcohol${current === -1 && draft.alcoholActual == null ? ' current' : ''}${draft.alcoholActual != null ? ' done' : ''}`}>
          <span className="no">+</span>
          <span className="mat">
            <span className="nm">Alcohol</span>
            <span className="meta">add to the concentrate · {fmt(calc.batch.alcoholMl, 1)} ml{drops ? ' · weighed in g' : ''}</span>
          </span>
          <span className="n tgt">{show(draft.alcoholG)}{drops ? ' g' : ''}</span>
          <span className="n">
            <NumberInput className="input asm-input" value={draft.alcoholActual} min={0} allowEmpty placeholder={show(draft.alcoholG)} onCommit={(v) => patchDraft((a) => ({ ...a, alcoholActual: v == null ? null : r(v) }))} />
          </span>
          <span className="n faint">{drops ? show(draft.alcoholActual ?? draft.alcoholG) : show(r(reading + (draft.alcoholActual ?? draft.alcoholG)))}</span>
          <span className="n">
            <button
              className={`btn btn-icon${draft.alcoholActual != null ? ' btn-primary' : ''}`}
              onClick={() => patchDraft((a) => ({ ...a, alcoholActual: a.alcoholActual != null ? null : a.alcoholG }))}
            >
              <IconCheck size={15} />
            </button>
          </span>
        </div>
      </div>

      <div className="row mt" style={{ flexWrap: 'wrap', gap: 8 }}>
        <span className="faint small" style={{ flex: '1 1 240px' }}>
          {drops
            ? 'Type how many drops went in, or tick ✓ if you hit the target. “≈ g” is the drop count converted with the drop mass from Settings.'
            : 'Type what the scale shows, or tick ✓ if you hit the target. “Scale” is the reading when everything goes into one tared vessel.'}
        </span>
        <button
          className="btn btn-ghost"
          onClick={async () => {
            if (await confirmDialog('Discard this session?', 'The weighed amounts entered so far will be removed.', 'Discard')) save((list) => list.filter((a) => a.id !== draft.id))
          }}
        >
          Discard
        </button>
        <button
          className="btn btn-primary"
          onClick={() => {
            patchDraft((a) => ({ ...a, finishedAt: new Date().toISOString() }))
            toast('Assembly saved')
          }}
        >
          Finish & save
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
