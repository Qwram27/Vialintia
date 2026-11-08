import type { Formula, FormulaRow, Material, NoteLevel, Settings } from '@shared/types'

export type IfraStatus = 'none' | 'ok' | 'near' | 'over'

export interface RowCalc {
  row: FormulaRow
  material?: Material
  grams: number // weighed mass (material + its solvent)
  weighedPct: number // % of concentrate as weighed
  neatGrams: number
  neatPct: number // % of neat material in concentrate
  productPct: number // % of neat material in finished product
  cost: number // cost of the neat material in this row
  batchGrams: number // weighed grams scaled to the batch
}

export interface IfraEntry {
  material: Material
  neatPct: number // aggregated % in concentrate
  productPct: number // aggregated % in finished product
  limit: number
  ratio: number // productPct / limit
  status: IfraStatus
}

export interface IfraResult {
  entries: IfraEntry[]
  byMaterial: Map<string, IfraEntry>
  worst: IfraStatus
  maxConcentration: number | null // max % of concentrate in product that stays within limits
  limiting?: Material
}

export interface BatchCalc {
  productMl: number
  productG: number
  concentrateG: number
  alcoholG: number
  alcoholMl: number
  scale: number
  costConcentrate: number
  costAlcohol: number
  costTotal: number
  costPerBottle: number | null
}

export interface FormulaCalc {
  rows: RowCalc[]
  totalGrams: number
  neatGrams: number
  solventGrams: number
  cost: number
  costPerKg: number // cost per kg of concentrate as weighed
  byNote: Record<NoteLevel, number> // neat grams
  byFamily: { familyId: string; grams: number }[]
  materialCount: number
  batch: BatchCalc
  ifra: IfraResult
}

export const DEFAULT_TENACITY: Record<NoteLevel, number> = { top: 2, heart: 24, base: 150 }

export function rowGrams(row: FormulaRow, unit: Formula['unit'], settings: Settings): number {
  const amount = Number.isFinite(row.amount) ? Math.max(0, row.amount) : 0
  return unit === 'drops' ? amount * settings.dropMassG : amount
}

function clampPct(v: number): number {
  if (!Number.isFinite(v)) return 100
  return Math.min(100, Math.max(0, v))
}

export function ifraStatus(productPct: number, limit: number | null | undefined, nearRatio: number): IfraStatus {
  if (limit == null || !Number.isFinite(limit)) return 'none'
  if (limit <= 0) return productPct > 0 ? 'over' : 'ok'
  const ratio = productPct / limit
  if (ratio > 1 + 1e-9) return 'over'
  if (ratio >= nearRatio) return 'near'
  return 'ok'
}

const STATUS_RANK: Record<IfraStatus, number> = { none: 0, ok: 1, near: 2, over: 3 }

export function worstStatus(a: IfraStatus, b: IfraStatus): IfraStatus {
  return STATUS_RANK[a] >= STATUS_RANK[b] ? a : b
}

export function computeIfra(
  rows: RowCalc[],
  concentration: number,
  settings: Settings
): IfraResult {
  const agg = new Map<string, { material: Material; neatPct: number }>()
  for (const r of rows) {
    if (!r.material) continue
    const cur = agg.get(r.material.id)
    if (cur) cur.neatPct += r.neatPct
    else agg.set(r.material.id, { material: r.material, neatPct: r.neatPct })
  }
  const entries: IfraEntry[] = []
  let worst: IfraStatus = 'none'
  let maxConcentration: number | null = null
  let limiting: Material | undefined
  for (const { material, neatPct } of agg.values()) {
    const limit = material.ifraLimit
    if (limit == null || !Number.isFinite(limit)) continue
    const productPct = (neatPct * concentration) / 100
    const status = ifraStatus(productPct, limit, settings.nearLimitRatio)
    const entry: IfraEntry = {
      material,
      neatPct,
      productPct,
      limit,
      ratio: limit > 0 ? productPct / limit : productPct > 0 ? Infinity : 0,
      status
    }
    entries.push(entry)
    worst = worstStatus(worst, status)
    if (neatPct > 0) {
      const max = Math.min(100, (limit / neatPct) * 100)
      if (maxConcentration === null || max < maxConcentration) {
        maxConcentration = max
        limiting = material
      }
    }
  }
  entries.sort((a, b) => b.ratio - a.ratio)
  return {
    entries,
    byMaterial: new Map(entries.map((e) => [e.material.id, e])),
    worst,
    maxConcentration,
    limiting
  }
}

