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

// ---------------------------------------------------------------- accords
/** One neat material inside an accord, as a fraction of the accord as weighed (0..1). */
export interface AccordPart {
  material: Material
  fraction: number
}
export interface AccordInfo {
  formulaId: string
  parts: AccordPart[] // fully expanded (nested accords resolved)
  costPerKg: number // per kg of accord as weighed, from component prices
  missing: boolean // linked formula not found
}
export type AccordIndex = Map<string, AccordInfo>

/**
 * Resolve every accord material (material.accordFormulaId) into its neat constituents, using the
 * linked formula's current version. Nested accords are expanded; cycles are cut off.
 */
export function buildAccordIndex(materials: Material[], formulas: Formula[], settings: Settings): AccordIndex {
  const byId = new Map(materials.map((m) => [m.id, m]))
  const fById = new Map(formulas.map((f) => [f.id, f]))
  const index: AccordIndex = new Map()
  const resolve = (m: Material, stack: Set<string>): AccordInfo => {
    const done = index.get(m.id)
    if (done) return done
    const f = m.accordFormulaId ? fById.get(m.accordFormulaId) : undefined
    const v = f && (f.versions.find((x) => x.id === f.currentVersionId) ?? f.versions[f.versions.length - 1])
    if (!f || !v) return { formulaId: m.accordFormulaId ?? '', parts: [], costPerKg: 0, missing: true }
    stack.add(m.id)
    const grams = v.rows.map((r) => rowGrams(r, f.unit, settings))
    const total = grams.reduce((a, b) => a + b, 0)
    const parts = new Map<string, AccordPart>()
    let cost = 0
    v.rows.forEach((r, i) => {
      const sub = byId.get(r.materialId)
      if (!sub || total <= 0) return
      const frac = ((grams[i] * clampPct(r.dilution)) / 100) / total // neat share of this row
      if (sub.accordFormulaId && !stack.has(sub.id)) {
        const inner = resolve(sub, stack)
        for (const p of inner.parts) {
          const cur = parts.get(p.material.id)
          if (cur) cur.fraction += frac * p.fraction
          else parts.set(p.material.id, { material: p.material, fraction: frac * p.fraction })
        }
        cost += frac * (sub.pricePerKg ?? inner.costPerKg)
      } else if (!sub.accordFormulaId) {
        const cur = parts.get(sub.id)
        if (cur) cur.fraction += frac
        else parts.set(sub.id, { material: sub, fraction: frac })
        cost += frac * (sub.pricePerKg ?? 0)
      }
    })
    stack.delete(m.id)
    const info: AccordInfo = { formulaId: f.id, parts: [...parts.values()], costPerKg: cost, missing: false }
    index.set(m.id, info)
    return info
  }
  for (const m of materials) if (m.accordFormulaId) resolve(m, new Set())
  return index
}

// ---------------------------------------------------------------- scaling
/** Round to the balance resolution (e.g. 0.01 g), avoiding float noise. */
export function roundToStep(v: number, step: number): number {
  if (!(step > 0) || !Number.isFinite(v)) return v
  const decimals = Math.max(0, Math.ceil(-Math.log10(step) - 1e-9))
  return Number((Math.round(v / step) * step).toFixed(decimals))
}

/**
 * Rescale a version's rows so the concentrate weighs `targetG` grams. Amounts are converted to
 * grams (the result is always in g) and rounded to the balance step.
 */
