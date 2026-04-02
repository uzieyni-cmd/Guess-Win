'use client'
import { useRouter } from 'next/navigation'
import { Trophy, Users, ChevronLeft } from 'lucide-react'
import { Tournament } from '@/types'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

interface Props {
  tournament: Tournament
  index: number
}

const statusColors = {
  active: 'success',
  upcoming: 'warning',
  completed: 'secondary',
} as const

const statusBorders = {
  active: 'border-emerald-500',
  upcoming: 'border-indigo-500',
  completed: 'border-slate-600',
} as const

const statusLabels = {
  active: 'פעיל',
  upcoming: 'בקרוב',
  completed: 'הסתיים',
} as const

export function CompetitionCard({ tournament, index }: Props) {
  const router = useRouter()

  return (
    <div className="animate-fade-up transition-transform duration-200 hover:scale-[1.02] active:scale-[0.98]">
      <Card
        className={cn('cursor-pointer border-2 transition-all duration-200 overflow-hidden', statusBorders[tournament.status])}
        onClick={() => router.push(`/tournament/${tournament.id}/matches`)}
      >
        <CardContent className="p-0">
          <div className="bg-gradient-to-l from-emerald-700 to-emerald-950 p-4 flex items-center gap-3">
            {tournament.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={tournament.logoUrl}
                alt={tournament.name}
                className="h-12 w-12 object-contain rounded-full bg-white/10 p-1"
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
              />
            ) : (
              <div className="h-12 w-12 rounded-full bg-white/20 flex items-center justify-center">
                <Trophy className="h-6 w-6 text-white" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <h3 className="font-suez text-white text-lg leading-tight truncate">{tournament.name}</h3>
              <p className="text-emerald-100 text-sm truncate">{tournament.description}</p>
            </div>
          </div>
          <div className="p-4 flex items-center justify-between">
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <span className="flex items-center gap-1">
                <Users className="h-4 w-4" />
                {tournament.participantIds.length} שחקנים
              </span>
              <span className="flex items-center gap-1">
                <Trophy className="h-4 w-4" />
                {tournament.matches.length} משחקים
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={statusColors[tournament.status]}>{statusLabels[tournament.status]}</Badge>
              <ChevronLeft className="h-4 w-4 text-muted-foreground" />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
