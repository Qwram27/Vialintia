import { describe, expect, it } from 'vitest'
import { DEFAULT_SETTINGS } from '@shared/defaults'
import type { Formula, Material } from '@shared/types'
import { computeFormula, diffVersions, evolution, ifraStatus, parseNum } from './calc'
import { SEED_VERSION, seedMaterials, upgradeSeedLibrary } from '@/data/seedMaterials'

const now = new Date().toISOString()
const mat = (id: string, extra: Partial<Material> = {}): Material => ({
  id,
  name: id,
  family: 'floral',
  note: 'heart',
  defaultDilution: 100,
  type: 'synthetic',
  createdAt: now,
  updatedAt: now,
  ...extra
})

const formula = (extra: Partial<Formula> = {}): Formula => ({
  id: 'f',
  name: 'Test',
  description: '',
  tags: [],
  status: 'draft',
  unit: 'g',
  productType: 'edp',
  concentration: 20,
  batch: { mode: 'bottles', bottles: 1, bottleMl: 50, massG: 10 },
  versions: [],
  currentVersionId: 'v',
  notes: [],
  createdAt: now,
  updatedAt: now,
  ...extra
})

const settings = { ...DEFAULT_SETTINGS, alcoholPricePerL: 0 }

describe('computeFormula', () => {
  const materials = new Map([
    ['a', mat('a', { pricePerKg: 100, note: 'top', family: 'citrus' })],
    ['b', mat('b', { pricePerKg: 1000, ifraLimit: 0.2, note: 'base', family: 'musk' })]
  ])

  it('handles dilutions and finished-product percentages', () => {
    // 9 g of A neat + 1 g of B at 10% in DPG -> 10 g concentrate
    const c = computeFormula(
      formula(),
      [
        { id: '1', materialId: 'a', amount: 9, dilution: 100 },
        { id: '2', materialId: 'b', amount: 1, dilution: 10 }
      ],
      materials,
      settings
    )
    expect(c.totalGrams).toBeCloseTo(10)
    expect(c.neatGrams).toBeCloseTo(9.1)
    expect(c.solventGrams).toBeCloseTo(0.9)
    expect(c.rows[1].weighedPct).toBeCloseTo(10)
    expect(c.rows[1].neatPct).toBeCloseTo(1)
    expect(c.rows[1].productPct).toBeCloseTo(0.2) // 1% in concentrate × 20% EdP
    expect(c.ifra.byMaterial.get('b')!.status).toBe('near') // exactly at the limit
    expect(c.ifra.maxConcentration).toBeCloseTo(20)
    // cost: A 9g*100/kg = 0.9 ; B neat 0.1g*1000/kg = 0.1
    expect(c.cost).toBeCloseTo(1.0)
    expect(c.costPerKg).toBeCloseTo(100)
    expect(c.byNote.top).toBeCloseTo(9)
    expect(c.byNote.base).toBeCloseTo(0.1)
    expect(c.byFamily[0].familyId).toBe('citrus')
  })

  it('flags IFRA breaches when concentration goes up', () => {
    const c = computeFormula(
      formula({ concentration: 25 }),
      [
        { id: '1', materialId: 'a', amount: 9, dilution: 100 },
        { id: '2', materialId: 'b', amount: 1, dilution: 10 }
      ],
      materials,
      settings
    )
    expect(c.ifra.worst).toBe('over')
    expect(c.ifra.limiting?.id).toBe('b')
  })

  it('scales to bottles', () => {
    // 2 × 50 ml at density 0.82 = 82 g product, 20% -> 16.4 g concentrate
    const c = computeFormula(
      formula({ batch: { mode: 'bottles', bottles: 2, bottleMl: 50, massG: 0 } }),
      [{ id: '1', materialId: 'a', amount: 10, dilution: 100 }],
      materials,
      settings
    )
    expect(c.batch.productG).toBeCloseTo(82)
    expect(c.batch.concentrateG).toBeCloseTo(16.4)
    expect(c.batch.alcoholG).toBeCloseTo(65.6)
    expect(c.batch.alcoholMl).toBeCloseTo(65.6 / 0.79)
    expect(c.batch.scale).toBeCloseTo(1.64)
    expect(c.rows[0].batchGrams).toBeCloseTo(16.4)
    expect(c.batch.costPerBottle).toBeCloseTo((16.4 * 100) / 1000 / 2)
  })

  it('scales to a concentrate mass', () => {
    const c = computeFormula(
      formula({ batch: { mode: 'mass', bottles: 0, bottleMl: 0, massG: 100 } }),
      [
        { id: '1', materialId: 'a', amount: 3, dilution: 100 },
        { id: '2', materialId: 'b', amount: 1, dilution: 100 }
      ],
      materials,
      settings
    )
    expect(c.rows[0].batchGrams).toBeCloseTo(75)
    expect(c.rows[1].batchGrams).toBeCloseTo(25)
    expect(c.batch.productG).toBeCloseTo(500)
  })

  it('converts drops to grams', () => {
    const c = computeFormula(
      formula({ unit: 'drops' }),
      [{ id: '1', materialId: 'a', amount: 50, dilution: 100 }],
      materials,
      settings
    )
    expect(c.totalGrams).toBeCloseTo(1)
  })

  it('ignores unknown materials gracefully', () => {
    const c = computeFormula(formula(), [{ id: '1', materialId: 'zzz', amount: 5, dilution: 100 }], materials, settings)
    expect(c.totalGrams).toBe(5)
    expect(c.materialCount).toBe(0)
  })
})

