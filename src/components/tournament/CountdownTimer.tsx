'use client'
import { Lock, Clock } from 'lucide-react'
import { useCountdown } from '@/hooks/useCountdown'
import { cn } from '@/lib/utils'

interface Props {
  matchStartTime: string
}

export function CountdownTimer({ matchStartTime }: Props) {
  const { formatted, isLocked, timeLeft } = useCountdown(matchStartTime)

  if (isLocked) {
    return (
      <div className="flex items-center gap-1.5 text-sm font-medium text-red-500">
        <Lock className="h-3.5 w-3.5" />
        <span>נעול</span>
      </div>
    )
  }

  const minutesLeft = timeLeft / 60000
  const colorClass = minutesLeft > 60 ? 'text-green-600' : minutesLeft > 10 ? 'text-amber-500' : 'text-red-500'

  return (
    <div className={cn('flex items-center gap-1.5 text-sm font-mono font-medium', colorClass)}>
      <Clock className="h-3.5 w-3.5" />
      <span>{formatted}</span>
    </div>
  )
}