export function scaleRows(rows: FormulaRow[], unit: Formula['unit'], settings: Settings, targetG: number): FormulaRow[] {
  const grams = rows.map((r) => rowGrams(r, unit, settings))
  const total = grams.reduce((a, b) => a + b, 0)
  if (!(total > 0) || !(targetG > 0)) return rows
  const k = targetG / total
  return rows.map((r, i) => ({ ...r, amount: roundToStep(grams[i] * k, settings.balanceStep || 0.01) }))
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
  settings: Settings,
  accords?: AccordIndex
): IfraResult {
  const agg = new Map<string, { material: Material; neatPct: number }>()
  const add = (material: Material, neatPct: number) => {
    const cur = agg.get(material.id)
    if (cur) cur.neatPct += neatPct
    else agg.set(material.id, { material, neatPct })
  }
  for (const r of rows) {
    if (!r.material) continue
    const acc = r.material.accordFormulaId ? accords?.get(r.material.id) : undefined
    // An accord counts through its constituents (plus its own limit, if one was entered).
    if (acc) for (const p of acc.parts) add(p.material, r.neatPct * p.fraction)
    if (!acc || r.material.ifraLimit != null) add(r.material, r.neatPct)
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

/** IFRA entry to show on a row: the material's own, or for an accord the most critical of its constituents. */
export function rowIfraEntry(ifra: IfraResult, material: Material | undefined, accords?: AccordIndex): IfraEntry | undefined {
  if (!material) return undefined
  const own = ifra.byMaterial.get(material.id)
  const acc = material.accordFormulaId ? accords?.get(material.id) : undefined
  if (!acc) return own
  let worst = own
  for (const p of acc.parts) {
    const e = ifra.byMaterial.get(p.material.id)
    if (e && (!worst || e.ratio > worst.ratio)) worst = e
  }
  return worst
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
  settings: Settings,
  accords?: AccordIndex
): FormulaCalc {
  const conc = clampPct(formula.concentration)
  const base = rows.map((row) => {
    const material = materials.get(row.materialId)
    const grams = rowGrams(row, formula.unit, settings)
    const neatGrams = (grams * clampPct(row.dilution)) / 100
    const price = material?.pricePerKg ?? (material?.accordFormulaId ? accords?.get(material.id)?.costPerKg : undefined)
    const cost = price ? (neatGrams * price) / 1000 : 0
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
    ifra: computeIfra(calcRows, conc, settings, accords)
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

// ---------------------------------------------------------------- accord reduction
/**
 * Replace an accord row with the accord formula's own rows (one level; nested accords stay as
 * accord rows and can be reduced again). Amounts are real: each constituent gets its share of the
 * weighed accord mass, and the accord row's dilution is folded into each constituent's dilution,
 * so total weighed mass and every neat amount stay exactly the same. The constituents stay in their
 * own block (not merged into rows elsewhere in the formula).
 * The new block gets a divider labelled with the accord (the row's own divider label wins), and
 * the row after the block gets a plain divider so the block stays separate.
 */
export function reduceAccordRow(
  rows: FormulaRow[],
  rowId: string,
  unit: Formula['unit'],
  accord: Formula,
  settings: Settings,
  newId: () => string,
  label = accord.name
): FormulaRow[] | null {
  const idx = rows.findIndex((r) => r.id === rowId)
  const row = rows[idx]
  const v = accord.versions.find((x) => x.id === accord.currentVersionId) ?? accord.versions[accord.versions.length - 1]
  if (!row || !v?.rows.length) return null
  const grams = v.rows.map((r) => rowGrams(r, accord.unit, settings))
  const total = grams.reduce((a, b) => a + b, 0)
  if (!(total > 0)) return null
  const weighedG = rowGrams(row, unit, settings)
  const accordDil = clampPct(row.dilution) / 100
  const toUnit = (g: number) => (unit === 'drops' && settings.dropMassG > 0 ? g / settings.dropMassG : g)
  const round = (x: number) => Number(x.toFixed(4))
  const key = (r: FormulaRow) => `${r.materialId}|${round(r.dilution)}|${r.dilution < 100 ? r.solvent ?? '' : ''}`

  const rest = rows.filter((r) => r.id !== rowId).map((r) => ({ ...r }))
  const touched = new Set<FormulaRow>()
  const inserted: FormulaRow[] = []
  v.rows.forEach((r, i) => {
    if (!(grams[i] > 0)) return
    const dilution = round(clampPct(r.dilution) * accordDil)
    const next: FormulaRow = {
      id: newId(),
      materialId: r.materialId,
      amount: toUnit(weighedG * (grams[i] / total)),
      dilution: dilution > 0 ? dilution : 100,
      solvent: dilution < 100 ? (r.dilution < 100 ? r.solvent : undefined) ?? row.solvent ?? 'EtOH' : undefined
    }
    const same = inserted.find((x) => key(x) === key(next))
    const target = same ?? next
    if (same) same.amount += next.amount
    else inserted.push(next)
    touched.add(target)
  })
  touched.forEach((r) => (r.amount = round(r.amount)))
  if (inserted.length) {
    inserted[0].section = row.section?.trim() ? row.section : label
    const after = rest[idx]
    if (after && after.section == null) after.section = ''
  } else if (row.section != null && rest[idx] && rest[idx].section == null) {
    rest[idx].section = row.section
  }
  return [...rest.slice(0, idx), ...inserted, ...rest.slice(idx)]
}

// ---------------------------------------------------------------- dividers
/** Remove a row; its divider moves to the next row (unless that one already starts a section). */
export function removeRow(rows: FormulaRow[], rowId: string): FormulaRow[] {
  const i = rows.findIndex((r) => r.id === rowId)
  if (i < 0) return rows
  const gone = rows[i]
  const next = rows.filter((r) => r.id !== rowId)
  if (gone.section != null && next[i] && next[i].section == null) next[i] = { ...next[i], section: gone.section }
  return next
}

/** Split rows into blocks at dividers (the first block may have no divider). */
export function sectionBlocks<T extends { section?: string }>(rows: T[]): T[][] {
  const out: T[][] = []
  rows.forEach((r, i) => {
    if (i === 0 || r.section != null) out.push([r])
    else out[out.length - 1].push(r)
  })
  return out
}

/** Where a dragged row lands: above / below a row, or first in the section that starts at a row. */
export type RowDrop = { rowId: string; where: 'above' | 'below' } | { sectionOf: string }

type Item = { h: string } | { r: FormulaRow }

/**
 * Move a row while dividers stay where they are: the row leaves its section and joins the one it
 * is dropped into. A divider left with no rows disappears.
 */
export function moveRow(rows: FormulaRow[], rowId: string, to: RowDrop): FormulaRow[] {
  const items: Item[] = []
  for (const r of rows) {
    if (r.section != null) items.push({ h: r.section })
    items.push({ r: { ...r, section: undefined } })
  }
  const isRow = (it: Item | undefined, id?: string): it is { r: FormulaRow } => !!it && 'r' in it && (id == null || it.r.id === id)
  const from = items.findIndex((it) => isRow(it, rowId))
  if (from < 0) return rows
  const targetId = 'sectionOf' in to ? to.sectionOf : to.rowId
  if (targetId === rowId) return rows
  const [moved] = items.splice(from, 1)
  const t = items.findIndex((it) => isRow(it, targetId))
  if (t < 0) return rows
  items.splice('sectionOf' in to || to.where === 'above' ? t : t + 1, 0, moved)
  const out: FormulaRow[] = []
  let pending: string | undefined
  for (const it of items) {
    if ('h' in it) pending = it.h
    else {
      out.push(pending != null ? { ...it.r, section: pending } : it.r)
      pending = undefined
    }
  }
  return out
}

/** Phone up / down: one step, crossing a divider into the neighbouring section. */
export function stepRow(rows: FormulaRow[], rowId: string, dir: -1 | 1): FormulaRow[] {
  const i = rows.findIndex((r) => r.id === rowId)
  const row = rows[i]
  const other = rows[i + dir]
  if (!row || !other) return rows
  if (dir === -1) return moveRow(rows, rowId, { rowId: other.id, where: row.section != null ? 'below' : 'above' })
  return moveRow(rows, rowId, other.section != null ? { sectionOf: other.id } : { rowId: other.id, where: 'below' })
}
