import { ScoreResult } from '@/types'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

interface Props {
  result: ScoreResult
  points: number
  className?: string
}

const config = {
  exact:   { label: '10 נק׳', className: 'border-emerald-500/40 bg-emerald-100 text-emerald-700' },
  outcome: { label: '5 נק׳',  className: 'border-amber-500/40 bg-amber-100 text-amber-700' },
  miss:    { label: '0 נק׳',  className: 'border-red-400/40 bg-red-50 text-red-600' },
} as const

export function PointsBadge({ result, className }: Props) {
  const { label, className: colorClass } = config[result]
  return (
    <Badge variant="outline" className={cn('text-xs font-bold', colorClass, className)}>
      {label}
    </Badge>
  )
}
