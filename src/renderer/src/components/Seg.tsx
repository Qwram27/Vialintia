import { useLayoutEffect, useRef, useState, type ReactNode } from 'react'

interface Option<T extends string> {
  value: T
  label: ReactNode
}

/** Apple-style segmented control with a sliding thumb. */
export function Seg<T extends string>({
  options,
  value,
  onChange,
  size,
  block,
  className = ''
}: {
  options: Option<T>[]
  value: T
  onChange: (v: T) => void
  size?: 'lg'
  block?: boolean
  className?: string
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [thumb, setThumb] = useState<{ x: number; w: number } | null>(null)

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const measure = () => {
      const on = el.querySelector<HTMLButtonElement>('button.on')
      if (!on) return setThumb(null)
      // Sub-pixel accurate position relative to the track.
      const a = el.getBoundingClientRect()
      const b = on.getBoundingClientRect()
      setThumb({ x: b.left - a.left - el.clientLeft, w: b.width })
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    el.querySelectorAll('button').forEach((b) => ro.observe(b))
    document.fonts?.ready.then(measure)
    return () => ro.disconnect()
  }, [value, options.length])

  return (
    <div ref={ref} className={`seg${size === 'lg' ? ' seg-lg' : ''}${block ? ' seg-block' : ''} ${className}`}>
      {thumb && <span className="seg-thumb" style={{ width: thumb.w, transform: `translateX(${thumb.x}px)` }} />}
      {options.map((o) => (
        <button key={o.value} className={o.value === value ? 'on' : ''} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  )
}
