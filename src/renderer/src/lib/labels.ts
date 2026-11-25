/**
 * Bottle labels: a plain black-on-white technical label, many per A4 sheet.
 * Sizes are real millimetres — the PDF page is 210 mm wide with 12.7 mm margins
 * (same as the formula sheet), so a sheet's usable area is 184.6 × 271.6 mm.
 */
import type { Formula, Material } from '@shared/types'
import { PRODUCT_PRESETS } from '@shared/defaults'
import { seasonCode } from './archive'

export interface LabelSize {
  id: string
  name: string
  w: number // mm
  h: number // mm
}

export const LABEL_SIZES: LabelSize[] = [
  { id: 'large', name: 'Large 50 × 20 mm', w: 50, h: 20 },
  { id: 'front', name: 'Front 40 × 17 mm', w: 40, h: 17 },
  { id: 'medium', name: 'Medium 35 × 15 mm', w: 35, h: 15 },
  { id: 'small', name: 'Small 30 × 13 mm', w: 30, h: 13 },
  { id: 'mini', name: 'Mini 25 × 11 mm', w: 25, h: 11 }
]

export interface LabelOptions {
  w: number
  h: number
  volume: string // "10 ml"
  author: string // fragrance labels: the perfume house / author shown top left ('' = none)
  skip: number // labels already used on the first sheet (start further down)
}

/** Fragrance labels carry the author (perfume house); material labels the lab (Vialintia). */
export type LabelKind = 'fragrance' | 'material'
export const DEFAULT_AUTHOR = ''

export interface LabelEntry {
  id: string // formula id or material id
  copies: number
  dilution?: number // materials: % of the material in the bottle (100 = neat)
  solvent?: string
}

/** What one label prints. */
export interface LabelData {
  kind: LabelKind
  name: string
  code: string // top right: "AV27 · V2" / "Heart"
  info: string // bottom left: "Extrait 25%" / "10% EtOH" / "100%"
  infoShort: string // the same for narrow labels: "EDT 10%"
  sub: string // under the name's hairline: "CAS 24851-98-7" (materials)
}

export const SHEET_W = 184.6
export const SHEET_H = 270 // a hair under 271.6 so rounding never spills onto a new page
const GAP = 2 // mm between labels (cut lines run through the gap)

export function labelData(f: Formula): LabelData {
  const v = f.versions.find((x) => x.id === f.currentVersionId) ?? f.versions[f.versions.length - 1]
  const type = f.productType === 'custom' ? '' : PRODUCT_PRESETS[f.productType]?.label ?? ''
  const conc = `${Number(f.concentration.toFixed(2))}%`
  const short = { edt: 'EDT', edp: 'EDP', edc: 'EDC', parfum: 'Extrait' }[f.productType as string] ?? ''
  return { kind: 'fragrance', name: f.name, code: `${seasonCode(f.createdAt)} · ${v?.label ?? ''}`, info: type ? `${type} ${conc}` : conc, infoShort: short ? `${short} ${conc}` : conc, sub: '' }
}

export function materialLabelData(m: Material, dilution = m.defaultDilution ?? 100, solvent = m.solvent): LabelData {
  const dil = dilution < 100 ? `${Number(dilution.toFixed(2))}% ${solvent || 'EtOH'}` : '100%'
  return { kind: 'material', name: m.name, code: `CAS ${m.cas?.trim() || '—'}`, info: dil, infoShort: dil, sub: '' }
}

export function perSheet(w: number, h: number): { cols: number; rows: number; count: number } {
  const cols = Math.max(1, Math.floor((SHEET_W + GAP) / (w + GAP)))
  const rows = Math.max(1, Math.floor((SHEET_H + GAP) / (h + GAP)))
  return { cols, rows, count: cols * rows }
}

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!)

const MARK = `<svg viewBox="132 76 256 360" xmlns="http://www.w3.org/2000/svg" fill="none" stroke-linecap="square" stroke-linejoin="miter"><path d="M138 88 H310 L374 152 V424 H138 Z" stroke="#000" stroke-width="22"/><path d="M310 88 V152 H374" stroke="#000" stroke-width="22"/><path d="M184 180 L230 300 L276 180" stroke="#000" stroke-width="32"/><path d="M184 352 H328 M184 386 H294" stroke="#777" stroke-width="22"/></svg>`

