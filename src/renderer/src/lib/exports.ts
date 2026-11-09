import type { Formula, Material, MaterialType, NoteLevel, Settings } from '@shared/types'
import { NOTE_LABELS, NOTE_ORDER, PRODUCT_PRESETS } from '@shared/defaults'
import { fmt, fmtSmart, fmtTrim, parseNum, type FormulaCalc } from './calc'
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
  const product = formula.productType === 'custom' ? 'Author' : PRODUCT_PRESETS[formula.productType].label
  const unit = formula.unit === 'drops' ? 'drops' : formula.unit === 'parts' ? 'parts' : 'g'
  const b = calc.batch
  const cur = settings.currency
  const noteTotal = calc.byNote.top + calc.byNote.heart + calc.byNote.base
  const version = formula.versions.find((v) => v.label === versionLabel)
  const date = (iso: string) => new Date(iso).toLocaleDateString('en-GB')
  const amountSum = calc.rows.reduce((s, r) => s + r.row.amount, 0)
  const over = calc.ifra.entries.filter((e) => e.status === 'over')

  const rows = calc.rows
    .map((r, i) => {
      const m = r.material
      const ifra = m ? calc.ifra.byMaterial.get(m.id) : undefined
      const flag = ifra?.status === 'over'
      const divider = r.row.section != null ? `<tr class="sec"><td colspan="11">${esc(r.row.section || '—')}</td></tr>` : ''
      return `${divider}<tr${flag ? ' class="flag"' : ''}>
        <td class="c">${i + 1}</td>
        <td class="l">${esc(m?.name ?? 'Missing material')}</td>
        <td class="l mono">${esc(m?.cas ?? '')}</td>
        <td class="c">${m ? NOTE_LABELS[m.note] : ''}</td>
        <td class="c">${r.row.dilution < 100 ? `${fmtTrim(r.row.dilution)}% ${esc(r.row.solvent ?? '')}` : '100%'}</td>
        <td>${fmtSmart(r.row.amount)}</td>
        <td>${fmt(r.weighedPct, 3)}</td>
        <td>${fmt(r.productPct, 4)}</td>
        <td>${ifra ? `${fmtSmart(ifra.limit)}${flag ? ' !' : ''}` : '–'}</td>
        <td>${fmt(r.batchGrams, 3)}</td>
        <td class="chk"></td>
      </tr>`
    })
    .join('')

  const info: [string, string][] = [
    ['Product', `${product}`],
    ['Concentration', `${fmt(formula.concentration, 1)} %`],
    ['Status', formula.status.charAt(0).toUpperCase() + formula.status.slice(1)],
    ['Amounts in', unit],
    [
      'Batch',
      formula.batch.mode === 'bottles'
        ? `${formula.batch.bottles} × ${fmtSmart(formula.batch.bottleMl)} ml (${fmt(b.productMl, 1)} ml)`
        : `${fmt(b.concentrateG, 2)} g concentrate`
    ],
    ['Concentrate to weigh', `${fmt(b.concentrateG, 2)} g`],
    ['Alcohol', `${fmt(b.alcoholG, 2)} g  /  ${fmt(b.alcoholMl, 1)} ml`],
    ['Created / updated', `${date(formula.createdAt)} / ${date(formula.updatedAt)}`]
  ]
  const infoHtml = info
    .reduce<string[]>((acc, [k, v], i) => {
      if (i % 2 === 0) acc.push('')
      acc[acc.length - 1] += `<th>${k}</th><td>${esc(v)}</td>`
      return acc
    }, [])
    .map((r) => `<tr>${r}</tr>`)
    .join('')

  const structure = NOTE_ORDER.map((n) => `${NOTE_LABELS[n]} ${noteTotal > 0 ? fmt((calc.byNote[n] / noteTotal) * 100, 1) : '–'} %`).join('   ·   ')

  return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(formula.name)}</title>