export function computeBatch(formula: Formula, totalGrams: number, costPerKg: number, settings: Settings): BatchCalc {
  const conc = clampPct(formula.concentration)
  const b = formula.batch
  let productMl: number
  let productG: number
  let concentrateG: number
  if (b.mode === 'mass') {
    concentrateG = Math.max(0, b.massG || 0)
    productG = conc > 0 ? concentrateG / (conc / 100) : 0
    productMl = settings.productDensity > 0 ? productG / settings.productDensity : 0
  } else {
    productMl = Math.max(0, (b.bottles || 0) * (b.bottleMl || 0))
    productG = productMl * settings.productDensity
    concentrateG = (productG * conc) / 100
  }
  const alcoholG = Math.max(0, productG - concentrateG)
  const alcoholMl = settings.ethanolDensity > 0 ? alcoholG / settings.ethanolDensity : 0
  const costConcentrate = (costPerKg * concentrateG) / 1000
  const costAlcohol = (alcoholMl / 1000) * (settings.alcoholPricePerL || 0)
  const costTotal = costConcentrate + costAlcohol
  return {
    productMl,
    productG,
    concentrateG,
    alcoholG,
    alcoholMl,
    scale: totalGrams > 0 ? concentrateG / totalGrams : 0,
    costConcentrate,
    costAlcohol,
    costTotal,
    costPerBottle: b.mode === 'bottles' && b.bottles > 0 ? costTotal / b.bottles : null
  }
}

export function computeFormula(
  formula: Formula,
  rows: FormulaRow[],
  materials: Map<string, Material>,
  settings: Settings
): FormulaCalc {
  const conc = clampPct(formula.concentration)
  const base = rows.map((row) => {
    const material = materials.get(row.materialId)
    const grams = rowGrams(row, formula.unit, settings)
    const neatGrams = (grams * clampPct(row.dilution)) / 100
    const cost = material?.pricePerKg ? (neatGrams * material.pricePerKg) / 1000 : 0
    return { row, material, grams, neatGrams, cost }
  })
  const totalGrams = base.reduce((s, r) => s + r.grams, 0)
  const neatGrams = base.reduce((s, r) => s + r.neatGrams, 0)
  const cost = base.reduce((s, r) => s + r.cost, 0)
  const costPerKg = totalGrams > 0 ? (cost / totalGrams) * 1000 : 0
  const batch = computeBatch(formula, totalGrams, costPerKg, settings)

  const calcRows: RowCalc[] = base.map((r) => {
    const weighedPct = totalGrams > 0 ? (r.grams / totalGrams) * 100 : 0
    const neatPct = totalGrams > 0 ? (r.neatGrams / totalGrams) * 100 : 0
    return {
      ...r,
      weighedPct,
      neatPct,
      productPct: (neatPct * conc) / 100,
      batchGrams: r.grams * batch.scale
    }
  })

  const byNote: Record<NoteLevel, number> = { top: 0, heart: 0, base: 0 }
  const fam = new Map<string, number>()
  for (const r of calcRows) {
    if (!r.material) continue
    byNote[r.material.note] += r.neatGrams
    fam.set(r.material.family, (fam.get(r.material.family) ?? 0) + r.neatGrams)
  }
  const byFamily = [...fam.entries()]
    .map(([familyId, grams]) => ({ familyId, grams }))
    .filter((f) => f.grams > 0)
    .sort((a, b) => b.grams - a.grams)

  return {
    rows: calcRows,
    totalGrams,
    neatGrams,
    solventGrams: totalGrams - neatGrams,
    cost,
    costPerKg,
    byNote,
    byFamily,
    materialCount: new Set(rows.filter((r) => materials.has(r.materialId)).map((r) => r.materialId)).size,
    batch,
    ifra: computeIfra(calcRows, conc, settings)
  }
}

