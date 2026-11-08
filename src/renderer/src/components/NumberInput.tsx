import { forwardRef, useEffect, useState } from 'react'
import { parseNum } from '@/lib/calc'

interface Props {
  value: number | null | undefined
  onCommit: (v: number | null) => void
  className?: string
  placeholder?: string
  min?: number
  max?: number
  allowEmpty?: boolean
  onEnter?: () => void
  title?: string
  autoFocus?: boolean
}

function display(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v)) return ''
  // Trim floating point noise while keeping user precision.
  return String(Number(v.toPrecision(10)))
}

/** Text input for numbers: accepts "1,5" or "1.5", commits on blur / Enter, Esc reverts. */
export const NumberInput = forwardRef<HTMLInputElement, Props>(function NumberInput(
  { value, onCommit, className = 'input', placeholder, min, max, allowEmpty = false, onEnter, title, autoFocus },
  ref
) {
  const [text, setText] = useState(display(value))
  const [focused, setFocused] = useState(false)

  useEffect(() => {
    if (!focused) setText(display(value))
  }, [value, focused])

  const commit = () => {
    const n = parseNum(text)
    if (n === null) {
      if (allowEmpty) {
        if (value != null) onCommit(null)
      } else setText(display(value))
      return
    }
    let v = n
    if (min != null) v = Math.max(min, v)
    if (max != null) v = Math.min(max, v)
    if (v !== value) onCommit(v)
    setText(display(v))
  }

  return (
    <input
      ref={ref}
      className={className}
      value={text}
      placeholder={placeholder}
      title={title}
      inputMode="decimal"
      autoFocus={autoFocus}
      onFocus={(e) => {
        setFocused(true)
        e.currentTarget.select()
      }}
      onBlur={() => {
        setFocused(false)
        commit()
      }}
      onChange={(e) => setText(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          commit()
          onEnter?.()
        } else if (e.key === 'Escape') {
          setText(display(value))
          e.currentTarget.blur()
        } else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
          const n = parseNum(text) ?? 0
          const step = e.shiftKey ? 10 : e.altKey ? 0.1 : 1
          let v = n + (e.key === 'ArrowUp' ? step : -step)
          if (min != null) v = Math.max(min, v)
          if (max != null) v = Math.min(max, v)
          v = Number(v.toFixed(6))
          setText(display(v))
          onCommit(v)
          e.preventDefault()
        }
      }}
    />
  )
})
