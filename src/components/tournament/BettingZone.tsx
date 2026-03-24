'use client'
import { useMemo } from 'react'
import { AnimatePresence } from 'framer-motion'
import { useTournament } from '@/context/TournamentContext'
import { useAuth } from '@/context/AuthContext'
import { MatchCard } from './MatchCard'
import { Match } from '@/types'

interface Props {
  matches: Match[]
}

export function BettingZone({ matches }: Props) {
  const { bets, participants } = useTournament()
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

  if (matches.length === 0) {
    return <div className="text-center py-16 text-muted-foreground"><p>לא נקבעו משחקים עדיין.</p></div>
  }

  return (
    <div className="space-y-6">
      {Object.entries(grouped).map(([date, dayMatches]) => (
        <div key={date}>
          <h3 className="text-sm font-semibold text-muted-foreground mb-3 px-1">{date}</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
            <AnimatePresence>
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
            </AnimatePresence>
          </div>
        </div>
      ))}
    </div>
  )
}
