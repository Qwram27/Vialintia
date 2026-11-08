import { useMemo, useState } from 'react'
import type { NoteLevel, Settings } from '@shared/types'
import { NOTE_LABELS, NOTE_ORDER } from '@shared/defaults'
import { evolution, fmt, type RowCalc } from '@/lib/calc'
import { familyById } from '@/store/store'

// ---------- Note structure ----------
export function StructureChart({ byNote, settings }: { byNote: Record<NoteLevel, number>; settings: Settings }) {
  const total = byNote.top + byNote.heart + byNote.base
  return (
    <div className="struct">
      {NOTE_ORDER.map((n) => {
        const share = total > 0 ? byNote[n] / total : 0
        return (
          <div className="struct-row" key={n} title={`${NOTE_LABELS[n]}: ${fmt(share * 100, 1)}%`}>
            <span className="k">{NOTE_LABELS[n]}</span>
            <div className="struct-track">
              <div style={{ width: `${share * 100}%`, background: settings.noteColors[n] }} />
            </div>
            <span className="v">{total > 0 ? `${fmt(share * 100, 1)}%` : '—'}</span>
          </div>
        )
      })}
    </div>
  )
}

/** Compact horizontal note bar used on dashboard cards. */
export function NoteBar({ byNote, settings }: { byNote: Record<NoteLevel, number>; settings: Settings }) {
  const total = byNote.top + byNote.heart + byNote.base
  if (total <= 0) return <div className="notebar" />
  return (
    <div className="notebar" title={NOTE_ORDER.map((n) => `${NOTE_LABELS[n]} ${fmt((byNote[n] / total) * 100, 0)}%`).join(' · ')}>
      {NOTE_ORDER.filter((n) => byNote[n] > 0).map((n) => (
        <div key={n} style={{ width: `${(byNote[n] / total) * 100}%`, background: settings.noteColors[n] }} />
      ))}
    </div>
  )
}

// ---------- Family donut ----------
export function FamilyDonut({
  byFamily,
  settings
}: {
  byFamily: { familyId: string; grams: number }[]
  settings: Settings
}) {
  const [hover, setHover] = useState<string | null>(null)
  const total = byFamily.reduce((s, f) => s + f.grams, 0)
  const R = 64
  const r = 55
  const C = 75
  if (total <= 0) return <div className="muted small">No data.</div>

  let a0 = -Math.PI / 2
  const gapAngle = byFamily.length > 1 ? 0.04 : 0
  const arcs = byFamily.map((f) => {
    const frac = f.grams / total
    const a1 = a0 + frac * Math.PI * 2
    const s = a0 + gapAngle / 2
    const e = Math.max(s + 0.001, a1 - gapAngle / 2)
    a0 = a1
    const large = e - s > Math.PI ? 1 : 0
    const p = (rad: number, ang: number) => `${C + rad * Math.cos(ang)},${C + rad * Math.sin(ang)}`
    const d =
      frac >= 0.9999
        ? `M${C},${C - R}A${R},${R} 0 1 1 ${C - 0.01},${C - R}L${C - 0.01},${C - r}A${r},${r} 0 1 0 ${C},${C - r}Z`
        : `M${p(R, s)}A${R},${R} 0 ${large} 1 ${p(R, e)}L${p(r, e)}A${r},${r} 0 ${large} 0 ${p(r, s)}Z`
    return { ...f, frac, d, fam: familyById(settings, f.familyId) }
  })
  const focus = arcs.find((a) => a.familyId === hover) ?? arcs[0]

  return (
    <div className="row" style={{ gap: 16, alignItems: 'center' }}>
      <svg width={116} height={116} viewBox="0 0 150 150" role="img" aria-label="Olfactive family balance" style={{ flex: 'none' }}>
        {arcs.map((a) => (
          <path
            key={a.familyId}
            d={a.d}
            fill={a.fam.color}
            opacity={hover && hover !== a.familyId ? 0.35 : 1}
            onMouseEnter={() => setHover(a.familyId)}
            onMouseLeave={() => setHover(null)}
            style={{ transition: 'opacity .15s', cursor: 'default' }}
          >
            <title>{`${a.fam.name}: ${fmt(a.frac * 100, 1)}%`}</title>
          </path>
        ))}
        <text x={C} y={C + 4} textAnchor="middle" fill="var(--text)" fontSize="22" fontWeight="200" letterSpacing="-1">
          {fmt(focus.frac * 100, 0)}%
        </text>
        <text x={C} y={C + 20} textAnchor="middle" fill="var(--muted)" fontSize="8" letterSpacing="1.6">
          {focus.fam.name.toUpperCase()}
        </text>
      </svg>
      <div className="legend" style={{ flex: 1, minWidth: 0 }}>
        {arcs.slice(0, 8).map((a) => (
          <div
            className="legend-item"
            key={a.familyId}
            onMouseEnter={() => setHover(a.familyId)}
            onMouseLeave={() => setHover(null)}
          >
            <span className="dot" style={{ background: a.fam.color }} />
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.fam.name}</span>
            <span className="pct">{fmt(a.frac * 100, 1)}%</span>
          </div>
        ))}
        {arcs.length > 8 && (
          <div className="legend-item faint">
            <span className="dot" style={{ background: 'var(--faint)' }} />
            <span>Other {arcs.length - 8}</span>
            <span className="pct">{fmt(arcs.slice(8).reduce((s, a) => s + a.frac, 0) * 100, 1)}%</span>
          </div>
        )}
      </div>
    </div>
  )
}

