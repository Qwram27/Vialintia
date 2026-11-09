import { describe, expect, it } from 'vitest'
import { DEFAULT_SETTINGS } from '@shared/defaults'
import type { Formula, Material } from '@shared/types'
import { buildAccordIndex, computeFormula, diffVersions, evolution, ifraStatus, parseNum, reduceAccordRow, removeRow, roundToStep, sectionBlocks, rowIfraEntry, scaleRows } from './calc'
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
  status: 'testing',
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
  it('names AV by the year it runs into', () => {
    expect(seasonCode('2026-11-09T12:00:00')).toBe('AV27')
    expect(seasonCode('2027-01-15T12:00:00')).toBe('AV27')
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
    expect(out.find((m) => m.name === 'Galbanum oil')!.tenacityHours).toBe(72) // v1 estimate cleared, then TGSC value filled (v4)
    expect(out.find((m) => m.name === 'Clary sage oil')!.cas).toBe('user-edited')
    expect(out.find((m) => m.name === 'Hedione')!.tenacityHours).toBe(999)
    expect(upgradeSeedLibrary(out, SEED_VERSION)).toBe(out)
  })

  it('fills IFRA and tenacity into starter materials (v4) without overriding user values', () => {
    const lib: Material[] = seeds.map((m) => ({ ...m, tenacityHours: null, ifraLimit: null }))
    lib.find((m) => m.name === 'Eugenol')!.ifraLimit = 1.0 // user value
    const out = upgradeSeedLibrary(lib, 3)
    expect(out.find((m) => m.name === 'Citral')!.ifraLimit).toBe(0.6)
    expect(out.find((m) => m.name === 'Coumarin')!.ifraLimit).toBe(1.5)
    expect(out.find((m) => m.name === 'Eugenol')!.ifraLimit).toBe(1.0)
    expect(out.find((m) => m.name === 'Hedione')!.tenacityHours).toBe(72)
    expect(out.find((m) => m.name === 'Calone')!.tenacityHours).toBeNull()
  })

  it('adds the v5 mints to a v4 library once', () => {
    const v4 = seeds.filter((m) => !/mint|menth|carvone/i.test(m.name) || m.name === 'Peppermint oil')
    const out = upgradeSeedLibrary(v4, 4)
    expect(out.length).toBe(seeds.length)
    expect(out.find((m) => m.name === 'l-Carvone')!.ifraLimit).toBe(0.59)
    expect(upgradeSeedLibrary(out, 5)).toBe(out)
  })

  it('moves starter materials from DPG to ethanol (v3) but leaves user materials alone', () => {
    const lib = seeds.map((m) => ({ ...m, solvent: m.defaultDilution < 100 ? 'DPG' : undefined }))
    lib.push({ ...lib[0], id: 'mine', name: 'My own base', solvent: 'DPG' })
    const out = upgradeSeedLibrary(lib, 2)
    expect(out.length).toBe(lib.length)
    expect(out.filter((m) => m.name !== 'My own base' && m.solvent === 'DPG')).toHaveLength(0)
    expect(out.find((m) => m.name === 'My own base')!.solvent).toBe('DPG')
    expect(seeds.every((m) => m.defaultDilution === 100 || m.solvent === 'EtOH')).toBe(true)
  })
})

