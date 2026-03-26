import { ScoreResult } from '@/types'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

interface Props {
  result: ScoreResult
  points: number
  className?: string
}

const config = {
  exact:   { label: '10 נק׳', className: 'border-emerald-400/40 bg-emerald-400/10 text-emerald-400' },
  outcome: { label: '5 נק׳',  className: 'border-amber-400/40 bg-amber-400/10 text-amber-400' },
  miss:    { label: '0 נק׳',  className: 'border-red-500/40 bg-red-500/10 text-red-500' },
} as const

export function PointsBadge({ result, className }: Props) {
  const { label, className: colorClass } = config[result]
  return (
    <Badge variant="outline" className={cn('text-xs font-bold', colorClass, className)}>
      {label}
    </Badge>
  )
}
