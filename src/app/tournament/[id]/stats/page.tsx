'use client'
import { useMemo } from 'react'
import { TrendingUp, Target, Zap } from 'lucide-react'
import { useTournament } from '@/context/TournamentContext'
import { useAuth } from '@/context/AuthContext'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { LoadingState, EmptyState } from '@/components/shared/EmptyState'

export default function StatsPage() {
  const { activeTournament, bets } = useTournament()
  const { currentUser } = useAuth()

  const stats = useMemo(() => {
    if (!activeTournament || !currentUser) return null
    const userBets = bets.filter((b) => b.userId === currentUser.id && b.tournamentId === activeTournament.id)

    let exactHits = 0
    let outcomeHits = 0
    let misses = 0
    let totalPoints = 0

    for (const bet of userBets) {
      if (bet.points == null || bet.betResult == null) continue
      totalPoints += bet.points
      if (bet.betResult === 'exact') exactHits++
      else if (bet.betResult === 'outcome') outcomeHits++
      else misses++
    }

    const scored = exactHits + outcomeHits + misses
    const accuracy = scored > 0 ? Math.round(((exactHits + outcomeHits) / scored) * 100) : 0

    return { exactHits, outcomeHits, misses, totalPoints, scored, accuracy, pending: userBets.length - scored, totalBets: userBets.length }
  }, [activeTournament, bets, currentUser])

  if (!activeTournament) return <LoadingState />
  if (!stats || stats.totalBets === 0) return <EmptyState icon={TrendingUp} title="אין סטטיסטיקות עדיין" subtitle="הגש ניחושים כדי לראות את הסטטיסטיקה שלך" />

  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <TrendingUp className="h-5 w-5 text-emerald-500" />
        <h2 className="font-suez text-xl text-slate-100">הסטטיסטיקה שלי</h2>
      </div>
      <div className="grid grid-cols-2 gap-3 mb-4 stagger">
        {[
          { label: 'סך הנקודות', value: stats.totalPoints, icon: Zap, color: 'text-emerald-500' },
          { label: 'דיוק', value: `${stats.accuracy}%`, icon: Target, color: 'text-green-400' },
          { label: 'פגיעות מדויקות', value: stats.exactHits, icon: Target, color: 'text-yellow-400' },
          { label: 'כיוון נכון', value: stats.outcomeHits, icon: Target, color: 'text-blue-400' },
        ].map((item) => (
          <div key={item.label} className="animate-pop-in">
            <Card>
              <CardHeader className="pb-1 pt-4 px-4">
                <CardTitle className="text-xs text-muted-foreground font-medium">{item.label}</CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4">
                <p className={`text-3xl font-bold ${item.color}`}>{item.value}</p>
              </CardContent>
            </Card>
          </div>
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
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${bar.color}`}
                    style={{ width: `${(bar.value / bar.total) * 100}%` }}
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
