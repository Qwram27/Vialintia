import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { COOL_SWATCHES } from '@shared/defaults'

// ---------- colour math ----------
export function hexToHsl(hex: string): [number, number, number] {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim())
  if (!m) return [140, 20, 50]
  const n = parseInt(m[1], 16)
  const r = ((n >> 16) & 255) / 255
  const g = ((n >> 8) & 255) / 255
  const b = (n & 255) / 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const l = (max + min) / 2
  let h = 0
  let s = 0
  if (max !== min) {
    const d = max - min
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
    if (max === r) h = (g - b) / d + (g < b ? 6 : 0)
    else if (max === g) h = (b - r) / d + 2
    else h = (r - g) / d + 4
    h *= 60
  }
  return [Math.round(h), Math.round(s * 100), Math.round(l * 100)]
}

export function hslToHex(h: number, s: number, l: number): string {
  s /= 100
  l /= 100
  const k = (n: number) => (n + h / 30) % 12
  const a = s * Math.min(l, 1 - l)
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)))
  return '#' + [f(0), f(8), f(4)].map((x) => Math.round(x * 255).toString(16).padStart(2, '0')).join('')
}

export function isHex(v: string): boolean {
  return /^#[0-9a-f]{6}$/i.test(v.trim())
}

// ---------- picker ----------
interface Props {
  value: string
  onChange: (hex: string) => void
  title?: string
}

export function ColorSwatch({ value, onChange, title }: Props) {
  const [open, setOpen] = useState(false)
  const btn = useRef<HTMLButtonElement>(null)
  const pop = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState({ left: 0, top: 0 })
  const [hsl, setHsl] = useState<[number, number, number]>(() => hexToHsl(value))
  const [hexText, setHexText] = useState(value)

  useEffect(() => {
    setHsl(hexToHsl(value))
    setHexText(value)
  }, [value])

  useLayoutEffect(() => {
    if (!open || !btn.current) return
    const r = btn.current.getBoundingClientRect()
    const top = window.innerHeight - r.bottom > 330 ? r.bottom + 6 : Math.max(8, r.top - 326)
    setPos({ left: Math.min(r.left, window.innerWidth - 280), top })
  }, [open])

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (pop.current?.contains(e.target as Node) || btn.current?.contains(e.target as Node)) return
      setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const setFromHsl = (next: [number, number, number]) => {
    setHsl(next)
    const hex = hslToHex(...next)
    setHexText(hex)
    onChange(hex)
  }

  const [h, s, l] = hsl
  const track = (stops: string[]) => ({ background: `linear-gradient(90deg, ${stops.join(',')})` })

  return (
    <>
      <button ref={btn} className="swatch-btn" style={{ background: value }} title={title ?? 'Change colour'} onClick={() => setOpen((o) => !o)} />
      {open &&
        createPortal(
          <div ref={pop} className="cpop fade-in" style={{ left: pos.left, top: pos.top }}>
            <div className="swatches">
              {COOL_SWATCHES.map((c) => (
                <button
                  key={c}
                  className={c.toLowerCase() === value.toLowerCase() ? 'on' : ''}
                  style={{ background: c }}
                  title={c}
                  onClick={() => onChange(c)}
                />
              ))}
            </div>
            <div className="hsl-row">
              <span>H</span>
              <input
                type="range"
                min={0}
                max={360}
                value={h}
                style={track([0, 1, 2, 3, 4, 5, 6].map((i) => hslToHex(i * 60, s, l)))}
                onChange={(e) => setFromHsl([+e.target.value, s, l])}
              />
              <span className="num">{h}°</span>
            </div>
            <div className="hsl-row">
              <span>S</span>
              <input type="range" min={0} max={100} value={s} style={track([hslToHex(h, 0, l), hslToHex(h, 100, l)])} onChange={(e) => setFromHsl([h, +e.target.value, l])} />
              <span className="num">{s}%</span>
            </div>
            <div className="hsl-row">
              <span>L</span>
              <input type="range" min={5} max={95} value={l} style={track([hslToHex(h, s, 5), hslToHex(h, s, 50), hslToHex(h, s, 95)])} onChange={(e) => setFromHsl([h, s, +e.target.value])} />
              <span className="num">{l}%</span>
            </div>
            <div className="row" style={{ marginTop: 10 }}>
              <span className="swatch-btn" style={{ background: value, cursor: 'default' }} />
              <input
                className="input input-sm"
                value={hexText}
                onChange={(e) => {
                  setHexText(e.target.value)
                  if (isHex(e.target.value)) onChange(e.target.value.trim().toLowerCase())
                }}
                style={{ fontFamily: 'ui-monospace, monospace' }}
              />
            </div>
          </div>,
          document.body
        )}
    </>
  )
}