// ---------- Evolution curve ----------
function fmtTime(h: number): string {
  if (h < 1) return `${Math.round(h * 60)}m`
  if (h < 48) return `${h < 10 ? fmt(h, 1).replace(/\.0$/, '') : Math.round(h)}h`
  return `${Math.round(h / 24)}d`
}

export function EvolutionChart({ rows, settings }: { rows: RowCalc[]; settings: Settings }) {
  const data = useMemo(() => evolution(rows, 80), [rows])
  const [hi, setHi] = useState<number | null>(null)
  const W = 320
  const H = 140
  const padL = 4
  const padB = 18
  const max = Math.max(1e-9, ...data.points.map((p) => p.top + p.heart + p.base))
  if (data.points[0].top + data.points[0].heart + data.points[0].base <= 0)
    return <div className="muted small">No data.</div>
  const lnMax = Math.log(1 + data.tMax)
  const x = (t: number) => padL + (Math.log(1 + t) / lnMax) * (W - padL * 2)
  const yv = (v: number) => (H - padB) * (1 - v / max) + 2
  const stacks: NoteLevel[] = ['base', 'heart', 'top'] // base at the bottom

  const areas = stacks.map((note, si) => {
    const upper = data.points.map((p) => {
      let v = 0
      for (let k = 0; k <= si; k++) v += p[stacks[k]]
      return [x(p.t), yv(v)]
    })
    const lower = data.points.map((p) => {
      let v = 0
      for (let k = 0; k < si; k++) v += p[stacks[k]]
      return [x(p.t), yv(v)]
    })
    const d = `M${upper.map((q) => q.join(',')).join('L')}L${lower.reverse().map((q) => q.join(',')).join('L')}Z`
    return { note, d, top: upper }
  })

  const ticks = [0.25, 1, 4, 12, 24, 72, 168, 336].filter((t) => t <= data.tMax)
  const hp = hi != null ? data.points[hi] : null
  const hpTotal = hp ? hp.top + hp.heart + hp.base : 0

  return (
    <div style={{ position: 'relative' }}>
      <svg
        width="100%"
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label="Estimated evaporation curve"
        onMouseMove={(e) => {
          const rect = e.currentTarget.getBoundingClientRect()
          const px = ((e.clientX - rect.left) / rect.width) * W
          const frac = Math.min(1, Math.max(0, (px - padL) / (W - padL * 2)))
          setHi(Math.round(frac * (data.points.length - 1)))
        }}
        onMouseLeave={() => setHi(null)}
      >
        {ticks.map((t) => (
          <g key={t}>
            <line x1={x(t)} x2={x(t)} y1={0} y2={H - padB} stroke="var(--line-soft)" />
            <text x={x(t)} y={H - 4} fontSize="9" fill="var(--faint)" textAnchor="middle">
              {fmtTime(t)}
            </text>
          </g>
        ))}
        {areas.map((a) => (
          <path key={a.note} d={a.d} fill={settings.noteColors[a.note]} fillOpacity={0.16} stroke={settings.noteColors[a.note]} strokeWidth={1.2} strokeLinejoin="round" />
        ))}
        {hp && (
          <line x1={x(hp.t)} x2={x(hp.t)} y1={0} y2={H - padB} stroke="var(--text-2)" strokeDasharray="2 3" />
        )}
      </svg>
      {hp && (
        <div
          style={{
            position: 'absolute',
            top: 4,
            left: `${(x(hp.t) / W) * 100 > 60 ? 4 : 62}%`,
            background: 'rgba(30,30,32,.88)',
            backdropFilter: 'blur(20px)',
            boxShadow: 'var(--shadow)',
            borderRadius: 10,
            padding: '6px 9px',
            fontSize: 11.5,
            pointerEvents: 'none',
            minWidth: 120
          }}
        >
          <div style={{ color: 'var(--text)', marginBottom: 4, letterSpacing: '.1em' }}>T+{fmtTime(hp.t).toUpperCase()}</div>
          {(['top', 'heart', 'base'] as NoteLevel[]).map((n) => (
            <div key={n} className="row" style={{ gap: 6 }}>
              <span className="dot" style={{ background: settings.noteColors[n], width: 7, height: 7 }} />
              <span className="muted">{NOTE_LABELS[n]}</span>
              <span className="spacer" />
              <span className="num">{hpTotal > 0 ? `${fmt((hp[n] / hpTotal) * 100, 0)}%` : '—'}</span>
            </div>
          ))}
        </div>
      )}
      <div className="row small faint" style={{ justifyContent: 'space-between', marginTop: 4 }}>
        <span>EST. · LOG TIME</span>
        <span className="row" style={{ gap: 10 }}>
          {(['top', 'heart', 'base'] as NoteLevel[]).map((n) => (
            <span key={n} className="row" style={{ gap: 4 }}>
              <span className="dot" style={{ background: settings.noteColors[n], width: 7, height: 7 }} />
              {NOTE_LABELS[n]}
            </span>
          ))}
        </span>
      </div>
    </div>
  )
}
