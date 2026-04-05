'use client'
import { useRef } from 'react'
import { Trophy, Flame } from 'lucide-react'
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
  const { standings, activeTournament } = useTournament()
  const prevRanks = useRef<Record<string, number>>({})

  const hasLive = (activeTournament?.matches ?? []).some(m => m.status === 'live')
  const isLiveMode = hasLive && standings.some(s => (s.liveBonus ?? 0) > 0)

  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <Trophy className="h-5 w-5 text-emerald-500" />
        <h2 className="font-suez text-xl text-slate-100">טבלת דירוג</h2>
        {isLiveMode && (
          <span className="flex items-center gap-1 text-[11px] font-bold bg-red-600 text-white px-2 py-0.5 rounded-sm tracking-widest">
            <span className="relative flex h-1.5 w-1.5 shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75" />
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-white" />
            </span>
            LIVE
          </span>
        )}
      </div>

      {standings.length === 0 ? (
        <EmptyState icon={Trophy} title="אין תוצאות עדיין" subtitle="הדירוג יופיע לאחר סיום משחקים" />
      ) : (
        <div className="space-y-2 stagger">
          {standings.map((s, i) => {
            const prevRank = prevRanks.current[s.user.id]
            const moved = prevRank !== undefined && prevRank !== s.rank
            const movedUp = prevRank !== undefined && prevRank > s.rank
            prevRanks.current[s.user.id] = s.rank
            const liveBonus = s.liveBonus ?? 0

            return (
              <div
                key={s.user.id}
                className={cn(
                  'flex items-center gap-3 p-3 rounded-xl bg-[#0d1420] border border-slate-700/40 transition-all duration-500',
                  i < 3 && rankStyles[i].card,
                  moved && movedUp && 'ring-1 ring-emerald-500/40',
                  moved && !movedUp && 'ring-1 ring-red-500/20',
                )}
              >
                {/* מספר דירוג */}
                <div className={cn(
                  'w-8 h-8 flex items-center justify-center rounded-full font-condensed text-lg font-bold shrink-0',
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
                <div className="text-left shrink-0 flex flex-col items-center">
                  <p className={cn('font-condensed text-2xl font-bold tabular-nums', i < 3 ? rankStyles[i].points : 'text-emerald-400')}>
                    {s.totalPoints}
                  </p>
                  {liveBonus > 0 ? (
                    <span className="flex items-center gap-0.5 text-[10px] font-bold text-orange-400 animate-pulse">
                      <Flame className="h-2.5 w-2.5" />+{liveBonus}
                    </span>
                  ) : (
                    <p className="text-xs text-slate-500 text-center">נק׳</p>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {isLiveMode && (
        <p className="text-center text-[10px] text-slate-600 mt-3">
          ניקוד חי זמני — יתעדכן בסיום המשחק
        </p>
      )}
    </div>
  )
}
