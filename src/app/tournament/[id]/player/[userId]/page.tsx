'use client'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useTournament } from '@/context/TournamentContext'
import { PointsBadge } from '@/components/shared/PointsBadge'
import { EmptyState } from '@/components/shared/EmptyState'
import { LoadingState } from '@/components/shared/EmptyState'
import { ArrowRight, User, Zap } from 'lucide-react'
import { cn } from '@/lib/utils'
import { ScoreResult } from '@/types'
import Image from 'next/image'

interface PlayerBetRow {
  matchId: string
  matchStartTime: string
  homeTeam: { name: string; flag: string; id: string }
  awayTeam: { name: string; flag: string; id: string }
  actualScore: { home: number; away: number }
  predictedScore: { home: number; away: number }
  points: number | null
  betResult: string | null
  teamBonusPick: number
  hasJoker: boolean
  total: number
}

export default function PlayerDetailPage() {
  const { id: tournamentId, userId } = useParams() as { id: string; userId: string }
  const router = useRouter()
  const { participants } = useTournament()

  const [rows, setRows] = useState<PlayerBetRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const player = participants.find(p => p.id === userId)

  useEffect(() => {
    fetch(`/api/player-bets/${tournamentId}/${userId}`)
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(d => setRows(d.rows))
      .catch(() => setError('לא ניתן לטעון נתונים'))
      .finally(() => setLoading(false))
  }, [tournamentId, userId])

  const totalPoints = rows.reduce((sum, r) => sum + r.total, 0)

  if (loading) return <LoadingState />
  if (error) return <p className="text-center py-16 text-muted-foreground">{error}</p>

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
            {rows.map((row) => {
              const base = row.points ?? 0
              const teamBonus = row.teamBonusPick ?? 0
              const isPureTeamBonus = base === 0 && teamBonus > 0 && !row.betResult

              return (
                <div
                  key={row.matchId}
                  className={cn(
                    'bg-card rounded-2xl border border-border p-4',
                    row.hasJoker && 'border-red-300/60 bg-red-50/40'
                  )}
                >
                  {/* קבוצות + תוצאה — כמו MatchCard: בית ראשון בDOM (מימין ב-RTL), חוץ אחרון (משמאל) */}
                  <div className="flex items-center gap-2 mb-3">
                    {/* בית — ימין */}
                    <div className="flex-1 flex items-center gap-1.5 min-w-0 justify-center flex-col">
                      {row.homeTeam.flag && (
                        <Image src={row.homeTeam.flag} alt={row.homeTeam.name} width={28} height={20} unoptimized className="rounded-sm shrink-0 object-cover" />
                      )}
                      <span className="text-xs font-semibold text-foreground text-center leading-tight">{row.homeTeam.name}</span>
                    </div>

                    {/* ניקוד — מרכז */}
                    <div className="flex flex-col items-center gap-0.5 shrink-0 min-w-[56px]">
                      <span className="font-mono font-black text-base tabular-nums text-foreground" dir="ltr">
                        {row.actualScore.away}:{row.actualScore.home}
                      </span>
                      <span className="text-[10px] text-muted-foreground">תוצאה</span>
                    </div>

                    {/* חוץ — שמאל */}
                    <div className="flex-1 flex items-center gap-1.5 min-w-0 justify-center flex-col">
                      {row.awayTeam.flag && (
                        <Image src={row.awayTeam.flag} alt={row.awayTeam.name} width={28} height={20} unoptimized className="rounded-sm shrink-0 object-cover" />
                      )}
                      <span className="text-xs font-semibold text-foreground text-center leading-tight">{row.awayTeam.name}</span>
                    </div>
                  </div>

                  {/* ניחוש + נקודות */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {!isPureTeamBonus && (
                        <>
                          <span className="text-xs text-muted-foreground">ניחוש:</span>
                          <span className="font-mono font-bold text-sm tabular-nums text-foreground">
                            {row.predictedScore.away}:{row.predictedScore.home}
                          </span>
                        </>
                      )}
                      {row.hasJoker && (
                        <span className="flex items-center gap-0.5 text-[10px] font-bold text-red-600">
                          <Zap className="h-3 w-3 fill-red-600" />
                          ג׳וקר
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5">
                      <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                        {row.betResult === 'exact' && <span>בול</span>}
                        {row.betResult === 'outcome' && <span>כיוון</span>}
                        {teamBonus > 0 && <span>+{teamBonus} מדורגת</span>}
                      </div>
                      {row.betResult && (
                        <PointsBadge result={row.betResult as ScoreResult} points={row.total} />
                      )}
                      {!row.betResult && teamBonus > 0 && (
                        <PointsBadge result="outcome" points={teamBonus} />
                      )}
                      {!row.betResult && base === 0 && teamBonus === 0 && (
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
