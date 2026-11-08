import { useMemo } from 'react'
import type { Formula } from '@shared/types'
import { NOTE_LABELS, NOTE_ORDER } from '@shared/defaults'
import { familyById, useMaterialMap, useStore } from '@/store/store'
import { navigate } from '@/store/ui'
import { computeFormula, diffVersions, fmt, fmtSmart, inkOn, type DiffKind } from '@/lib/calc'

const KIND_LABEL: Record<DiffKind, string> = { added: 'Added', removed: 'Removed', changed: 'Changed', same: '' }

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

  const calcA = selA ? computeFormula(selA.f, selA.v.rows, materials, settings) : null
  const calcB = selB ? computeFormula(selB.f, selB.v.rows, materials, settings) : null
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
          <div className="mark">A/B</div>
          <h3>Nothing to compare yet</h3>
          <p>Create a formula and save a new version to see the differences side by side.</p>
        </div>
      </div>
    )
  }

  const changes = diff.filter((d) => d.kind !== 'same').length

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <div className="page-kicker">Versions · Side by side</div>
          <h1 className="page-title">Compare</h1>
          <div className="page-sub">Neat material share in the concentrate, side by side · {changes} difference{changes === 1 ? '' : 's'}</div>
        </div>
      </div>

      <div className="cmp-head">
        {[
          { label: 'A', key: keyA, set: (k: string) => go(k, keyB), calc: calcA, sel: selA },
          { label: 'B', key: keyB, set: (k: string) => go(keyA, k), calc: calcB, sel: selB }
        ].map((side) => {
          const total = side.calc ? side.calc.byNote.top + side.calc.byNote.heart + side.calc.byNote.base : 0
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
                    {NOTE_ORDER.map((n) => (
                      <span key={n} className="row" style={{ gap: 5 }}>
                        <span className="dot" style={{ background: settings.noteColors[n], width: 7, height: 7 }} />
                        {NOTE_LABELS[n]} {total > 0 ? fmt((side.calc!.byNote[n] / total) * 100, 0) : 0}%
                      </span>
                    ))}
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

      <div className="card" style={{ padding: '4px 12px 10px' }}>
        <table className="ftable">
          <thead>
            <tr>
              <th className="l">Material</th>
              <th className="l">Note</th>
              <th>A %</th>
              <th>B %</th>
              <th>Δ</th>
              <th className="l" style={{ width: 110 }}>
                Change
              </th>
            </tr>
          </thead>
          <tbody>
            {diff.map((d) => {
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
                  <td className="l">
                    {m && (
                      <span className="note-pill" style={{ background: settings.noteColors[m.note], color: inkOn(settings.noteColors[m.note]) }}>
                        {NOTE_LABELS[m.note]}
                      </span>
                    )}
                  </td>
                  <td className={d.a == null ? 'dim' : ''}>{d.a == null ? '—' : fmtSmart(d.a)}</td>
                  <td className={d.b == null ? 'dim' : ''}>{d.b == null ? '—' : fmtSmart(d.b)}</td>
                  <td className={d.kind === 'same' ? 'dim' : d.delta > 0 ? 'delta-up' : 'delta-down'}>
                    {d.kind === 'same' ? '·' : `${d.delta > 0 ? '+' : '−'}${fmtSmart(Math.abs(d.delta))}`}
                  </td>
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
          </tbody>
        </table>
        {diff.length === 0 && <div className="empty">Both selections are empty.</div>}
      </div>
    </div>
  )
}
