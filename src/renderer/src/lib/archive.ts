import type { Formula } from '@shared/types'

/** Catalogue number by creation order: N°001, N°002… */
export function catalogNo(f: Formula, all: Formula[]): string {
  const sorted = [...all].sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id))
  const i = sorted.findIndex((x) => x.id === f.id)
  return String(i + 1).padStart(3, '0')
}

/**
 * Season code from a date: SS (Mar–Aug) / AW (Sep–Feb).
 * An AW season carries the year it runs into: Sep 2026 – Feb 2027 = AW27.
 */
export function seasonCode(iso: string): string {
  const d = new Date(iso)
  const m = d.getMonth()
  const y = d.getFullYear()
  if (m >= 2 && m <= 7) return `SS${String(y).slice(2)}`
  return `AW${String(m >= 8 ? y + 1 : y).slice(2)}`
}

export function shortDate(iso: string): string {
  const d = new Date(iso)
  return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getFullYear()).slice(2)}`
}
