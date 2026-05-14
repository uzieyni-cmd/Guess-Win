'use client'
import { Lock, Clock } from 'lucide-react'
import { useCountdown } from '@/hooks/useCountdown'
import { cn } from '@/lib/utils'

interface Props {
  matchStartTime: string
}

export function CountdownTimer({ matchStartTime }: Props) {
  const { isLocked, timeLeft, days, hours, minutes, seconds } = useCountdown(matchStartTime)

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

  if (days > 0) {
    const hh = String(hours).padStart(2, '0')
    const mm = String(minutes).padStart(2, '0')
    return (
      <div className={cn('flex items-start gap-1.5', colorClass)}>
        <Clock className="h-3.5 w-3.5 mt-0.5 shrink-0" />
        <div className="flex flex-col leading-tight font-mono font-medium text-xs">
          <span>{days} ימים</span>
          <span>{hh}:{mm} שעות</span>
        </div>
      </div>
    )
  }

  const hh = String(hours).padStart(2, '0')
  const mm = String(minutes).padStart(2, '0')
  const ss = String(seconds).padStart(2, '0')

  return (
    <div className={cn('flex items-center gap-1.5 text-sm font-mono font-medium', colorClass)}>
      <Clock className="h-3.5 w-3.5" />
      <span>{hh}:{mm}:{ss}</span>
    </div>
  )
}
