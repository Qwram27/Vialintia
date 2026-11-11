import { Fragment, useMemo, useState } from 'react'
import type { Formula, NoteLevel } from '@shared/types'
import { NOTE_LABELS, NOTE_ORDER } from '@shared/defaults'
import { familyById, useAccordIndex, useMaterialMap, useStore } from '@/store/store'
import { navigate } from '@/store/ui'
import { computeFormula, DEFAULT_TENACITY, diffVersions, fmt, fmtSmart, fmtTrim, type DiffKind, type DiffRow } from '@/lib/calc'
import { Seg } from '@/components/Seg'

const KIND_LABEL: Record<DiffKind, string> = { added: 'Added', removed: 'Removed', changed: 'Changed', same: '' }
const VOLATILITY: Record<NoteLevel, string> = { top: 'most volatile', heart: 'middle', base: 'most tenacious' }
const signed = (v: number) => (Math.abs(v) < 0.0005 ? '·' : `${v > 0 ? '+' : '−'}${fmtSmart(Math.abs(v))}`)

// Selection encoded as "formulaId:versionId"
function parseSel(s: string | undefined, formulas: Formula[]) {
  if (!s) return null
  const [fid, vid] = s.split(':')
  const f = formulas.find((x) => x.id === fid)
  if (!f) return null
  const v = f.versions.find((x) => x.id === vid) ?? (vid ? undefined : f.versions[f.versions.length - 1])
  return v ? { f, v } : null
}