describe('accords', () => {
  // Accord formula: 1 g citral (IFRA 0.6 %) + 3 g Iso E (no limit), the citral row diluted to 10 %
  const citral = mat('citral', { ifraLimit: 0.6, pricePerKg: 100 })
  const iso = mat('iso', { pricePerKg: 40 })
  const accF = formula({
    id: 'acc',
    versions: [{ id: 'av', label: 'V1', createdAt: now, rows: [
      { id: 'a1', materialId: 'citral', amount: 1, dilution: 10 },
      { id: 'a2', materialId: 'iso', amount: 3, dilution: 100 }
    ] }],
    currentVersionId: 'av'
  })
  const accM = mat('accM', { accordFormulaId: 'acc', type: 'base' })
  const all = [citral, iso, accM]

  it('expands an accord into neat constituents and prices it from them', () => {
    const idx = buildAccordIndex(all, [accF], settings)
    const info = idx.get('accM')!
    const frac = new Map(info.parts.map((p) => [p.material.id, p.fraction]))
    expect(frac.get('citral')).toBeCloseTo(0.1 / 4) // 0.1 g neat citral in 4 g
    expect(frac.get('iso')).toBeCloseTo(3 / 4)
    expect(info.costPerKg).toBeCloseTo((0.1 / 4) * 100 + (3 / 4) * 40)
  })

  it('counts accord constituents toward IFRA limits, together with direct use', () => {
    const idx = buildAccordIndex(all, [accF], settings)
    // main formula: 10 g accord + 0.1 g citral neat, concentration 20 %
    const f = formula({ concentration: 20 })
    const rows = [
      { id: 'r1', materialId: 'accM', amount: 10, dilution: 100 },
      { id: 'r2', materialId: 'citral', amount: 0.1, dilution: 100 }
    ]
    const c = computeFormula(f, rows, new Map(all.map((m) => [m.id, m])), settings, idx)
    const e = c.ifra.byMaterial.get('citral')!
    // citral neat in concentrate: (10 * 0.025 + 0.1) / 10.1 * 100 %
    expect(e.neatPct).toBeCloseTo(((10 * 0.025 + 0.1) / 10.1) * 100)
    expect(e.productPct).toBeCloseTo((e.neatPct * 20) / 100)
    expect(rowIfraEntry(c.ifra, accM, idx)).toBe(e)
  })

  it('survives accords that reference each other', () => {
    const a = mat('A', { accordFormulaId: 'fa' })
    const b = mat('B', { accordFormulaId: 'fb' })
    const fa = formula({ id: 'fa', versions: [{ id: 'va', label: 'V1', createdAt: now, rows: [{ id: 'x', materialId: 'B', amount: 1, dilution: 100 }] }], currentVersionId: 'va' })
    const fb = formula({ id: 'fb', versions: [{ id: 'vb', label: 'V1', createdAt: now, rows: [{ id: 'y', materialId: 'A', amount: 1, dilution: 100 }] }], currentVersionId: 'vb' })
    expect(() => buildAccordIndex([a, b], [fa, fb], settings)).not.toThrow()
  })
})

describe('scaling', () => {
  it('rounds to the balance step', () => {
    expect(roundToStep(1.23456, 0.01)).toBe(1.23)
    expect(roundToStep(1.23456, 0.001)).toBe(1.235)
    expect(roundToStep(0.06, 0.1)).toBe(0.1)
  })
  it('scales rows to a target concentrate mass and converts drops to grams', () => {
    const s = { ...settings, dropMassG: 0.02, balanceStep: 0.01 }
    const rows = [
      { id: '1', materialId: 'a', amount: 10, dilution: 100 }, // 10 drops = 0.2 g
      { id: '2', materialId: 'b', amount: 30, dilution: 100 } // 0.6 g
    ]
    const out = scaleRows(rows, 'drops', s, 20)
    expect(out.map((r) => r.amount)).toEqual([5, 15])
  })
})

// ---------------------------------------------------------------- import merge
import { mergeImport } from './merge'

