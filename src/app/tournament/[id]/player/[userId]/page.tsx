'use client'
import { useMemo } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useTournament } from '@/context/TournamentContext'
import { TeamFlag } from '@/components/shared/TeamFlag'
import { PointsBadge } from '@/components/shared/PointsBadge'
import { EmptyState } from '@/components/shared/EmptyState'
import { ArrowRight, User, Zap } from 'lucide-react'
import { cn } from '@/lib/utils'
import { ScoreResult } from '@/types'

export default function PlayerDetailPage() {
  const { id: tournamentId, userId } = useParams() as { id: string; userId: string }
  const router = useRouter()
  const { activeTournament, bets, participants, jokerPicks } = useTournament()

  const player = participants.find(p => p.id === userId)

  const rows = useMemo(() => {
    if (!activeTournament) return []

    const matchMap = new Map(activeTournament.matches.map(m => [m.id, m]))
    const jokerMatchIds = new Set(
      jokerPicks.filter(j => j.userId === userId).map(j => j.matchId)
    )

    return bets
      .filter(b =>
        b.userId === userId &&
        b.tournamentId === tournamentId &&
        (b.points !== null || (b.teamBonusPick ?? 0) > 0)
      )
      .map(b => ({
        bet: b,
        match: matchMap.get(b.matchId)!,
        hasJoker: jokerMatchIds.has(b.matchId),
        total: (b.points ?? 0) + (b.teamBonusPick ?? 0),
      }))
      .filter(r => r.match && r.match.status === 'finished')
      .sort((a, b) =>
        new Date(a.match.matchStartTime).getTime() - new Date(b.match.matchStartTime).getTime()
      )
  }, [activeTournament, bets, jokerPicks, userId, tournamentId])

  const totalPoints = rows.reduce((sum, r) => sum + r.total, 0)

  return (
    <div className="min-h-screen bg-base">
      {/* Back */}
      <div className="px-4 pt-3 pb-1">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors text-sm"
        >
          <ArrowRight className="h-4 w-4" />
          חזרה
        </button>
      </div>

      {/* Header */}
      <div className="px-4 py-4 border-b border-border bg-card">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
            <User className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="font-suez text-lg text-foreground">{player?.displayName ?? 'משתתף'}</h1>
            <p className="text-xs text-muted-foreground">{rows.length} משחקים עם ניקוד · {totalPoints} נק׳ סה״כ</p>
          </div>
        </div>
      </div>

      {/* Rows */}
      <div className="px-4 py-4">
        {rows.length === 0 ? (
          <EmptyState icon={User} title="אין ניחושים עם ניקוד עדיין" subtitle="" />
        ) : (
          <div className="space-y-3">
            {rows.map(({ bet, match, hasJoker, total }) => {
              const base = bet.points ?? 0
              const teamBonus = bet.teamBonusPick ?? 0

              return (
                <div
                  key={bet.matchId}
                  className={cn(
                    'bg-card rounded-2xl border border-border p-4',
                    hasJoker && 'border-red-300/60 bg-red-50/40'
                  )}
                >
                  {/* קבוצות + תוצאה */}
                  <div className="flex items-center gap-2 mb-3">
                    <TeamFlag team={match.homeTeam} size="sm" />
                    <span className="text-xs font-semibold text-foreground truncate max-w-[70px]">{match.homeTeam.name}</span>

                    <div className="flex-1 flex flex-col items-center gap-0.5">
                      <span className="font-mono font-black text-base tabular-nums text-foreground">
                        {match.actualScore?.home ?? '–'}:{match.actualScore?.away ?? '–'}
                      </span>
                      <span className="text-[10px] text-muted-foreground">תוצאה</span>
                    </div>

                    <span className="text-xs font-semibold text-foreground truncate max-w-[70px] text-right">{match.awayTeam.name}</span>
                    <TeamFlag team={match.awayTeam} size="sm" />
                  </div>

                  {/* ניחוש + נקודות */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">ניחוש:</span>
                      {bet.predictedScore.home === undefined || bet.predictedScore.home === 0 && bet.predictedScore.away === 0 && base === 0 && teamBonus > 0 ? (
                        <span className="text-xs text-muted-foreground">—</span>
                      ) : (
                        <span className="font-mono font-bold text-sm tabular-nums text-foreground">
                          {bet.predictedScore.home}:{bet.predictedScore.away}
                        </span>
                      )}
                      {hasJoker && (
                        <span className="flex items-center gap-0.5 text-[10px] font-bold text-red-600">
                          <Zap className="h-3 w-3 fill-red-600" />
                          ג׳וקר
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5">
                      {/* פירוט נקודות */}
                      <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                        {base > 0 && <span>{base} ניחוש</span>}
                        {teamBonus > 0 && <span>+{teamBonus} מדורגת</span>}
                      </div>
                      {bet.betResult && (base > 0 || teamBonus > 0) && (
                        <PointsBadge result={bet.betResult as ScoreResult} points={total} />
                      )}
                      {bet.betResult && base === 0 && teamBonus === 0 && (
                        <PointsBadge result="miss" points={0} />
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