describe('helpers', () => {
  it('ifraStatus', () => {
    expect(ifraStatus(0.1, null, 0.8)).toBe('none')
    expect(ifraStatus(0.1, 1, 0.8)).toBe('ok')
    expect(ifraStatus(0.85, 1, 0.8)).toBe('near')
    expect(ifraStatus(1.2, 1, 0.8)).toBe('over')
  })

  it('parseNum accepts commas', () => {
    expect(parseNum('1,5')).toBe(1.5)
    expect(parseNum(' 2.25 ')).toBe(2.25)
    expect(parseNum('')).toBeNull()
    expect(parseNum('abc')).toBeNull()
  })

  it('diffVersions classifies changes', () => {
    const materials = new Map([['a', mat('a')], ['b', mat('b')], ['c', mat('c')]])
    const f = formula()
    const A = computeFormula(f, [
      { id: '1', materialId: 'a', amount: 5, dilution: 100 },
      { id: '2', materialId: 'b', amount: 5, dilution: 100 }
    ], materials, settings)
    const B = computeFormula(f, [
      { id: '1', materialId: 'a', amount: 5, dilution: 100 },
      { id: '3', materialId: 'c', amount: 5, dilution: 100 }
    ], materials, settings)
    const d = diffVersions(A.rows, B.rows)
    expect(d.find((x) => x.materialId === 'a')!.kind).toBe('same')
    expect(d.find((x) => x.materialId === 'b')!.kind).toBe('removed')
    expect(d.find((x) => x.materialId === 'c')!.kind).toBe('added')
  })

  it('evolution decays to zero', () => {
    const materials = new Map([['a', mat('a', { tenacityHours: 4, note: 'top' })]])
    const c = computeFormula(formula(), [{ id: '1', materialId: 'a', amount: 1, dilution: 100 }], materials, settings)
    const e = evolution(c.rows, 20)
    expect(e.points[0].top).toBeCloseTo(1)
    expect(e.points[e.points.length - 1].top).toBe(0)
  })
})

describe('archive codes', async () => {
  const { seasonCode } = await import('./archive')
  it('names AW by the year it runs into', () => {
    expect(seasonCode('2026-11-09T12:00:00')).toBe('AW27')
    expect(seasonCode('2027-01-15T12:00:00')).toBe('AW27')
    expect(seasonCode('2026-05-01T12:00:00')).toBe('SS26')
  })
})

// ---------------------------------------------------------------- starter library

describe('starter library', () => {
  const seeds = seedMaterials()

  it('has unique names and well-formed CAS numbers with valid check digits', () => {
    const names = seeds.map((m) => m.name.toLowerCase())
    expect(new Set(names).size).toBe(names.length)
    for (const m of seeds) {
      if (!m.cas) continue
      const match = /^(\d{2,7})-(\d{2})-(\d)$/.exec(m.cas)
      expect(match, `${m.name}: ${m.cas}`).not.toBeNull()
      const digits = (match![1] + match![2]).split('').reverse()
      const sum = digits.reduce((s, d, i) => s + Number(d) * (i + 1), 0)
      expect(sum % 10, `${m.name}: CAS check digit ${m.cas}`).toBe(Number(match![3]))
    }
  })

  it('upgrades a v1 library without duplicating or overriding user edits', () => {
    const v1 = seeds.slice(0, 78).map((m) => ({ ...m }))
    const galb = v1.find((m) => m.name === 'Galbanum oil')!
    galb.cas = '8023-91-6' // wrong v1 value
    galb.tenacityHours = 12 // v1 estimate
    const clary = v1.find((m) => m.name === 'Clary sage oil')!
    clary.cas = 'user-edited'
    const hedione = v1.find((m) => m.name === 'Hedione')!
    hedione.tenacityHours = 999 // user value
    const out = upgradeSeedLibrary(v1, 1)
    expect(out.length).toBe(seeds.length)
    expect(out.find((m) => m.name === 'Galbanum oil')!.cas).toBe('8023-91-4')
    expect(out.find((m) => m.name === 'Galbanum oil')!.tenacityHours).toBeNull()
    expect(out.find((m) => m.name === 'Clary sage oil')!.cas).toBe('user-edited')
    expect(out.find((m) => m.name === 'Hedione')!.tenacityHours).toBe(999)
    expect(upgradeSeedLibrary(out, SEED_VERSION)).toBe(out)
  })
})
