import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useStore } from '@/store/store'
import { toast, withProgress } from '@/store/ui'
import { isWeb } from '@/platform'
import { NumberInput } from '@/components/NumberInput'
import { IconFile, IconX } from '@/components/Icons'
import { LABEL_SIZES, SHEET_H, SHEET_W, labelData, labelsToPdfHtml, materialLabelData, perSheet, type LabelEntry, type LabelKind, type LabelOptions } from '@/lib/labels'

const PX_PER_MM = 96 / 25.4
const SHEET_PX_W = Math.ceil(SHEET_W * PX_PER_MM)
const SHEET_PX_H = Math.ceil(SHEET_H * PX_PER_MM)

/**
 * Print bottle labels, packed onto A4 sheets: fragrances (formulas, house brand) or
 * materials (lab bottles, Vialintia) — one or more of them, many copies each.
 */
export function LabelsDialog({ kind = 'fragrance', id, onClose }: { kind?: LabelKind; id: string; onClose: () => void }) {
  const formulas = useStore((s) => s.formulas)
  const materials = useStore((s) => s.materials)
  const isMat = kind === 'material'
  const startEntry = (x: string): LabelEntry => {
    const m = isMat ? materials.find((y) => y.id === x) : undefined
    return { id: x, copies: 1, dilution: m?.defaultDilution ?? 100, solvent: m?.solvent }
  }
  const [entries, setEntries] = useState<LabelEntry[]>(() => [startEntry(id)])
  const [sizeId, setSizeId] = useState('front')
  const [custom, setCustom] = useState({ w: 40, h: 22 })
  const [volume, setVolume] = useState('10 ml')
  const [skip, setSkip] = useState(0)

  const size = sizeId === 'custom' ? { w: custom.w, h: custom.h } : LABEL_SIZES.find((s) => s.id === sizeId)!
  const opts: LabelOptions = { w: size.w, h: size.h, volume, skip }
  const fit = perSheet(size.w, size.h)
  const items = useMemo(
    () =>
      entries.flatMap((e) => {
        const d = isMat
          ? (() => {
              const m = materials.find((x) => x.id === e.id)
              return m ? materialLabelData(m, e.dilution, e.solvent) : null
            })()
          : (() => {
              const f = formulas.find((x) => x.id === e.id)
              return f ? labelData(f) : null
            })()
        return d ? Array.from({ length: Math.max(0, e.copies) }, () => d) : []
      }),
    [entries, formulas, materials, isMat]
  )
  const total = items.length
  const sheets = Math.max(1, Math.ceil((Math.min(skip, fit.count - 1) + total) / fit.count))
  const html = useMemo(() => labelsToPdfHtml(items, opts), [items, opts.w, opts.h, opts.volume, opts.skip]) // eslint-disable-line react-hooks/exhaustive-deps
  const pool: { id: string; name: string }[] = isMat ? [...materials].sort((a, b) => a.name.localeCompare(b.name)) : formulas
  const free = pool.filter((f) => !entries.some((e) => e.id === f.id))
  const nameOf = (x: string) => pool.find((y) => y.id === x)?.name

  // the preview frame is a real-size sheet (184.6 mm ≈ 698 px), scaled down to the column
  const box = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(0.5)
  useLayoutEffect(() => {
    const el = box.current
    if (!el) return
    const fitBox = () => setScale(el.clientWidth / SHEET_PX_W)
    fitBox()
    const ro = new ResizeObserver(fitBox)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const print = async () => {
    if (!total) return toast('Nothing to print — add at least one label')
    const name = entries.length === 1 ? `${nameOf(entries[0].id) ?? 'labels'} - labels.pdf` : 'labels.pdf'
    const p = isWeb ? await window.vialintia.printPdf(html, name) : await withProgress('Exporting labels', () => window.vialintia.printPdf(html, name))
    if (p) toast('Labels saved — print at 100 % (actual size)')
  }

  return createPortal(
    <div className="overlay" onMouseDown={onClose}>
      <div className="modal lbl-modal" onMouseDown={(e) => e.stopPropagation()}>
        <div className="row" style={{ alignItems: 'center' }}>
          <h3 style={{ margin: 0 }}>{isMat ? 'Material labels' : 'Bottle labels'}</h3>
          <div className="spacer" />
          <button className="btn btn-ghost btn-icon" onClick={onClose} aria-label="Close">
            <IconX size={16} />
          </button>
        </div>

        <div className="lbl-grid">
          <div className="lbl-form">
            <div className="field">
              <label>Labels</label>
              {entries.map((e, i) => {
                const set = (patch: Partial<LabelEntry>) => setEntries((list) => list.map((x, j) => (j === i ? { ...x, ...patch } : x)))
                return (
                  <div key={e.id} className={`lbl-entry${isMat ? ' mat' : ''}`}>
                    <span className="nm">{nameOf(e.id) ?? 'Missing'}</span>
                    {isMat && (
                      <span className="suffix lbl-dil" title="Dilution in this bottle (100 = neat)">
                        <NumberInput className="input input-sm" value={e.dilution ?? 100} min={0.001} max={100} onCommit={(v) => set({ dilution: Math.min(100, Math.max(0.001, v ?? 100)) })} />
                        <span>%</span>
                      </span>
                    )}
                    <NumberInput
                      className="input input-sm"
                      value={e.copies}
                      min={0}
                      onCommit={(v) => set({ copies: Math.max(0, Math.round(v ?? 0)) })}
                    />
                    <span className="x">×</span>
                    {entries.length > 1 && (
                      <button className="btn btn-ghost btn-icon btn-sm" onClick={() => setEntries((list) => list.filter((_, j) => j !== i))} aria-label="Remove">
                        <IconX size={13} />
                      </button>
                    )}
                  </div>
                )
              })}
              {free.length > 0 && (
                <select
                  className="select input-sm"
                  value=""
                  onChange={(e) => e.target.value && setEntries((list) => [...list, startEntry(e.target.value)])}
                >
                  <option value="">{isMat ? '+ Add another material…' : '+ Add another formula…'}</option>
                  {free.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name}
                    </option>
                  ))}
                </select>
              )}
            </div>

            <div className="field">
              <label>Size</label>
              <select className="select" value={sizeId} onChange={(e) => setSizeId(e.target.value)}>
                {LABEL_SIZES.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
                <option value="custom">Own size…</option>
              </select>
              {sizeId === 'custom' && (
                <div className="grid-2" style={{ marginTop: 8 }}>
                  <div className="suffix">
                    <NumberInput value={custom.w} min={15} max={180} onCommit={(v) => setCustom((c) => ({ ...c, w: Math.max(15, v ?? 40) }))} />
                    <span>mm W</span>
                  </div>
                  <div className="suffix">
                    <NumberInput value={custom.h} min={10} max={120} onCommit={(v) => setCustom((c) => ({ ...c, h: Math.max(10, v ?? 22) }))} />
                    <span>mm H</span>
                  </div>
                </div>
              )}
            </div>

            <div className="grid-2">
              <div className="field">
                <label>Volume</label>
                <input className="input" value={volume} onChange={(e) => setVolume(e.target.value)} />
              </div>
              <div className="field">
                <label>Start at label</label>
                <NumberInput value={skip + 1} min={1} max={fit.count} onCommit={(v) => setSkip(Math.max(0, Math.min(fit.count - 1, Math.round((v ?? 1) - 1))))} />
              </div>
            </div>


            <p className="faint small" style={{ margin: 0 }}>
              {fit.count} per A4 sheet ({fit.cols} × {fit.rows}) · {total} label{total === 1 ? '' : 's'} → {sheets} sheet{sheets === 1 ? '' : 's'}
              {skip > 0 ? ` · first ${skip} position${skip === 1 ? '' : 's'} left free (already used)` : ''}. Print at 100 % (actual size).
            </p>
          </div>

          <div className="lbl-preview" ref={box} style={{ height: SHEET_PX_H * scale }}>
            <iframe title="Label sheet preview" srcDoc={html} sandbox="" style={{ width: SHEET_PX_W, height: SHEET_PX_H, transform: `scale(${scale})` }} />
          </div>
        </div>

        <div className="modal-actions">
          <button className="btn btn-ghost" onClick={onClose}>
            Close
          </button>
          <button className="btn btn-primary" onClick={print} disabled={!total}>
            <IconFile /> Labels PDF
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}

