import type { Formula, Material, MaterialType, NoteLevel, Settings } from '@shared/types'
import { NOTE_LABELS, NOTE_ORDER, PRODUCT_PRESETS } from '@shared/defaults'
import { fmt, fmtSmart, parseNum, type FormulaCalc } from './calc'
import { parseCsv, toCsv } from './csv'
import { familyById } from '@/store/store'

const MATERIAL_COLS = [
  'name', 'cas', 'family', 'note', 'tenacityHours', 'defaultDilution', 'solvent',
  'pricePerKg', 'supplier', 'ifraLimit', 'type', 'description'
] as const

export function materialsToCsv(materials: Material[], settings: Settings): string {
  return toCsv([
    [...MATERIAL_COLS],
    ...materials.map((m) =>
      MATERIAL_COLS.map((c) => (c === 'family' ? familyById(settings, m.family).name : (m[c] as string | number | null | undefined)))
    )
  ])
}

export function csvToMaterials(text: string, settings: Settings): Partial<Material>[] {
  const rows = parseCsv(text)
  if (rows.length < 2) return []
  const header = rows[0].map((h) => h.trim().toLowerCase())
  const idx = (k: string) => header.indexOf(k.toLowerCase())
  const famByName = new Map(settings.families.map((f) => [f.name.toLowerCase(), f.id]))
  const famIds = new Set(settings.families.map((f) => f.id))
  const notes: NoteLevel[] = ['top', 'heart', 'base']
  const types: MaterialType[] = ['natural', 'synthetic', 'base', 'other']
  return rows.slice(1).map((r) => {
    const get = (k: string) => {
      const i = idx(k)
      return i >= 0 ? (r[i] ?? '').trim() : ''
    }
    const num = (k: string) => parseNum(get(k))
    const out: Partial<Material> = { name: get('name') }
    if (get('cas')) out.cas = get('cas')
    const fam = get('family').toLowerCase()
    if (fam) out.family = famByName.get(fam) ?? (famIds.has(fam) ? fam : 'other')
    const note = get('note').toLowerCase()
    if (notes.includes(note as NoteLevel)) out.note = note as NoteLevel
    if (idx('tenacityHours') >= 0) out.tenacityHours = num('tenacityHours')
    if (num('defaultDilution') != null) out.defaultDilution = num('defaultDilution')!
    if (get('solvent')) out.solvent = get('solvent')
    if (idx('pricePerKg') >= 0) out.pricePerKg = num('pricePerKg')
    if (get('supplier')) out.supplier = get('supplier')
    if (idx('ifraLimit') >= 0) out.ifraLimit = num('ifraLimit')
    const type = get('type').toLowerCase()
    if (types.includes(type as MaterialType)) out.type = type as MaterialType
    if (get('description')) out.description = get('description')
    return out
  })
}

export function formulaToCsv(formula: Formula, calc: FormulaCalc, settings: Settings): string {
  const unit = formula.unit === 'drops' ? 'drops' : formula.unit === 'parts' ? 'parts' : 'g'
  return toCsv([
    ['Material', 'CAS', 'Family', 'Note', `Amount (${unit})`, 'Dilution %', 'Solvent', 'Weighed %', 'Neat % in concentrate', '% in product', 'IFRA limit %', `Batch (g)`],
    ...calc.rows.map((r) => [
      r.material?.name ?? 'Missing material',
      r.material?.cas ?? '',
      r.material ? familyById(settings, r.material.family).name : '',
      r.material ? NOTE_LABELS[r.material.note] : '',
      r.row.amount,
      r.row.dilution,
      r.row.dilution < 100 ? r.row.solvent ?? '' : '',
      r.weighedPct.toFixed(4),
      r.neatPct.toFixed(4),
      r.productPct.toFixed(4),
      r.material?.ifraLimit ?? '',
      r.batchGrams.toFixed(4)
    ]),
    [],
    ['Total', '', '', '', calc.totalGrams.toFixed(4), '', '', '100', '', '', '', calc.batch.concentrateG.toFixed(4)],
    ['Concentration %', formula.concentration],
    ['Alcohol (g)', calc.batch.alcoholG.toFixed(2)],
    ['Alcohol (ml)', calc.batch.alcoholMl.toFixed(2)]
  ])
}

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!)