export function Compare({ a, b }: { a?: string; b?: string }) {
  const formulas = useStore((s) => s.formulas)
  const settings = useStore((s) => s.settings)
  const materials = useMaterialMap()
  const accords = useAccordIndex()
  const [show, setShow] = useState<'all' | 'changes'>('all')

  // Sensible defaults: last two versions of the given (or most recent) formula.
  const selA = useMemo(() => {
    const p = parseSel(a, formulas)
    if (p && a?.includes(':')) return p
    const f = p?.f ?? [...formulas].sort((x, y) => y.updatedAt.localeCompare(x.updatedAt))[0]
    if (!f) return null
    const v = f.versions.length > 1 ? f.versions[f.versions.length - 2] : f.versions[0]
    return { f, v }
  }, [a, formulas])
  const selB = useMemo(() => {
    const p = parseSel(b, formulas)
    if (p) return p
    if (!selA) return null
    return { f: selA.f, v: selA.f.versions[selA.f.versions.length - 1] }
  }, [b, formulas, selA])

  const options = formulas.flatMap((f) => f.versions.map((v) => ({ key: `${f.id}:${v.id}`, label: `${f.name} — ${v.label}` })))

  const calcA = selA ? computeFormula(selA.f, selA.v.rows, materials, settings, accords) : null
  const calcB = selB ? computeFormula(selB.f, selB.v.rows, materials, settings, accords) : null
  const diff = calcA && calcB ? diffVersions(calcA.rows, calcB.rows) : []

  const go = (na?: string, nb?: string) => {
    const params = new URLSearchParams()
    if (na) params.set('a', na)
    if (nb) params.set('b', nb)
    navigate(`/compare?${params}`)
  }
  const keyA = selA ? `${selA.f.id}:${selA.v.id}` : ''
  const keyB = selB ? `${selB.f.id}:${selB.v.id}` : ''

  if (formulas.length === 0) {
    return (
      <div className="page">
        <div className="card empty">
          <div className="mark">X/Y</div>
          <h3>Nothing to compare yet</h3>
          <p>Create a formula and save a new version to see the differences side by side.</p>
        </div>
      </div>
    )
  }

  const changes = diff.filter((d) => d.kind !== 'same').length

  // Note structure of each side, in % of the neat concentrate.
  const share = (c: typeof calcA) => {
    const t = c ? c.byNote.top + c.byNote.heart + c.byNote.base : 0
    return (n: NoteLevel) => (c && t > 0 ? (c.byNote[n] / t) * 100 : 0)
  }
  const sa = share(calcA)
  const sb = share(calcB)

  // Diff rows grouped by note, most volatile first; inside a group by tenacity, then by size.
  const life = (d: DiffRow) => {
    const m = materials.get(d.materialId)
    return m ? m.tenacityHours || DEFAULT_TENACITY[m.note] : Infinity
  }
  const groups = ([...NOTE_ORDER, 'other'] as const)
    .map((g) => {
      const all = diff.filter((d) => (materials.get(d.materialId)?.note ?? 'other') === g)
      const rows = all
        .filter((d) => show === 'all' || d.kind !== 'same')
        .sort((x, y) => life(x) - life(y) || Math.max(y.a ?? 0, y.b ?? 0) - Math.max(x.a ?? 0, x.b ?? 0))
      const a = all.reduce((s, d) => s + (d.a ?? 0), 0)
      const b = all.reduce((s, d) => s + (d.b ?? 0), 0)
      return { g, rows, a, b, changed: all.filter((d) => d.kind !== 'same').length }
    })
    .filter((x) => x.rows.length > 0)

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <div className="page-kicker">Versions · Side by side</div>
          <h1 className="page-title">Analyze</h1>
          <div className="page-sub">Neat share in the concentrate, grouped by volatility · {changes} difference{changes === 1 ? '' : 's'}</div>
        </div>
      </div>

      <div className="cmp-head">
        {[
          { label: 'X', key: keyA, set: (k: string) => go(k, keyB), calc: calcA, sel: selA },
          { label: 'Y', key: keyB, set: (k: string) => go(keyA, k), calc: calcB, sel: selB }
        ].map((side) => {
          return (
            <div key={side.label} className="card card-pad">
              <div className="row mb">
                <span className="stat-big" style={{ width: 28 }}>
                  {side.label}
                </span>
                <select className="select" value={side.key} onChange={(e) => side.set(e.target.value)}>
                  {options.map((o) => (
                    <option key={o.key} value={o.key}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
              {side.calc && side.sel && (
                <>
                  <div className="row small muted" style={{ gap: 14, flexWrap: 'wrap' }}>
                    <span>{side.calc.materialCount} materials</span>
                    <span>{side.sel.f.concentration}% concentration</span>
                    {side.calc.costPerKg > 0 && <span>{settings.currency}{fmt(side.calc.costPerKg, 0)}/kg</span>}

                  </div>
                  {side.sel.v.comment && <div className="small faint mt">{side.sel.v.comment}</div>}
                  <button className="btn btn-ghost btn-sm mt" style={{ marginLeft: -10 }} onClick={() => navigate(`/formula/${side.sel!.f.id}`)}>
                    Open formula →
                  </button>
                </>
              )}
            </div>
          )
        })}
      </div>

      <div className="card card-pad cmp-struct">
        <h3 className="card-title">
          Structure <small>top → base · share of the neat concentrate</small>
        </h3>
        {NOTE_ORDER.map((n) => (
          <div key={n} className="cmp-struct-row">
            <span className="cmp-struct-name">
              <span className="dot" style={{ background: settings.noteColors[n] }} />
              {NOTE_LABELS[n]}
              <small>{VOLATILITY[n]}</small>
            </span>
            <span className="cmp-bars">
              {[
                { k: 'X', v: sa(n) },
                { k: 'Y', v: sb(n) }
              ].map((x) => (
                <span key={x.k} className="cmp-bar">
                  <span className="k">{x.k}</span>
                  <span className="track">
                    <span style={{ width: `${Math.min(100, x.v)}%`, background: settings.noteColors[n] }} />
                  </span>
                  <span className="v">{fmt(x.v, 1)}%</span>
                </span>
              ))}
            </span>
            <span className={`cmp-struct-d ${sb(n) - sa(n) > 0.05 ? 'delta-up' : 'delta-down'}`}>{Math.abs(sb(n) - sa(n)) < 0.05 ? '·' : `${sb(n) > sa(n) ? '+' : '−'}${fmt(Math.abs(sb(n) - sa(n)), 1)}`}</span>
          </div>
        ))}
      </div>

      <div className="row mb" style={{ gap: 10 }}>
        <span className="label">Materials</span>
        <Seg
          value={show}
          onChange={setShow}
          options={[
            { value: 'all', label: `All ${diff.length}` },
            { value: 'changes', label: `Changes ${changes}` }
          ]}
        />
      </div>

      <div className="card" style={{ padding: '4px 12px 10px' }}>
        <table className="ftable cmp-table">
          <thead>
            <tr>
              <th className="l">Material</th>
              <th title="Tenacity on a blotter (TGSC substantivity) — fastest first within each group">Life h</th>
              <th>X %</th>
              <th>Y %</th>
              <th>Δ</th>
              <th className="l" style={{ width: 110 }}>
                Change
              </th>
            </tr>
          </thead>
          <tbody>
            {groups.map((grp) => (
              <Fragment key={grp.g}>
                <tr className="sec-row cmp-group">
                  <td className="l">
                    <span className="sec-title">
                      {grp.g === 'other' ? 'Missing materials' : `${NOTE_LABELS[grp.g]} notes`}
                    </span>
                    {grp.g !== 'other' && <small>{VOLATILITY[grp.g]}</small>}
                  </td>
                  <td />
                  <td>{fmtSmart(grp.a)}</td>
                  <td>{fmtSmart(grp.b)}</td>
                  <td className={Math.abs(grp.b - grp.a) < 0.0005 ? 'dim' : grp.b > grp.a ? 'delta-up' : 'delta-down'}>{signed(grp.b - grp.a)}</td>
                  <td className="l">
                    <small>{grp.changed ? `${grp.changed} change${grp.changed > 1 ? 's' : ''}` : 'unchanged'}</small>
                  </td>
                </tr>
                {grp.rows.map((d) => {
                  const m = materials.get(d.materialId)
                  const fam = m ? familyById(settings, m.family) : null
                  return (
                    <tr key={d.materialId} className={d.kind === 'added' ? 'diff-added' : d.kind === 'removed' ? 'diff-removed' : ''}>
                      <td className="l">
                        <div className="row">
                          <span className="dot" style={{ background: fam?.color ?? 'var(--faint)' }} />
                          {m?.name ?? 'Missing material'}
                        </div>
                      </td>
                      <td className="muted">{m?.tenacityHours ? fmtTrim(m.tenacityHours) : <span className="dim">—</span>}</td>
                      <td className={d.a == null ? 'dim' : ''}>{d.a == null ? '—' : fmtSmart(d.a)}</td>
                      <td className={d.b == null ? 'dim' : ''}>{d.b == null ? '—' : fmtSmart(d.b)}</td>
                      <td className={d.kind === 'same' ? 'dim' : d.delta > 0 ? 'delta-up' : 'delta-down'}>{d.kind === 'same' ? '·' : signed(d.delta)}</td>
                      <td className="l">
                        <span
                          className="diff-kind"
                          style={{
                            color: d.kind === 'added' ? 'var(--ok)' : d.kind === 'removed' ? 'var(--over)' : d.kind === 'changed' ? 'var(--near)' : 'var(--faint)'
                          }}
                        >
                          {d.kind === 'changed' ? (d.delta > 0 ? '▲ More' : '▼ Less') : d.kind === 'added' ? '+ Added' : d.kind === 'removed' ? '− Removed' : KIND_LABEL[d.kind]}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </Fragment>
            ))}
          </tbody>
        </table>
        {diff.length > 0 && groups.length === 0 && <div className="empty">No differences — both versions are the same.</div>}
        {diff.length === 0 && <div className="empty">Both selections are empty.</div>}
      </div>
    </div>
  )
}
