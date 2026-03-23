'use client'
import { useState } from 'react'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

interface Props {
  value: number | null
  onChange: (value: number) => void
  disabled?: boolean
  className?: string
}

export function ScoreInput({ value, onChange, disabled, className }: Props) {
  const [local, setLocal] = useState(value?.toString() ?? '')

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setLocal(e.target.value)
  }

  const handleBlur = () => {
    const num = parseInt(local, 10)
    if (!isNaN(num) && num >= 0 && num <= 99) {
      onChange(num)
    } else {
      setLocal(value?.toString() ?? '')
    }
  }

  return (
    <Input
      type="number"
      min={0}
      max={99}
      value={local}
      onChange={handleChange}
      onBlur={handleBlur}
      disabled={disabled}
      className={cn(
        'w-14 text-center text-lg font-bold h-10 p-1 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none',
        disabled && 'bg-muted cursor-not-allowed opacity-70',
        className
      )}
      placeholder="-"
    />
  )
}