/** Estimated evaporation profile: remaining neat mass per note over time (log time). */
export function evolution(
  rows: RowCalc[],
  samples = 60
): { tMax: number; points: { t: number; top: number; heart: number; base: number }[] } {
  const items = rows
    .filter((r) => r.material && r.neatGrams > 0)
    .map((r) => ({
      note: r.material!.note,
      w: r.neatGrams,
      T: Math.max(0.1, r.material!.tenacityHours || DEFAULT_TENACITY[r.material!.note])
    }))
  const tMax = Math.max(24, ...items.map((i) => i.T))
  const lnMax = Math.log(1 + tMax)
  const points = []
  for (let i = 0; i <= samples; i++) {
    const t = Math.exp((i / samples) * lnMax) - 1
    const p = { t, top: 0, heart: 0, base: 0 }
    for (const it of items) {
      const rem = t >= it.T ? 0 : 1 - Math.log(1 + t) / Math.log(1 + it.T)
      p[it.note] += it.w * rem
    }
    points.push(p)
  }
  return { tMax, points }
}

export type DiffKind = 'added' | 'removed' | 'changed' | 'same'
export interface DiffRow {
  materialId: string
  a: number | null // neat % in concentrate
  b: number | null
  delta: number
  kind: DiffKind
}

export function diffVersions(a: RowCalc[], b: RowCalc[]): DiffRow[] {
  const sum = (rows: RowCalc[]) => {
    const m = new Map<string, number>()
    for (const r of rows) m.set(r.row.materialId, (m.get(r.row.materialId) ?? 0) + r.neatPct)
    return m
  }
  const ma = sum(a)
  const mb = sum(b)
  const ids = [...new Set([...ma.keys(), ...mb.keys()])]
  return ids
    .map((id) => {
      const va = ma.has(id) ? ma.get(id)! : null
      const vb = mb.has(id) ? mb.get(id)! : null
      const delta = (vb ?? 0) - (va ?? 0)
      const kind: DiffKind =
        va === null ? 'added' : vb === null ? 'removed' : Math.abs(delta) < 0.0005 ? 'same' : 'changed'
      return { materialId: id, a: va, b: vb, delta, kind }
    })
    .sort((x, y) => Math.max(y.a ?? 0, y.b ?? 0) - Math.max(x.a ?? 0, x.b ?? 0))
}

// ---------- formatting ----------

export function fmt(n: number | null | undefined, digits = 2): string {
  if (n == null || !Number.isFinite(n)) return '—'
  return n.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits })
}

/** Smart precision for small percentages / grams. */
export function fmtSmart(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return '—'
  const a = Math.abs(n)
  if (a === 0) return '0'
  if (a < 0.001) return n.toExponential(1)
  if (a < 0.1) return fmt(n, 4)
  if (a < 10) return fmt(n, 3)
  return fmt(n, 2)
}

export function parseNum(input: string): number | null {
  const s = input.trim().replace(/\s/g, '').replace(',', '.')
  if (s === '') return null
  const n = Number(s)
  return Number.isFinite(n) ? n : null
}

/** Compact number without trailing zeros (e.g. 8, 0.5, 12.25). */
export function fmtTrim(n: number | null | undefined, maxDigits = 4): string {
  if (n == null || !Number.isFinite(n)) return '—'
  return String(Number(n.toFixed(maxDigits)))
}

/** Pick dark or light ink for text drawn on a coloured background. */
export function inkOn(hex: string): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex)
  if (!m) return '#0d0f0e'
  const n = parseInt(m[1], 16)
  const lin = (c: number) => {
    const s = c / 255
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4)
  }
  const L = 0.2126 * lin((n >> 16) & 255) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255)
  return L > 0.18 ? '#0d0f0e' : '#eef3ef'
}
