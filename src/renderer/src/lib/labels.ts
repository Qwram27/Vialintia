/**
 * Bottle labels: a plain black-on-white technical label, many per A4 sheet.
 * Sizes are real millimetres — the PDF page is 210 mm wide with 12.7 mm margins
 * (same as the formula sheet), so a sheet's usable area is 184.6 × 271.6 mm.
 */
import type { Formula } from '@shared/types'
import { PRODUCT_PRESETS } from '@shared/defaults'
import { seasonCode } from './archive'

export interface LabelSize {
  id: string
  name: string
  w: number // mm
  h: number // mm
}

export const LABEL_SIZES: LabelSize[] = [
  { id: 'front', name: 'Front 40 × 22 mm', w: 40, h: 22 },
  { id: 'wrap', name: 'Wrap 60 × 22 mm', w: 60, h: 22 },
  { id: 'small', name: 'Small 30 × 15 mm', w: 30, h: 15 }
]

export interface LabelOptions {
  w: number
  h: number
  volume: string // "10 ml"
  date: string // ISO date (yyyy-mm-dd) or '' to leave out
  showNotes: boolean
  skip: number // labels already used on the first sheet (start further down)
}

export interface LabelEntry {
  formulaId: string
  copies: number
}

/** What one label prints (resolved from a formula). */
export interface LabelData {
  name: string
  product: string // "Extrait 25%"
  productShort: string // "EDT 10%" — for narrow labels
  code: string // "AV27 · V2"
  notes: string // "Kiwi · Lime · White Musk"
}

export const SHEET_W = 184.6
export const SHEET_H = 270 // a hair under 271.6 so rounding never spills onto a new page
const GAP = 2 // mm between labels (cut lines run through the gap)

export function labelData(f: Formula): LabelData {
  const v = f.versions.find((x) => x.id === f.currentVersionId) ?? f.versions[f.versions.length - 1]
  const type = f.productType === 'custom' ? '' : PRODUCT_PRESETS[f.productType]?.label ?? ''
  const conc = `${Number(f.concentration.toFixed(2))}%`
  const p = f.pyramid
  const notes = p ? [...p.top.slice(0, 1), ...p.heart.slice(0, 1), ...p.base.slice(0, 1)].join(' · ') : ''
  const short = { edt: 'EDT', edp: 'EDP', edc: 'EDC', parfum: 'Extrait' }[f.productType as string] ?? ''
  return { name: f.name, product: type ? `${type} ${conc}` : conc, productShort: short ? `${short} ${conc}` : conc, code: `${seasonCode(f.createdAt)} · ${v?.label ?? ''}`, notes }
}

export function perSheet(w: number, h: number): { cols: number; rows: number; count: number } {
  const cols = Math.max(1, Math.floor((SHEET_W + GAP) / (w + GAP)))
  const rows = Math.max(1, Math.floor((SHEET_H + GAP) / (h + GAP)))
  return { cols, rows, count: cols * rows }
}

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!)

const MARK = `<svg viewBox="132 76 256 360" xmlns="http://www.w3.org/2000/svg" fill="none" stroke-linecap="square" stroke-linejoin="miter"><path d="M138 88 H310 L374 152 V424 H138 Z" stroke="#000" stroke-width="22"/><path d="M310 88 V152 H374" stroke="#000" stroke-width="22"/><path d="M184 180 L230 300 L276 180" stroke="#000" stroke-width="32"/><path d="M184 352 H328 M184 386 H294" stroke="#777" stroke-width="22"/></svg>`

function fmtDate(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso)
  return m ? `${m[3]}.${m[2]}.${m[1].slice(2)}` : ''
}

function labelHtml(d: LabelData, o: LabelOptions): string {
  // type scale follows the label height, so the small size stays legible and the big one airy
  const k = Math.max(0.68, Math.min(1.15, o.h / 22))
  const roomy = o.w >= 50
  const notes = o.showNotes && d.notes && roomy ? `<div class="nt">${esc(d.notes)}</div>` : ''
  const date = fmtDate(o.date)
  return `<div class="lb" style="--k:${k}">
  <div class="top"><span class="br">${MARK}<b>VIALINTIA</b></span><span>${esc(d.code)}</span></div>
  <div class="nm">${esc(d.name)}</div>
  ${notes}
  <div class="bt"><span>${esc(roomy ? d.product : d.productShort)}</span>${date ? `<span>${date}</span>` : ''}<span>${esc(o.volume)}</span></div>
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
  .lb { position: relative; width: ${o.w}mm; height: ${o.h}mm; padding: calc(1.6mm * var(--k)) calc(2.2mm * var(--k)); display: flex; flex-direction: column; justify-content: space-between; overflow: hidden; border: 0.15mm solid #c8c8c8; }
  .lb.blank { border: 0.15mm dashed #e4e4e4; }
  .top, .bt { display: flex; justify-content: space-between; align-items: center; gap: 1.5mm; font-size: calc(4.6pt * var(--k)); letter-spacing: .14em; text-transform: uppercase; white-space: nowrap; }
  .br { display: inline-flex; align-items: center; gap: calc(1mm * var(--k)); }
  .br svg { width: calc(1.9mm * var(--k)); height: calc(2.7mm * var(--k)); }
  .br b { font-weight: 700; letter-spacing: .32em; }
  .top > span:last-child { color: #555; }
  .nm { font-size: calc(8.4pt * var(--k)); font-weight: 700; letter-spacing: .12em; text-transform: uppercase; line-height: 1.2; overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; padding-top: calc(0.5mm * var(--k)); padding-bottom: calc(0.8mm * var(--k)); border-bottom: 0.2mm solid #000; }
  .nt { font-size: calc(4.8pt * var(--k)); letter-spacing: .06em; color: #333; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-top: calc(-0.6mm * var(--k)); }
  .bt { font-size: calc(5pt * var(--k)); }
  .bt > span:nth-child(2):not(:last-child) { color: #555; }
</style></head><body>${sheets.join('')}</body></html>`
}
