import type { IfraEntry, IfraStatus } from '@/lib/calc'
import { fmtSmart } from '@/lib/calc'

const LABEL: Record<IfraStatus, string> = { none: '—', ok: 'OK', near: 'Near', over: 'Over' }
const GLYPH: Record<IfraStatus, string> = { none: '', ok: '✓', near: '◐', over: '!' }

export function IfraBadge({ entry }: { entry?: IfraEntry }) {
  if (!entry) return <span className="ifra ifra-none" title="No IFRA limit set for this material">—</span>
  const pct = Number.isFinite(entry.ratio) ? Math.round(entry.ratio * 100) : 999
  return (
    <span
      className={`ifra ifra-${entry.status}`}
      title={`${fmtSmart(entry.productPct)}% in product · limit ${fmtSmart(entry.limit)}% · ${pct}% of limit`}
    >
      {GLYPH[entry.status]} {LABEL[entry.status]}
    </span>
  )
}

export function statusColor(s: IfraStatus): string {
  return s === 'over' ? 'var(--over)' : s === 'near' ? 'var(--near)' : s === 'ok' ? 'var(--ok)' : 'var(--faint)'
}