describe('import merge', () => {
  const v = (rows: { id: string; materialId: string; amount: number; dilution: number }[]) => [{ id: 'v1', label: 'V1', createdAt: now, rows }]
  const local = {
    materials: [mat('L-hed', { name: 'Hedione' }), mat('L-iso', { name: 'Iso E Super', cas: '54464-57-2' })],
    formulas: [formula({ id: 'keep', name: 'Mine', versions: v([{ id: 'r', materialId: 'L-hed', amount: 1, dilution: 100 }]), currentVersionId: 'v1' })]
  }

  it('adds imported formulas without deleting local ones and maps materials by name', () => {
    const pcFormula = formula({ id: 'pc', name: 'From PC', versions: v([{ id: 'a', materialId: 'PC-hed', amount: 2, dilution: 100 }, { id: 'b', materialId: 'PC-new', amount: 1, dilution: 100 }]), currentVersionId: 'v1' })
    const out = mergeImport(local, { formulas: [pcFormula], refMaterials: [mat('PC-hed', { name: 'hedione ' }), mat('PC-new', { name: 'Something new' })] })
    expect(out.formulas.map((f) => f.id)).toEqual(['keep', 'pc'])
    const rows = out.formulas[1].versions[0].rows
    expect(rows[0].materialId).toBe('L-hed') // matched by name
    expect(out.materials.some((m) => m.id === 'PC-new')).toBe(true) // unknown material added
    expect(out.stats.missing).toBe(0)
    expect(out.materials.find((m) => m.id === 'L-hed')!.aliasIds).toContain('PC-hed')
  })

  it('repairs rows of already-imported formulas when the materials file arrives later', () => {
    const broken = formula({ id: 'old', versions: v([{ id: 'x', materialId: 'PC-iso', amount: 1, dilution: 100 }]), currentVersionId: 'v1' })
    const out = mergeImport({ materials: local.materials, formulas: [broken] }, { materials: [mat('PC-iso', { name: 'Something else', cas: '54464-57-2', pricePerKg: 90 })] })
    expect(out.formulas[0].versions[0].rows[0].materialId).toBe('L-iso') // matched by CAS
    expect(out.materials.find((m) => m.id === 'L-iso')!.pricePerKg).toBe(90)
    expect(out.materials).toHaveLength(2)
  })

  it('keeps the newer copy of a formula with the same id', () => {
    const older = { ...local.formulas[0], name: 'Older', updatedAt: '2000-01-01T00:00:00Z' }
    const out = mergeImport(local, { formulas: [older] })
    expect(out.formulas[0].name).toBe('Mine')
    expect(out.stats.formulasKept).toBe(1)
  })
})

// ---------------------------------------------------------------- formula CSV import
import { csvToFormula } from './importFormula'

describe('formula CSV import', () => {
  it('reads the formula CSV format written by the app', () => {
    const csv = [
      'Material,CAS,Family,Note,Amount (g),Dilution %,Solvent,Weighed %,Neat % in concentrate,% in product,IFRA limit %,Batch (g)',
      'Hedione,24851-98-7,Floral,Heart,10,100,,83.3,83.3,14.2,,5.8',
      'Citral,5392-40-5,Citrus,Top,2,10,EtOH,16.7,1.6,0.28,0.6,1.1',
      '',
      'Total,,,,12,,,100,,,,6.97',
      'Concentration %,17'
    ].join('\n')
    const back = csvToFormula(csv, 'My scent - V1.csv', settings)!
    expect(back.formula.name).toBe('My scent')
    expect(back.formula.concentration).toBe(17)
    expect(back.formula.versions[0].rows.map((r) => [r.amount, r.dilution, r.solvent])).toEqual([[10, 100, undefined], [2, 10, 'EtOH']])
    expect(back.refMaterials.map((m) => [m.name, m.cas, m.note, m.family])).toEqual([['Hedione', '24851-98-7', 'heart', 'floral'], ['Citral', '5392-40-5', 'top', 'citrus']])
  })
})

