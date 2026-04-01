'use client'
import { ChevronUp, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Props {
  value: number | null
  onChange: (value: number) => void
  disabled?: boolean
  className?: string
  ariaLabel?: string
}

const MIN = 0
const MAX = 10

export function ScoreInput({ value, onChange, disabled, className, ariaLabel }: Props) {
  const current = value ?? 0

  const increment = () => {
    if (disabled) return
    if (value === null) { onChange(0); return }
    if (current >= MAX) return
    onChange(current + 1)
  }

  const decrement = () => {
    if (disabled || value === null || current <= MIN) return
    onChange(current - 1)
  }

  const handleWheel = (e: React.WheelEvent) => {
    if (disabled) return
    e.preventDefault()
    if (e.deltaY < 0) increment()
    else decrement()
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return
    if (e.key === 'ArrowUp')   { e.preventDefault(); increment() }
    if (e.key === 'ArrowDown') { e.preventDefault(); decrement() }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (disabled) return
    const raw = parseInt(e.target.value, 10)
    if (isNaN(raw)) return
    onChange(Math.min(MAX, Math.max(MIN, raw)))
  }

  return (
    <div className={cn('flex flex-col items-center gap-0.5 select-none', className)}>
      <button
        type="button"
        onClick={increment}
        disabled={disabled || (value !== null && current >= MAX)}
        aria-label="הגדל ניקוד"
        className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded hover:bg-muted disabled:opacity-20 transition-colors"
        tabIndex={-1}
      >
        <ChevronUp className="h-4 w-4 text-muted-foreground" />
      </button>

      {value === null ? (
        <span
          role="spinbutton"
          aria-label={ariaLabel}
          tabIndex={disabled ? -1 : 0}
          onClick={() => !disabled && onChange(0)}
          onKeyDown={(e) => {
            if (disabled) return
            if (e.key === 'ArrowUp') { e.preventDefault(); onChange(0) }
            if (/^[0-9]$/.test(e.key)) onChange(Math.min(MAX, parseInt(e.key)))
          }}
          className={cn(
            'w-11 h-11 text-center rounded-lg border text-xl font-bold flex items-center justify-center transition-colors',
            disabled
              ? 'bg-muted text-muted-foreground border-muted cursor-not-allowed'
              : 'bg-white border-gray-200 text-muted-foreground cursor-pointer hover:border-indigo-300'
          )}
        >
          –
        </span>
      ) : (
        <input
          type="number"
          inputMode="numeric"
          min={MIN}
          max={MAX}
          value={current}
          onChange={handleChange}
          onWheel={handleWheel}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          aria-label={ariaLabel}
          className={cn(
            'w-11 h-11 text-center rounded-lg border text-xl font-bold transition-colors',
            '[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none',
            disabled
              ? 'bg-muted text-muted-foreground border-muted cursor-not-allowed'
              : 'bg-white border-gray-200 cursor-ns-resize hover:border-indigo-300 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-300/40'
          )}
        />
      )}

      <button
        type="button"
        onClick={decrement}
        disabled={disabled || current <= MIN}
        aria-label="הקטן ניקוד"
        className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded hover:bg-muted disabled:opacity-20 transition-colors"
        tabIndex={-1}
      >
        <ChevronDown className="h-4 w-4 text-muted-foreground" />
      </button>
    </div>
  )
}
