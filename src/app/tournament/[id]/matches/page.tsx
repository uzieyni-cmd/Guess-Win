'use client'
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { useTournament } from '@/context/TournamentContext'
import { useAuth } from '@/context/AuthContext'
import { BettingZone } from '@/components/tournament/BettingZone'
import { BettingZoneSkeleton } from '@/components/tournament/MatchCardSkeleton'
import { Target, Trophy } from 'lucide-react'

export default function MatchesPage() {
  const { id } = useParams() as { id: string }
  const { activeTournament, reloadMatches, bets, betsReady, standings } = useTournament()
  const { currentUser } = useAuth()

  const [hideFinished, setHideFinished] = useState(true)

  // ── טעינה ראשונית — כל המשחקים ─────────────────────────────────
  useEffect(() => {
    if (!id) return
    reloadMatches(id, { all: true })
  }, [id]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!activeTournament || !betsReady) {
    return <BettingZoneSkeleton />
  }

  const isLoadingMatches = activeTournament.matches.length > 0 && activeTournament.matches.every(m => !m.homeTeam)
  const realMatches = activeTournament.matches.filter(m => !!m.homeTeam)
  const finishedCount = realMatches.filter(m => m.status === 'finished').length
  const upcomingCount = realMatches.length - finishedCount
  const showFilterToggle = finishedCount > 0 && upcomingCount > 0
  const showingFinished = showFilterToggle ? !hideFinished : (finishedCount > 0 && upcomingCount === 0)
  const visibleMatches = (() => {
    const filtered = showFilterToggle
      ? (hideFinished
          ? realMatches.filter(m => m.status !== 'finished')
          : realMatches.filter(m => m.status === 'finished'))
      : realMatches
    return filtered
  })()

  // ── סיכום אישי — ניקוד / מיקום / פגיעות / ניחושים שמולאו ───────
  const myStanding = standings.find(s => s.user.id === currentUser?.id)
  const myBets = bets.filter(b => b.userId === currentUser?.id)
  const correctOutcomeCount = myBets.filter(b => b.betResult === 'outcome').length
  const placedCount = myBets.length
  const progressPct = realMatches.length > 0 ? Math.round((placedCount / realMatches.length) * 100) : 0

  return (
    <div>
      {/* שם הטורניר + לוגו */}
      <div className="flex items-center gap-3 mb-6 pb-5 border-b border-border/50">
        {activeTournament.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={activeTournament.logoUrl} alt={activeTournament.name}
            className="h-14 w-14 object-contain rounded-lg shrink-0" />
        ) : (
          <Trophy className="h-10 w-10 text-muted-foreground/50 shrink-0" />
        )}
        <h1 className="font-suez text-2xl text-foreground leading-tight">{activeTournament.name}</h1>
      </div>

      {/* כרטיס סיכום אישי */}
      {currentUser && (
        <div className="rounded-2xl border border-border bg-card p-4 mb-6">
          <div className="grid grid-cols-4 gap-2 text-center mb-4">
            {[
              { label: 'נקודות', value: myStanding?.totalPoints ?? 0 },
              { label: 'מיקום', value: myStanding ? `#${myStanding.rank}` : '#' },
              { label: 'פגיעות בול', value: myStanding?.exactCount ?? 0 },
              { label: 'כיוון נכון', value: correctOutcomeCount },
            ].map(({ label, value }) => (
              <div key={label}>
                <p className="font-condensed text-xl font-bold text-foreground tabular-nums">{value}</p>
                <p className="text-xs text-muted-foreground">{label}</p>
              </div>
            ))}
          </div>

          {/* פירוק ניקוד: משחקים + בונוס = כולל */}
          <div className="grid grid-cols-3 gap-2 mb-4 rounded-xl border border-border/60 bg-muted/40 p-2.5">
            <div className="text-center">
              <p className="font-condensed text-lg font-bold text-foreground tabular-nums">{myStanding?.matchPoints ?? 0}</p>
              <p className="text-[11px] text-muted-foreground">ניקוד משחקים</p>
            </div>
            <div className="text-center border-x border-border/60">
              <p className="font-condensed text-lg font-bold text-emerald-600 tabular-nums">{myStanding?.bonusPoints ?? 0}</p>
              <p className="text-[11px] text-muted-foreground">ניקוד בונוס</p>
            </div>
            <div className="text-center">
              <p className="font-condensed text-lg font-bold text-primary tabular-nums">{myStanding?.totalPoints ?? 0}</p>
              <p className="text-[11px] text-muted-foreground">ניקוד כולל</p>
            </div>
          </div>

          <div className="flex items-center justify-between text-xs mb-1.5">
            <span className="font-bold text-foreground tabular-nums">{progressPct}%</span>
            <span className="font-semibold text-foreground/80">ניחושים: {placedCount} / {realMatches.length}</span>
          </div>
          <div className="h-2.5 rounded-full bg-muted border border-border/60 overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-l from-red-500 to-red-600 shadow-[0_0_6px_rgba(239,68,68,0.5)] transition-all duration-500"
              style={{ width: progressPct > 0 ? `max(${progressPct}%, 10px)` : '0px' }}
            />
          </div>
        </div>
      )}

      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Target className="h-5 w-5 text-primary" />
          <h2 className="font-suez text-xl text-foreground">ניחושי משחקים</h2>
          {realMatches.length > 0 && (
            <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
              {realMatches.length} משחקים
            </span>
          )}
        </div>

        {/* מתג קרובים / שוחקו */}
        {showFilterToggle && (
          <div className="flex items-center gap-1 bg-muted rounded-full p-1">
            <button
              onClick={() => setHideFinished(true)}
              className={`text-xs font-semibold rounded-full px-3 py-1.5 transition-colors cursor-pointer min-h-[36px] ${
                hideFinished
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              קרובים
            </button>
            <button
              onClick={() => setHideFinished(false)}
              className={`text-xs font-semibold rounded-full px-3 py-1.5 transition-colors cursor-pointer min-h-[36px] ${
                !hideFinished
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              שוחקו ({finishedCount})
            </button>
          </div>
        )}
      </div>

      {isLoadingMatches ? <BettingZoneSkeleton /> : <BettingZone matches={visibleMatches} sortAscending={!showingFinished} />}
    </div>
  )
}
