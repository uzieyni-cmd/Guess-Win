'use client'
import { ChevronUp, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Props {
  value: number | null
  onChange: (value: number) => void
  disabled?: boolean
  className?: string
}

const MIN = 0
const MAX = 10

export function ScoreInput({ value, onChange, disabled, className }: Props) {
  const current = value ?? 0

  const increment = () => {
    if (disabled || current >= MAX) return
    onChange(current + 1)
  }

  const decrement = () => {
    if (disabled || current <= MIN) return
    onChange(current - 1)
  }

  const handleWheel = (e: React.WheelEvent) => {
    if (disabled) return
    e.preventDefault()
    if (e.deltaY < 0) increment()
    else decrement()
  }

  return (
    <div className={cn('flex flex-col items-center gap-0.5 select-none', className)}>
      <button
        type="button"
        onClick={increment}
        disabled={disabled || current >= MAX}
        className="p-1 rounded hover:bg-muted disabled:opacity-20 transition-colors"
        tabIndex={-1}
      >
        <ChevronUp className="h-4 w-4 text-muted-foreground" />
      </button>

      <div
        onWheel={handleWheel}
        className={cn(
          'w-11 h-11 flex items-center justify-center rounded-lg border text-xl font-bold transition-colors',
          disabled
            ? 'bg-muted text-muted-foreground border-muted cursor-not-allowed'
            : 'bg-white border-gray-200 cursor-ns-resize hover:border-indigo-300'
        )}
      >
        {current}
      </div>

      <button
        type="button"
        onClick={decrement}
        disabled={disabled || current <= MIN}
        className="p-1 rounded hover:bg-muted disabled:opacity-20 transition-colors"
        tabIndex={-1}
      >
        <ChevronDown className="h-4 w-4 text-muted-foreground" />
      </button>
    </div>
  )
}
