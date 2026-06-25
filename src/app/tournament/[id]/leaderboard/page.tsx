'use client'
import { useRef, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { Trophy, Flame, Search, Zap } from 'lucide-react'
import { useTournament } from '@/context/TournamentContext'
import { useAuth } from '@/context/AuthContext'
import { EmptyState } from '@/components/shared/EmptyState'
import { cn } from '@/lib/utils'

const rankStyles = [
  { badge: 'bg-yellow-400/20 border border-yellow-500/50 text-yellow-600', card: 'border-yellow-400/40', points: 'text-yellow-600' },
  { badge: 'bg-slate-400/15 border border-slate-400/50 text-slate-500',    card: 'border-slate-400/30',  points: 'text-slate-600'  },
  { badge: 'bg-amber-500/15 border border-amber-500/50 text-amber-600',    card: 'border-amber-500/30',  points: 'text-amber-600'  },
]

// פירוק ניקוד — שורה עצמאית ברוחב מלא מתחת לשורה הראשית
function PointsSplit({ match, bonus }: { match: number; bonus: number }) {
  if (match === 0 && bonus === 0) return null
  return (
    <div className="flex items-center gap-1.5 text-xs text-muted-foreground tabular-nums mt-2 pt-2 border-t border-border/40">
      <span><span className="font-semibold text-foreground/70">{match}</span> נק׳ משחקים</span>
      <span className="text-muted-foreground/40">·</span>
      <span><span className="font-semibold text-emerald-600">{bonus}</span> נק׳ בונוס</span>
    </div>
  )
}

export default function LeaderboardPage() {
  const { standings, activeTournament, jokerPicks, bets } = useTournament()
  const { currentUser } = useAuth()
  const router = useRouter()
  const { id: tournamentId } = useParams() as { id: string }
  const prevRanks = useRef<Record<string, number>>({})
  const [search, setSearch] = useState('')

  // ספירת ג'וקרים שמומשו בפועל — רק עבור ניחושים שכבר חושבו (points !== null)
  const scoredBetKeys = new Set(
    bets.filter(b => b.points !== null).map(b => `${b.userId}:${b.matchId}`)
  )
  const jokerCountByUser = jokerPicks.reduce<Record<string, number>>((acc, j) => {
    if (!scoredBetKeys.has(`${j.userId}:${j.matchId}`)) return acc
    acc[j.userId] = (acc[j.userId] ?? 0) + 1
    return acc
  }, {})

  const hasLive = (activeTournament?.matches ?? []).some(m => m.status === 'live')
  const isLiveMode = hasLive && standings.some(s => (s.liveBonus ?? 0) > 0)
  const myStanding = standings.find(s => s.user.id === currentUser?.id)

  // הרשימה הציבורית אינה כוללת מנהלי-על — אך "המיקום שלי" ממשיך לשקף את הדירוג האמיתי
  const publicStandings = standings.filter(s => s.user.role !== 'admin')

  const filtered = search.trim()
    ? publicStandings.filter(s => s.user.displayName.toLowerCase().includes(search.toLowerCase()))
    : publicStandings

  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <Trophy className="h-5 w-5 text-primary" />
        <h2 className="font-suez text-xl text-foreground">טבלת דירוג</h2>
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

      {/* המיקום שלי */}
      {myStanding && (
        <div className="flex flex-col p-3 mb-3 rounded-xl bg-primary/10 border border-primary/30">
          <div className="flex items-center gap-3 w-full">
            <div className="w-8 h-8 flex items-center justify-center rounded-full font-condensed text-lg font-bold shrink-0 bg-primary/15 text-primary">
              {myStanding.rank}
            </div>

            <div className="flex-1 min-w-0 flex items-center gap-1.5">
              <p className="font-semibold text-sm truncate text-foreground min-w-0">המיקום שלי</p>
              {(jokerCountByUser[myStanding.user.id] ?? 0) > 0 && (
                <div className="flex items-center gap-0.5 shrink-0">
                  {Array.from({ length: jokerCountByUser[myStanding.user.id] ?? 0 }).map((_, i) => (
                    <Zap key={i} className="h-3.5 w-3.5 text-red-500 fill-red-500 shrink-0" />
                  ))}
                </div>
              )}
            </div>

            <div className="shrink-0 flex flex-col items-center min-w-[36px]">
              <p className="font-condensed text-lg font-bold tabular-nums text-amber-500">{myStanding.exactCount}</p>
              <p className="text-xs text-muted-foreground">בול</p>
            </div>

            <div className="text-left shrink-0 flex flex-col items-center min-w-[52px]">
              <p className="font-condensed text-2xl font-bold tabular-nums text-primary leading-none">{myStanding.totalPoints}</p>
              <div className="flex items-center gap-1 mt-0.5">
                <span className="text-xs text-muted-foreground">נק׳</span>
                {(myStanding.liveBonus ?? 0) > 0 && (
                  <span className="flex items-center gap-0.5 text-xs font-bold text-orange-400 animate-pulse">
                    <Flame className="h-2.5 w-2.5" />+{myStanding.liveBonus}
                  </span>
                )}
              </div>
            </div>
          </div>

          <PointsSplit match={myStanding.matchPoints} bonus={myStanding.bonusPoints} />
        </div>
      )}

      {/* חיפוש */}
      {publicStandings.length > 0 && (
        <div className="relative mb-3">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="חיפוש לפי שם..."
            className="w-full pr-9 pl-3 py-2 text-sm rounded-xl border border-border bg-card text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
          />
        </div>
      )}

      {publicStandings.length === 0 ? (
        <EmptyState icon={Trophy} title="אין תוצאות עדיין" subtitle="הדירוג יופיע לאחר סיום משחקים" />
      ) : filtered.length === 0 ? (
        <p className="text-center text-muted-foreground text-sm py-8">לא נמצא משתתף בשם זה</p>
      ) : (
        <div className="space-y-2 stagger">
          {filtered.map((s) => {
            const rankIdx = s.rank - 1 // 0-based index לצבעים
            const prevRank = prevRanks.current[s.user.id]
            const moved = prevRank !== undefined && prevRank !== s.rank
            const movedUp = prevRank !== undefined && prevRank > s.rank
            prevRanks.current[s.user.id] = s.rank
            const liveBonus = s.liveBonus ?? 0

            return (
              <div
                key={s.user.id}
                onClick={() => router.push(`/tournament/${tournamentId}/player/${s.user.id}`)}
                className={cn(
                  'flex flex-col p-3 rounded-xl bg-card border border-border transition-all duration-500 cursor-pointer active:opacity-70',
                  rankIdx < 3 && rankStyles[rankIdx].card,
                  moved && movedUp && 'ring-1 ring-emerald-500/40',
                  moved && !movedUp && 'ring-1 ring-red-500/20',
                )}
              >
                <div className="flex items-center gap-3 w-full">
                  {/* מספר דירוג */}
                  <div className={cn(
                    'w-8 h-8 flex items-center justify-center rounded-full font-condensed text-lg font-bold shrink-0',
                    rankIdx < 3 ? rankStyles[rankIdx].badge : 'text-muted-foreground'
                  )}>
                    {s.rank}
                  </div>

                  {/* שם */}
                  <div className="flex-1 min-w-0 flex items-center gap-1.5">
                    <p className="font-semibold text-sm truncate text-foreground min-w-0">{s.user.displayName}</p>
                    {(jokerCountByUser[s.user.id] ?? 0) > 0 && (
                      <div className="flex items-center gap-0.5 shrink-0">
                        {Array.from({ length: jokerCountByUser[s.user.id] ?? 0 }).map((_, i) => (
                          <Zap key={i} className="h-3.5 w-3.5 text-red-500 fill-red-500 shrink-0" />
                        ))}
                      </div>
                    )}
                  </div>

                  {/* בול */}
                  <div className="shrink-0 flex flex-col items-center min-w-[36px]">
                    <p className="font-condensed text-lg font-bold tabular-nums text-amber-500">{s.exactCount}</p>
                    <p className="text-xs text-muted-foreground">בול</p>
                  </div>

                  {/* ניקוד */}
                  <div className="text-left shrink-0 flex flex-col items-center min-w-[52px]">
                    <p className={cn('font-condensed text-2xl font-bold tabular-nums leading-none', rankIdx < 3 ? rankStyles[rankIdx].points : 'text-primary')}>
                      {s.totalPoints}
                    </p>
                    <div className="flex items-center gap-1 mt-0.5">
                      <span className="text-xs text-muted-foreground">נק׳</span>
                      {liveBonus > 0 && (
                        <span className="flex items-center gap-0.5 text-xs font-bold text-orange-400 animate-pulse">
                          <Flame className="h-2.5 w-2.5" />+{liveBonus}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <PointsSplit match={s.matchPoints} bonus={s.bonusPoints} />
              </div>
            )
          })}
        </div>
      )}

      {isLiveMode && (
        <p className="text-center text-xs text-muted-foreground/60 mt-3">
          ניקוד חי זמני — יתעדכן בסיום המשחק
        </p>
      )}
    </div>
  )
}
