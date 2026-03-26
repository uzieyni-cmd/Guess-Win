'use client'
import { useMemo } from 'react'
import { motion } from 'framer-motion'
import { TrendingUp, Target, Zap } from 'lucide-react'
import { useTournament } from '@/context/TournamentContext'
import { useAuth } from '@/context/AuthContext'
import { calculateScore } from '@/lib/scoring'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export default function StatsPage() {
  const { activeTournament, bets } = useTournament()
  const { currentUser } = useAuth()

  const stats = useMemo(() => {
    if (!activeTournament || !currentUser) return null
    const finishedMatches = activeTournament.matches.filter((m) => m.actualScore !== null)
    const userBets = bets.filter((b) => b.userId === currentUser.id && b.tournamentId === activeTournament.id)

    let exactHits = 0
    let outcomeHits = 0
    let misses = 0
    let totalPoints = 0

    for (const bet of userBets) {
      const match = finishedMatches.find((m) => m.id === bet.matchId)
      if (!match) continue
      const result = calculateScore(bet, match)
      if (result.result === 'exact') exactHits++
      else if (result.result === 'outcome') outcomeHits++
      else misses++
      totalPoints += result.points
    }

    const scored = exactHits + outcomeHits + misses
    const accuracy = scored > 0 ? Math.round(((exactHits + outcomeHits) / scored) * 100) : 0

    return { exactHits, outcomeHits, misses, totalPoints, scored, accuracy, pending: userBets.length - scored }
  }, [activeTournament, bets, currentUser])

  if (!stats) return <div className="text-center py-16 text-muted-foreground">טוען...</div>

  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <TrendingUp className="h-5 w-5 text-indigo-600" />
        <h2 className="font-suez text-xl text-slate-100">הסטטיסטיקה שלי</h2>
      </div>
      <div className="grid grid-cols-2 gap-3 mb-4">
        {[
          { label: 'סך הנקודות', value: stats.totalPoints, icon: Zap, color: 'text-indigo-600' },
          { label: 'דיוק', value: `${stats.accuracy}%`, icon: Target, color: 'text-green-600' },
          { label: 'פגיעות מדויקות', value: stats.exactHits, icon: Target, color: 'text-yellow-600' },
          { label: 'כיוון נכון', value: stats.outcomeHits, icon: Target, color: 'text-blue-600' },
        ].map((item, i) => (
          <motion.div key={item.label} initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.1 }}>
            <Card>
              <CardHeader className="pb-1 pt-4 px-4">
                <CardTitle className="text-xs text-muted-foreground font-medium">{item.label}</CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4">
                <p className={`text-3xl font-bold ${item.color}`}>{item.value}</p>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {stats.scored > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-sm">פירוט תוצאות</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {[
              { label: 'מדויק (10 נק׳)', value: stats.exactHits, total: stats.scored, color: 'bg-green-500' },
              { label: 'כיוון נכון (5 נק׳)', value: stats.outcomeHits, total: stats.scored, color: 'bg-blue-500' },
              { label: 'החטאה (0 נק׳)', value: stats.misses, total: stats.scored, color: 'bg-red-400' },
            ].map((bar) => (
              <div key={bar.label}>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-muted-foreground">{bar.label}</span>
                  <span className="font-medium">{bar.value}</span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${(bar.value / bar.total) * 100}%` }}
                    transition={{ duration: 0.6, ease: 'easeOut' }}
                    className={`h-full rounded-full ${bar.color}`}
                  />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