export function formulaToPdfHtml(formula: Formula, versionLabel: string, calc: FormulaCalc, settings: Settings, no = ''): string {
  const product = formula.productType === 'custom' ? 'Custom' : PRODUCT_PRESETS[formula.productType].label
  const unit = formula.unit === 'drops' ? 'drops' : formula.unit === 'parts' ? 'parts' : 'g'
  const noteTotal = calc.byNote.top + calc.byNote.heart + calc.byNote.base
  const rows = calc.rows
    .map((r) => {
      const fam = r.material ? familyById(settings, r.material.family) : null
      const ifra = r.material ? calc.ifra.byMaterial.get(r.material.id) : undefined
      const flag = ifra?.status === 'over' ? ' class="over"' : ''
      return `<tr${flag}>
        <td class="l"><span class="dot" style="background:${fam?.color ?? '#999'}"></span>${esc(r.material?.name ?? 'Missing material')}</td>
        <td class="l small">${r.material ? NOTE_LABELS[r.material.note] : ''}</td>
        <td>${fmtSmart(r.row.amount)}</td>
        <td>${r.row.dilution < 100 ? `${fmtSmart(r.row.dilution)}% ${esc(r.row.solvent ?? '')}` : 'neat'}</td>
        <td>${fmt(r.weighedPct, 3)}</td>
        <td>${fmt(r.productPct, 4)}</td>
        <td>${ifra ? `${fmtSmart(ifra.limit)}${ifra.status === 'over' ? ' !' : ''}` : '—'}</td>
        <td>${fmt(r.batchGrams, 3)}</td>
      </tr>`
    })
    .join('')
  const pyramid = NOTE_ORDER.map(
    (n) => `<div class="pyr"><span class="dot" style="background:${settings.noteColors[n]}"></span>${NOTE_LABELS[n]} <b>${noteTotal > 0 ? fmt((calc.byNote[n] / noteTotal) * 100, 1) : '—'}%</b></div>`
  ).join('')
  const ifraOver = calc.ifra.entries.filter((e) => e.status === 'over')
  return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(formula.name)}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: 'Cascadia Mono', Consolas, 'Courier New', monospace; color: #111; font-size: 9.5px; margin: 0; }
  h1 { font-weight: 300; font-size: 30px; margin: 0; letter-spacing: -0.04em; text-transform: uppercase; }
  .kicker { letter-spacing: .25em; text-transform: uppercase; font-size: 8.5px; color: #777; margin-bottom: 10px; }
  .meta { color: #666; text-transform: uppercase; letter-spacing: .08em; font-size: 8.5px; margin: 6px 0 16px; }
  .grid { display: flex; gap: 10px; margin-bottom: 16px; }
  .box { flex: 1; border: 1px solid #ddd; border-radius: 0; padding: 8px 10px; }
  .box .k { font-size: 7.5px; letter-spacing: .18em; text-transform: uppercase; color: #888; }
  .box .v { font-size: 14px; margin-top: 2px; }
  table { width: 100%; border-collapse: collapse; }
  th { font-size: 7.5px; letter-spacing: .16em; text-transform: uppercase; color: #888; text-align: right; padding: 6px; border-bottom: 1px solid #111; font-weight: 400; }
  td { padding: 5px 6px; text-align: right; border-bottom: 1px solid #eee; font-variant-numeric: tabular-nums; }
  .l { text-align: left; }
  .small { color: #888; }
  tr.over td { background: #f1f1f1; font-weight: 600; }
  tfoot td { font-weight: 600; border-top: 1px solid #111; border-bottom: 0; }
  .dot { display: inline-block; width: 7px; height: 7px; border-radius: 50%; margin-right: 6px; vertical-align: middle; }
  .pyr { display: inline-block; margin-right: 16px; }
  .notes { margin-top: 16px; white-space: pre-wrap; color: #333; }
  .warn { margin-top: 12px; padding: 8px 10px; border: 1px solid #111; color: #111; }
  .foot { margin-top: 22px; font-size: 7.5px; letter-spacing: .1em; text-transform: uppercase; color: #999; border-top: 1px solid #ddd; padding-top: 6px; display: flex; justify-content: space-between; }
</style></head><body>
  <div class="kicker">Vialintia — Formula sheet${no ? ` — N°${no}` : ''}</div>
  <h1>${esc(formula.name)}</h1>
  <div class="meta">${esc(versionLabel)} · ${product} ${fmt(formula.concentration, 1)}% · ${formula.status} · ${new Date().toLocaleDateString('en-GB')}${formula.tags.length ? ' · ' + formula.tags.map(esc).join(', ') : ''}</div>
  ${formula.description ? `<div class="notes" style="margin:-6px 0 14px">${esc(formula.description)}</div>` : ''}
  <div class="grid">
    <div class="box"><div class="k">Concentrate</div><div class="v">${fmt(calc.totalGrams, 3)} ${unit === 'g' ? 'g' : unit}</div></div>
    <div class="box"><div class="k">Materials</div><div class="v">${calc.materialCount}</div></div>
    <div class="box"><div class="k">Batch concentrate</div><div class="v">${fmt(calc.batch.concentrateG, 2)} g</div></div>
    <div class="box"><div class="k">Alcohol</div><div class="v">${fmt(calc.batch.alcoholG, 2)} g · ${fmt(calc.batch.alcoholMl, 1)} ml</div></div>
    <div class="box"><div class="k">Cost / kg conc.</div><div class="v">${calc.costPerKg > 0 ? settings.currency + ' ' + fmt(calc.costPerKg, 2) : '—'}</div></div>
  </div>
  <div style="margin-bottom:12px">${pyramid}</div>
  <table>
    <thead><tr><th class="l">Material</th><th class="l">Note</th><th>Amount (${unit})</th><th>Dilution</th><th>Weighed %</th><th>% in product</th><th>IFRA %</th><th>Batch g</th></tr></thead>
    <tbody>${rows}</tbody>
    <tfoot><tr><td class="l">Total</td><td></td><td>${fmtSmart(calc.rows.reduce((s, r) => s + r.row.amount, 0))}</td><td></td><td>100.000</td><td>${fmt(formula.concentration, 2)}</td><td></td><td>${fmt(calc.batch.concentrateG, 3)}</td></tr></tfoot>
  </table>
  ${ifraOver.length ? `<div class="warn"><b>IFRA:</b> ${ifraOver.map((e) => `${esc(e.material.name)} ${fmtSmart(e.productPct)}% (limit ${fmtSmart(e.limit)}%)`).join(' · ')}</div>` : ''}
  ${calc.ifra.maxConcentration != null ? `<div class="meta">Max concentration within entered IFRA limits: ${fmt(calc.ifra.maxConcentration, 2)}%</div>` : ''}
  <div class="foot"><span>Generated with Vialintia</span><span>IFRA values as entered by the user — verify against the current IFRA Standards.</span></div>
</body></html>`
}
