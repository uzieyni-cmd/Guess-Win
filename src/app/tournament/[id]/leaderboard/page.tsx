'use client'
import { Trophy } from 'lucide-react'
import { useTournament } from '@/context/TournamentContext'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { EmptyState } from '@/components/shared/EmptyState'
import { cn } from '@/lib/utils'

const rankStyles = [
  { badge: 'bg-yellow-400/15 border border-yellow-400/50 text-yellow-300', card: 'border-yellow-400/30', points: 'text-yellow-300' },
  { badge: 'bg-slate-400/15 border border-slate-400/50 text-slate-300',   card: 'border-slate-400/30',  points: 'text-slate-300'  },
  { badge: 'bg-amber-600/15 border border-amber-500/50 text-amber-400',   card: 'border-amber-500/30',  points: 'text-amber-400'  },
]

export default function LeaderboardPage() {
  const { standings } = useTournament()

  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <Trophy className="h-5 w-5 text-emerald-500" />
        <h2 className="font-suez text-xl text-slate-100">טבלת דירוג</h2>
      </div>
      {standings.length === 0 ? (
        <EmptyState icon={Trophy} title="אין תוצאות עדיין" subtitle="הדירוג יופיע לאחר סיום משחקים" />
      ) : (
        <div className="space-y-2 stagger">
          {standings.map((s, i) => (
            <div
              key={s.user.id}
              className={cn(
                'flex items-center gap-3 p-3 rounded-xl bg-[#0d1420] border border-slate-700/40 animate-fade-up',
                i < 3 && rankStyles[i].card
              )}
            >
              {/* מספר דירוג */}
              <div className={cn(
                'w-8 h-8 flex items-center justify-center rounded-full text-sm font-bold shrink-0',
                i < 3 ? rankStyles[i].badge : 'text-slate-500'
              )}>
                {s.rank}
              </div>

              {/* תמונת פרופיל */}
              <Avatar className="h-10 w-10 shrink-0">
                <AvatarImage src={s.user.avatarUrl} className="object-cover" />
                <AvatarFallback delayMs={0} className="bg-indigo-600 text-white text-sm font-bold">
                  {s.user.displayName.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>

              {/* שם */}
              <p className="flex-1 font-semibold text-sm truncate text-slate-100">{s.user.displayName}</p>

              {/* ניקוד */}
              <div className="text-left shrink-0">
                <p className={cn('text-xl font-bold tabular-nums', i < 3 ? rankStyles[i].points : 'text-emerald-400')}>
                  {s.totalPoints}
                </p>
                <p className="text-xs text-slate-500 text-center">נק׳</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
