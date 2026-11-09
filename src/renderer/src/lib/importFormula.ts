import type { AmountUnit, Formula, Material, NoteLevel, Settings } from '@shared/types'
import { NOTE_LABELS, PRODUCT_PRESETS } from '@shared/defaults'
import { parseCsv } from './csv'
import { parseNum } from './calc'
import { uid } from './id'

/**
 * Read a formula CSV as exported by Vialintia (Material, CAS, Family, Note, Amount (unit),
 * Dilution %, Solvent, …). Returns a new formula plus reference materials (fresh ids) that the
 * import merge then matches to the local library by name / CAS, or adds when unknown.
 */
export function csvToFormula(text: string, fileName: string, settings: Settings): { formula: Formula; refMaterials: Material[] } | null {
  const rows = parseCsv(text)
  if (rows.length < 2) return null
  const header = rows[0].map((h) => h.trim().toLowerCase())
  const col = (pred: (h: string) => boolean) => header.findIndex(pred)
  const iName = col((h) => h === 'material' || h === 'name')
  const iAmount = col((h) => h.startsWith('amount'))
  if (iName < 0 || iAmount < 0) return null
  const iCas = col((h) => h === 'cas')
  const iFam = col((h) => h === 'family')
  const iNote = col((h) => h === 'note')
  const iDil = col((h) => h.startsWith('dilution'))
  const iSolv = col((h) => h === 'solvent')
  const unitMatch = /\((g|drops|parts)\)/.exec(header[iAmount])
  const unit: AmountUnit = (unitMatch?.[1] as AmountUnit) ?? 'g'
  const famByName = new Map(settings.families.map((f) => [f.name.toLowerCase(), f.id]))
  const noteByLabel = new Map((Object.keys(NOTE_LABELS) as NoteLevel[]).map((n) => [NOTE_LABELS[n].toLowerCase(), n]))

  const name = fileName.replace(/\.[^.]+$/, '').replace(/\s+-\s+V\d+$/i, '').trim() || 'Imported formula'
  const now0 = new Date().toISOString()
  const vId = uid()
  const f: Formula = {
    id: uid(), name, description: '', tags: [], status: 'draft', unit: 'g', productType: 'edp',
    concentration: PRODUCT_PRESETS.edp.concentration, batch: { mode: 'bottles', bottles: 1, bottleMl: 50, massG: 10 },
    versions: [{ id: vId, label: 'V1', createdAt: now0, rows: [] }], currentVersionId: vId, notes: [], assemblies: [],
    createdAt: now0, updatedAt: now0
  }
  f.unit = unit
  const refs: Material[] = []
  const now = new Date().toISOString()
  for (const r of rows.slice(1)) {
    const matName = (r[iName] ?? '').trim()
    if (!matName) break // blank line before the totals block
    if (matName.toLowerCase() === 'total' || matName.toLowerCase() === 'missing material') continue
    const amount = parseNum(r[iAmount] ?? '')
    if (amount == null) continue
    const dilution = iDil >= 0 ? parseNum(r[iDil] ?? '') ?? 100 : 100
    const m: Material = {
      id: uid(),
      name: matName,
      cas: iCas >= 0 && r[iCas]?.trim() ? r[iCas].trim() : undefined,
      family: (iFam >= 0 && famByName.get((r[iFam] ?? '').trim().toLowerCase())) || 'other',
      note: (iNote >= 0 && noteByLabel.get((r[iNote] ?? '').trim().toLowerCase())) || 'heart',
      tenacityHours: null,
      defaultDilution: dilution,
      solvent: iSolv >= 0 && r[iSolv]?.trim() ? r[iSolv].trim() : undefined,
      pricePerKg: null,
      ifraLimit: null,
      type: 'other',
      createdAt: now,
      updatedAt: now
    }
    refs.push(m)
    f.versions[0].rows.push({ id: uid(), materialId: m.id, amount, dilution, solvent: m.solvent })
  }
  const conc = rows.find((r) => (r[0] ?? '').trim().toLowerCase() === 'concentration %')
  const c = conc ? parseNum(conc[1] ?? '') : null
  if (c != null) {
    f.concentration = c
    f.productType = 'custom'
  }
  return f.versions[0].rows.length ? { formula: f, refMaterials: refs } : null
}
