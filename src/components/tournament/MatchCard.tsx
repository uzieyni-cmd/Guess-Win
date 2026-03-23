'use client'
import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Lock, ChevronDown, ChevronUp } from 'lucide-react'
import { Match, Bet } from '@/types'
import { useCountdown } from '@/hooks/useCountdown'
import { useTournament } from '@/context/TournamentContext'
import { useAuth } from '@/context/AuthContext'
import { TeamFlag } from '@/components/shared/TeamFlag'
import { CountdownTimer } from './CountdownTimer'
import { ScoreInput } from './ScoreInput'
import { PointsBadge } from '@/components/shared/PointsBadge'
import { calculateScore } from '@/lib/scoring'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

interface Props {
  match: Match
  userBet: Bet | null
  allBets: Bet[]
  participants: { id: string; displayName: string }[]
}

export function MatchCard({ match, userBet, allBets, participants }: Props) {
  const { isLocked } = useCountdown(match.matchStartTime)
  const { placeBet } = useTournament()
  const { currentUser } = useAuth()
  const [homeScore, setHomeScore] = useState<number | null>(userBet?.predictedScore.home ?? null)
  const [awayScore, setAwayScore] = useState<number | null>(userBet?.predictedScore.away ?? null)
  const [showOthers, setShowOthers] = useState(false)
  const isFinished = match.status === 'finished' || match.actualScore !== null
  const isInputLocked = isLocked || isFinished

  // שמירה אוטומטית כשמשתנה הניחוש
  useEffect(() => {
    if (homeScore !== null && awayScore !== null && !isInputLocked && currentUser) {
      placeBet(match.id, { home: homeScore, away: awayScore }, currentUser.id)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [homeScore, awayScore])

  const matchDate = new Date(match.matchStartTime)
  const dateStr = matchDate.toLocaleDateString('he-IL', { weekday: 'short', day: 'numeric', month: 'short' })
  const timeStr = matchDate.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })

  // ניחושי משתתפים אחרים (גלויים רק אחרי נעילה)
  const otherBets = (isLocked || isFinished)
    ? allBets.filter((b) => b.matchId === match.id && b.userId !== currentUser?.id)
    : []

  const userResult = isFinished && userBet && match.actualScore
    ? calculateScore(userBet, match)
    : null

  return (
    <motion.div layout initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
      <Card className={cn('overflow-hidden', isFinished && 'border-green-200')}>
        <div className="flex items-center justify-between px-4 py-2 bg-muted/50 text-xs text-muted-foreground">
          <CountdownTimer matchStartTime={match.matchStartTime} />
          <span>{dateStr} · {timeStr}</span>
        </div>

        <div className="p-4">
          <div className="flex items-center gap-3">
            <div className="flex-1 flex flex-col items-center gap-1">
              <TeamFlag team={match.homeTeam} size="md" />
              <span className="text-xs font-semibold text-center leading-tight">{match.homeTeam.name}</span>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <ScoreInput value={homeScore} onChange={setHomeScore} disabled={isInputLocked} />
              <span className="text-lg font-bold text-muted-foreground">:</span>
              <ScoreInput value={awayScore} onChange={setAwayScore} disabled={isInputLocked} />
            </div>
            <div className="flex-1 flex flex-col items-center gap-1">
              <TeamFlag team={match.awayTeam} size="md" />
              <span className="text-xs font-semibold text-center leading-tight">{match.awayTeam.name}</span>
            </div>
          </div>

          {isFinished && match.actualScore && (
            <div className="mt-3 flex items-center justify-center gap-2">
              <span className="text-xs text-muted-foreground">תוצאה:</span>
              <Badge variant="outline" className="font-bold text-sm">
                {match.actualScore.home} – {match.actualScore.away}
              </Badge>
              {userResult && <PointsBadge result={userResult.result} points={userResult.points} />}
            </div>
          )}

          {isLocked && !isFinished && (
            <div className="mt-2 flex items-center justify-center gap-1.5 text-xs text-amber-600">
              <Lock className="h-3 w-3" />
              <span>הניחושים נעולים — ממתינים לתוצאה</span>
            </div>
          )}
        </div>

        {(isLocked || isFinished) && otherBets.length > 0 && (
          <div className="border-t">
            <button
              className="w-full px-4 py-2 text-xs text-muted-foreground flex items-center justify-between hover:bg-muted/50 transition-colors"
              onClick={() => setShowOthers(!showOthers)}
            >
              <span>ניחושי שאר המשתתפים ({otherBets.length})</span>
              {showOthers ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            </button>
            <AnimatePresence>
              {showOthers && (
                <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} className="overflow-hidden">
                  <div className="px-4 pb-3 space-y-1.5">
                    {otherBets.map((bet) => {
                      const betUser = participants.find((u) => u.id === bet.userId)
                      const result = isFinished && match.actualScore ? calculateScore(bet, match) : null
                      return (
                        <div key={bet.id} className="flex items-center justify-between text-xs">
                          <span className="text-muted-foreground">{betUser?.displayName ?? 'משתתף'}</span>
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold">{bet.predictedScore.home} – {bet.predictedScore.away}</span>
                            {result && <PointsBadge result={result.result} points={result.points} />}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </Card>
    </motion.div>
  )
}
