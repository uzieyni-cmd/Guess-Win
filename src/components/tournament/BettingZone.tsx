'use client'
import { useMemo } from 'react'
import { useTournament } from '@/context/TournamentContext'
import { useAuth } from '@/context/AuthContext'
import { MatchCard } from './MatchCard'
import { EmptyState } from '@/components/shared/EmptyState'
import { Target } from 'lucide-react'
import { Match } from '@/types'
import { MAX_JOKERS } from '@/app/actions/joker'
import { cn } from '@/lib/utils'

// ── Joker card icon (duplicated here to avoid re-import cycle) ────
function JokerCardIcon({ className, active }: { className?: string; active?: boolean }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <rect x="3" y="2" width="18" height="20" rx="2.5"
            stroke="currentColor" strokeWidth="1.5"
            fill={active ? 'currentColor' : 'none'}
            fillOpacity={active ? 0.18 : 0} />
      <path d="M12 7 L13.3 10.7 L17 12 L13.3 13.3 L12 17 L10.7 13.3 L7 12 L10.7 10.7 Z"
            fill="currentColor" />
    </svg>
  )
}

interface Props {
  matches: Match[]
}

export function BettingZone({ matches }: Props) {
  const { bets, participants, jokerPicks } = useTournament()
  const { currentUser } = useAuth()

  const sorted = useMemo(() => {
    return [...matches].sort((a, b) =>
      new Date(a.matchStartTime).getTime() - new Date(b.matchStartTime).getTime()
    )
  }, [matches])

  const grouped = useMemo(() => {
    const groups: Record<string, Match[]> = {}
    sorted.forEach((m) => {
      const key = new Date(m.matchStartTime).toLocaleDateString('he-IL', { weekday: 'long', day: 'numeric', month: 'long' })
      if (!groups[key]) groups[key] = []
      groups[key].push(m)
    })
    return groups
  }, [sorted])

  // ── Joker counter ─────────────────────────────────────────────
  const hasGroupStageMatches = sorted.some(m => m.round?.startsWith('Group Stage'))
  const myJokerCount = jokerPicks.filter(j => j.userId === currentUser?.id).length
  const jokersLeft = MAX_JOKERS - myJokerCount

  if (matches.length === 0) {
    return <EmptyState icon={Target} title="לא נקבעו משחקים עדיין" />
  }

  return (
    <div className="space-y-6">
      {/* ── Joker banner — שלב הבתים בלבד ─────────────────────── */}
      {hasGroupStageMatches && (
        <div className={cn(
          'flex items-center justify-between rounded-xl px-4 py-3 border transition-colors',
          jokersLeft === 0
            ? 'bg-violet-600/10 border-violet-500/30'
            : 'bg-violet-50 border-violet-200',
        )}>
          <div className="flex items-center gap-2.5">
            <JokerCardIcon className="h-5 w-5 text-violet-600" active />
            <div>
              <p className="text-sm font-bold text-violet-800">ג&apos;וקר — כפילת ניקוד</p>
              <p className="text-xs text-violet-600 leading-tight">
                סמן עד {MAX_JOKERS} משחקים בשלב הבתים לקבל ×2 על הניחוש
              </p>
            </div>
          </div>
          {/* Dots indicator */}
          <div className="flex items-center gap-1.5 shrink-0 mr-1" aria-label={`${myJokerCount} מתוך ${MAX_JOKERS} ג'וקרים`}>
            {Array.from({ length: MAX_JOKERS }).map((_, i) => (
              <div
                key={i}
                className={cn(
                  'w-7 h-7 rounded-full border-2 flex items-center justify-center transition-all',
                  i < myJokerCount
                    ? 'bg-violet-600 border-violet-600 text-white'
                    : 'border-violet-300 bg-transparent'
                )}
              >
                {i < myJokerCount && (
                  <JokerCardIcon className="h-3.5 w-3.5" active />
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {Object.entries(grouped).map(([date, dayMatches]) => (
        <div key={date}>
          <h3 className="text-sm font-semibold text-muted-foreground mb-3 px-1">{date}</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
            {dayMatches.map((match) => {
              const userBet = bets.find((b) => b.matchId === match.id && b.userId === currentUser?.id) ?? null
              return (
                <MatchCard
                  key={match.id}
                  match={match}
                  userBet={userBet}
                  allBets={bets}
                  participants={participants}
                />
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}