function labelHtml(d: LabelData, o: LabelOptions): string {
  // type scale follows the label: height for the air, width so narrow labels still fit their lines
  const k = Math.max(0.55, Math.min(1.2, Math.min(o.h / 17, o.w / 42)))
  const roomy = o.w >= 45
  const brand =
    d.kind === 'fragrance'
      ? `<span class="br house">${esc(o.author)}</span>`
      : `<span class="br">${o.w >= 30 ? MARK : ''}<b>VIALINTIA</b></span>`
  return `<div class="lb" style="--k:${k}">
  <div class="top">${brand}${d.code ? `<span class="cd">${esc(o.w < 35 ? d.code.replace(/^CAS /, '') : d.code)}</span>` : ''}</div>
  <div class="mid">
    <div class="nm${d.kind === 'material' ? ' mat' : ''}">${esc(d.name)}</div>
    ${d.sub ? `<div class="sub">${esc(d.sub)}</div>` : ''}
  </div>
  <div class="bt"><span${d.kind === 'material' ? ' class="keep"' : ''}>${esc(roomy ? d.info : d.infoShort)}</span><span>${esc(o.volume)}</span></div>
</div>`
}

/** Full HTML document: as many A4 sheets as needed, cut lines between labels. */
export function labelsToPdfHtml(items: LabelData[], o: LabelOptions): string {
  const { cols, count } = perSheet(o.w, o.h)
  const cells: string[] = []
  for (let i = 0; i < Math.max(0, Math.min(o.skip, count - 1)); i++) cells.push('<div class="lb blank"></div>')
  for (const d of items) cells.push(labelHtml(d, o))
  const sheets: string[] = []
  for (let i = 0; i < cells.length; i += count) sheets.push(`<div class="sheet">${cells.slice(i, i + count).join('')}</div>`)
  return `<!doctype html><html><head><meta charset="utf-8"><title>Labels</title>
<style>
  @page { size: A4; }
  * { box-sizing: border-box; }
  body { margin: 0; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #000; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .sheet { width: ${SHEET_W}mm; height: ${SHEET_H}mm; margin-bottom: ${297 - SHEET_H}mm; display: grid; grid-template-columns: repeat(${cols}, ${o.w}mm); grid-auto-rows: ${o.h}mm; gap: ${GAP}mm; align-content: start; }
  .sheet:last-child { margin-bottom: 0; }
  @media print { .sheet { margin-bottom: 0; break-after: page; } .sheet:last-child { break-after: auto; } }
  .lb { position: relative; width: ${o.w}mm; height: ${o.h}mm; padding: calc(1.4mm * var(--k)) calc(2.2mm * var(--k)); display: flex; flex-direction: column; justify-content: space-between; overflow: hidden; border: 0.15mm solid #c8c8c8; }
  .lb.blank { border: 0.15mm dashed #e4e4e4; }
  .top, .bt { display: flex; justify-content: space-between; align-items: baseline; gap: 1.2mm; text-transform: uppercase; white-space: nowrap; }
  .top { font-size: calc(4.5pt * var(--k)); letter-spacing: .14em; align-items: center; line-height: 1.25; }
  .bt { font-size: calc(5.2pt * var(--k)); letter-spacing: .12em; }
  .br { display: inline-flex; align-items: center; gap: calc(0.9mm * var(--k)); min-width: 0; }
  .br svg { width: calc(1.8mm * var(--k)); height: calc(2.6mm * var(--k)); flex: none; }
  .br b, .house { font-weight: 700; letter-spacing: .3em; }
  .cd { color: #555; flex: none; }
  .mid { display: flex; flex-direction: column; gap: calc(0.5mm * var(--k)); min-width: 0; }
  .nm { font-size: calc(8.6pt * var(--k)); font-weight: 700; letter-spacing: .1em; text-transform: uppercase; line-height: 1.18; overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; padding-top: calc(0.4mm * var(--k)); padding-bottom: calc(0.9mm * var(--k)); border-bottom: 0.2mm solid #000; }
  .nm.mat { text-transform: none; letter-spacing: .02em; }
  .sub { font-size: calc(4.8pt * var(--k)); letter-spacing: .12em; color: #333; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .bt .keep { text-transform: none; letter-spacing: .06em; }
</style></head><body>${sheets.join('')}</body></html>`
}