describe('reduce accord', () => {
  // Accord: 6 g of a (neat) + 4 g of b at 10% in DPG.
  const accord = formula({
    id: 'acc',
    versions: [{ id: 'v', label: 'V1', createdAt: now, rows: [
      { id: 'r1', materialId: 'a', amount: 6, dilution: 100 },
      { id: 'r2', materialId: 'b', amount: 4, dilution: 10, solvent: 'DPG' }
    ] }]
  })
  let n = 0
  const id = () => `n${++n}`

  it('replaces the accord row with constituents in real amounts, in place', () => {
    const rows = [
      { id: 'x', materialId: 'c', amount: 1, dilution: 100 },
      { id: 'acc-row', materialId: 'ACC', amount: 5, dilution: 100 },
      { id: 'y', materialId: 'd', amount: 2, dilution: 100 }
    ]
    const out = reduceAccordRow(rows, 'acc-row', 'g', accord, settings, id)!
    expect(out.map((r) => r.materialId)).toEqual(['c', 'a', 'b', 'd'])
    expect(out[1]).toMatchObject({ amount: 3, dilution: 100 })
    expect(out[2]).toMatchObject({ amount: 2, dilution: 10, solvent: 'DPG' })
    expect(rows[0].amount).toBe(1) // input untouched
  })

  it('folds the accord dilution in and keeps neat totals', () => {
    const rows = [{ id: 'acc-row', materialId: 'ACC', amount: 10, dilution: 50, solvent: 'EtOH' }]
    const out = reduceAccordRow(rows, 'acc-row', 'g', accord, settings, id)!
    expect(out[0]).toMatchObject({ materialId: 'a', amount: 6, dilution: 50, solvent: 'EtOH' })
    expect(out[1]).toMatchObject({ materialId: 'b', amount: 4, dilution: 5, solvent: 'DPG' })
    const weighed = out.reduce((s, r) => s + r.amount, 0)
    expect(weighed).toBeCloseTo(10)
  })

  it('keeps constituents in their own block, not merged into other rows', () => {
    const rows = [
      { id: 'a-row', materialId: 'a', amount: 1, dilution: 100 },
      { id: 'acc-row', materialId: 'ACC', amount: 10, dilution: 100 }
    ]
    const out = reduceAccordRow(rows, 'acc-row', 'g', accord, settings, id)!
    expect(out).toHaveLength(3)
    expect(out[0]).toMatchObject({ id: 'a-row', amount: 1 })
    expect(out[1]).toMatchObject({ materialId: 'a', amount: 6 })
  })

  it('converts to drops in a drops formula', () => {
    const rows = [{ id: 'acc-row', materialId: 'ACC', amount: 10, dilution: 100 }]
    const out = reduceAccordRow(rows, 'acc-row', 'drops', accord, settings, id)!
    expect(out.reduce((s, r) => s + r.amount, 0)).toBeCloseTo(10)
  })
})

describe('dividers', () => {
  const accord = formula({
    id: 'acc', name: 'Citrus',
    versions: [{ id: 'v', label: 'V1', createdAt: now, rows: [
      { id: 'r1', materialId: 'a', amount: 1, dilution: 100 },
      { id: 'r2', materialId: 'b', amount: 1, dilution: 100 }
    ] }]
  })
  it('reduce wraps the constituents in a labelled block', () => {
    const rows = [
      { id: 'acc-row', materialId: 'ACC', amount: 2, dilution: 100 },
      { id: 'y', materialId: 'd', amount: 2, dilution: 100 }
    ]
    const out = reduceAccordRow(rows, 'acc-row', 'g', accord, settings, () => Math.random().toString(), 'Citrus accord')!
    expect(out.map((r) => r.section)).toEqual(['Citrus accord', undefined, ''])
    expect(sectionBlocks(out).map((b) => b.length)).toEqual([2, 1])
  })
  it('a removed row hands its divider to the next row', () => {
    const rows = [
      { id: 'x', materialId: 'a', amount: 1, dilution: 100, section: 'Top' },
      { id: 'y', materialId: 'b', amount: 1, dilution: 100 }
    ]
    expect(removeRow(rows, 'x')).toEqual([{ id: 'y', materialId: 'b', amount: 1, dilution: 100, section: 'Top' }])
  })
})
