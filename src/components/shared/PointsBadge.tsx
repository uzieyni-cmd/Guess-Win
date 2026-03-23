import { ScoreResult } from '@/types'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

interface Props {
  result: ScoreResult
  points: number
  className?: string
}

const config = {
  exact: { label: '10 נק׳ ⚽', variant: 'success' },
  outcome: { label: '5 נק׳ ✓', variant: 'warning' },
  miss: { label: '0 נק׳ ✗', variant: 'secondary' },
} as const

export function PointsBadge({ result, className }: Props) {
  const { label, variant } = config[result]
  return (
    <Badge variant={variant} className={cn('text-xs font-bold', className)}>
      {label}
    </Badge>
  )
}
