'use client'
import { useMemo } from 'react'
import { motion } from 'framer-motion'
import { User } from 'lucide-react'
import { useTournament } from '@/context/TournamentContext'
import { useAuth } from '@/context/AuthContext'
import { calculateScore } from '@/lib/scoring'
import { PointsBadge } from '@/components/shared/PointsBadge'
import { TeamFlag } from '@/components/shared/TeamFlag'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

export default function PersonalPage() {
  const { activeTournament, bets } = useTournament()
  const { currentUser } = useAuth()

  const myBets = useMemo(() => {
    if (!activeTournament || !currentUser) return []
    const matchMap = new Map(activeTournament.matches.map((m) => [m.id, m]))
    return bets
      .filter((b) => b.userId === currentUser.id && b.tournamentId === activeTournament.id)
      .map((bet) => {
        const match = matchMap.get(bet.matchId)!
        const result = match?.actualScore ? calculateScore(bet, match) : null
        return { bet, match, result }
      })
      .filter((x) => x.match)
      .sort((a, b) => new Date(a.match.matchStartTime).getTime() - new Date(b.match.matchStartTime).getTime())
  }, [activeTournament, bets, currentUser])

  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <User className="h-5 w-5 text-emerald-500" />
        <h2 className="font-suez text-xl text-slate-100">הניחושים שלי</h2>
      </div>
      {myBets.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">לא הגשת ניחושים עדיין.</div>
      ) : (
        <div className="space-y-3">
          {myBets.map(({ bet, match, result }, i) => (
            <motion.div key={bet.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
              <Card>
                <CardContent className="p-3">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <TeamFlag team={match.homeTeam} size="sm" />
                      <span className="text-xs font-medium truncate">{match.homeTeam.name}</span>
                      <span className="text-muted-foreground text-xs">נגד</span>
                      <span className="text-xs font-medium truncate">{match.awayTeam.name}</span>
                      <TeamFlag team={match.awayTeam} size="sm" />
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Badge variant="outline" className="font-mono font-bold text-sm">
                        {bet.predictedScore.home}–{bet.predictedScore.away}
                      </Badge>
                      {match.actualScore && (
                        <span className="text-xs text-muted-foreground">
                          ({match.actualScore.home}–{match.actualScore.away})
                        </span>
                      )}
                      {result && <PointsBadge result={result.result} points={result.points} />}
                      {!result && (
                        <Badge variant="secondary" className="text-xs">ממתין</Badge>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  )
}