<style>
  @page { size: A4; }
  * { box-sizing: border-box; }
  body { font-family: Arial, 'Segoe UI', Helvetica, sans-serif; color: #000; font-size: 9.5pt; margin: 0; }
  .brand { display: flex; align-items: center; gap: 10px; margin-bottom: 14px; }
  .brand svg { width: 18px; height: 25px; flex: none; }
  .brand span { font-size: 10.5pt; font-weight: bold; letter-spacing: .42em; color: #000; }
  .head { display: flex; justify-content: space-between; align-items: flex-end; border-bottom: 2px solid #000; padding-bottom: 8px; margin-bottom: 12px; }
  .doc { font-size: 8pt; text-transform: uppercase; letter-spacing: .08em; color: #444; margin-bottom: 4px; }
  h1 { font-size: 20pt; margin: 0; font-weight: bold; }
  .ref { border-collapse: collapse; font-size: 8.5pt; }
  .ref td { border: 1px solid #000; padding: 3px 8px; }
  .ref td:first-child { background: #eee; font-weight: bold; }
  table.info { width: 100%; border-collapse: collapse; margin-bottom: 14px; font-size: 8.5pt; }
  .info th, .info td { border: 1px solid #999; padding: 4px 6px; text-align: left; }
  .info th { background: #f0f0f0; width: 17%; font-weight: bold; }
  h2 { font-size: 10pt; text-transform: uppercase; margin: 16px 0 6px; letter-spacing: .04em; }
  table.comp { width: 100%; border-collapse: collapse; font-size: 8.5pt; }
  .comp th { background: #e6e6e6; border: 1px solid #000; padding: 4px 5px; font-size: 7.5pt; text-transform: uppercase; text-align: right; }
  .comp th.l { text-align: left; }
  .comp th.c, .comp td.c { text-align: center; }
  .comp td { border: 1px solid #999; padding: 3px 5px; text-align: right; }
  .comp td.l { text-align: left; }
  .comp tbody tr:nth-child(even) td { background: #fafafa; }
  .comp tr.flag td { font-weight: bold; background: #ececec; }
  .comp tfoot td { border: 1px solid #000; font-weight: bold; background: #f0f0f0; }
  .chk { width: 22px; }
  .comp tr.sec td { text-align: left; font-weight: bold; font-size: 8pt; letter-spacing: .12em; text-transform: uppercase; padding-top: 8px; background: #f4f4f4; }
  .mono { font-family: Consolas, 'Courier New', monospace; font-size: 7.5pt; white-space: nowrap; }
  .comp td.c { white-space: nowrap; }
  .summary { margin-top: 10px; font-size: 8.5pt; line-height: 1.6; }
  .warn { margin-top: 8px; border: 1.5px solid #000; padding: 6px 8px; font-size: 8.5pt; }
  .notes { border: 1px solid #999; min-height: 80px; padding: 6px 8px; font-size: 8.5pt; white-space: pre-wrap; }
  .sign { display: flex; gap: 30px; margin-top: 26px; font-size: 8.5pt; }
  .sign div { flex: 1; border-top: 1px solid #000; padding-top: 4px; color: #444; }
  .foot { margin-top: 18px; font-size: 7pt; color: #666; display: flex; justify-content: space-between; }
</style></head><body>
  <div class="brand">
    <svg viewBox="132 76 256 360" xmlns="http://www.w3.org/2000/svg" fill="none" stroke-linecap="square" stroke-linejoin="miter">
      <path d="M138 88 H310 L374 152 V424 H138 Z" stroke="#000" stroke-width="18"/>
      <path d="M310 88 V152 H374" stroke="#000" stroke-width="18"/>
      <path d="M184 180 L230 300 L276 180" stroke="#000" stroke-width="28"/>
      <path d="M184 352 H328 M184 386 H294" stroke="#777" stroke-width="18"/>
    </svg>
    <span>VIALINTIA</span>
  </div>
  <div class="head">
    <div>
      <div class="doc">Formula sheet</div>
      <h1>${esc(formula.name)}</h1>
    </div>
    <table class="ref">
      ${no ? `<tr><td>Code</td><td>N° ${esc(no)}</td></tr>` : ''}
      <tr><td>Version</td><td>${esc(versionLabel)}</td></tr>
      <tr><td>Date</td><td>${new Date().toLocaleDateString('en-GB')}</td></tr>
    </table>
  </div>

  <table class="info">${infoHtml}</table>

  <h2>Composition</h2>
  <table class="comp">
    <thead><tr>
      <th class="c">No.</th><th class="l">Material</th><th class="l">CAS</th><th class="c">Note</th><th class="c">Dilution</th>
      <th>Amount (${unit})</th><th>% weighed</th><th>% in product</th><th>IFRA max %</th><th>Batch (g)</th><th class="c">✓</th>
    </tr></thead>
    <tbody>${rows}</tbody>
    <tfoot><tr>
      <td></td><td class="l">Total</td><td></td><td></td><td></td>
      <td>${fmtSmart(amountSum)}</td><td>100.000</td><td>${fmt(formula.concentration, 2)}</td><td></td><td>${fmt(b.concentrateG, 3)}</td><td></td>
    </tr></tfoot>
  </table>

  <div class="summary">
    <b>Structure:</b> ${structure}<br>
    ${calc.costPerKg > 0 ? `<b>Cost:</b> ${cur} ${fmt(calc.costPerKg, 2)} / kg concentrate${b.costPerBottle != null ? ` · ${cur} ${fmt(b.costPerBottle, 2)} per bottle` : ''} · batch ${cur} ${fmt(b.costTotal, 2)}<br>` : ''}
    <b>IFRA (Cat. 4):</b> ${
      calc.ifra.entries.length === 0
        ? 'no limits entered for the materials used'
        : over.length
          ? `${over.length} material${over.length > 1 ? 's' : ''} above the entered limit`
          : 'all materials within entered limits'
    }${calc.ifra.maxConcentration != null ? ` · max. concentration ${fmt(calc.ifra.maxConcentration, 2)} %` : ''}
  </div>
  ${over.length ? `<div class="warn"><b>! Above IFRA limit:</b> ${over.map((e) => `${esc(e.material.name)} – ${fmtSmart(e.productPct)} % in product (limit ${fmtSmart(e.limit)} %)`).join('; ')}</div>` : ''}

  <h2>Notes</h2>
  <div class="notes">${esc([formula.description, version?.comment].filter(Boolean).join('\n\n'))}</div>

  <div class="sign"><div>Prepared by</div><div>Date</div><div>Checked</div></div>
  <div class="foot"><span>Vialintia</span><span>IFRA values as entered by the user — verify against the current IFRA Standards.</span></div>
</body></html>`
}
