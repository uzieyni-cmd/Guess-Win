'use client'
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Image from 'next/image'
import { Gift, Square, Goal, Crosshair, Crown, RotateCcw, TrendingUp, TrendingDown } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { LoadingState, EmptyState } from '@/components/shared/EmptyState'

interface BonusStats {
  totalGoals: number
  yellowCards: number
  redCards: number
  penalties: number
  ownGoals: number
  topScorers: { name: string; team: string; photo: string | null; goals: number; assists: number | null }[]
  matchCount: number
  lastSyncedAt: string | null
}

const TOTAL_MATCHES = 104

const medalStyles = [
  'bg-yellow-400/20 border border-yellow-500/50 text-yellow-600',
  'bg-slate-400/15 border border-slate-400/50 text-slate-500',
  'bg-amber-500/15 border border-amber-500/50 text-amber-600',
  'bg-muted border border-border text-muted-foreground',
  'bg-muted border border-border text-muted-foreground',
]

export default function BonusStatsPage() {
  const { id } = useParams() as { id: string }
  const [stats, setStats] = useState<BonusStats | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`/api/bonus-stats/${id}`)
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(setStats)
      .catch(() => setError('לא ניתן לטעון את נתוני הסטטיסטיקה'))
      .finally(() => setLoading(false))
  }, [id])

  if (loading) return <LoadingState />
  if (error) return <p className="text-center py-16 text-muted-foreground">{error}</p>
  if (!stats) return <EmptyState icon={Gift} title="אין נתונים עדיין" subtitle="הנתונים יופיעו לאחר משחקים שהסתיימו" />

  const cards = [
    { label: 'שערים', value: stats.totalGoals, icon: Goal, color: 'text-primary', line: 291.5 },
    { label: 'כרטיסים צהובים', value: stats.yellowCards, icon: Square, color: 'text-yellow-500', line: 374.5 },
    { label: 'כרטיסים אדומים', value: stats.redCards, icon: Square, color: 'text-red-600', line: 13.5 },
    { label: 'פנדלים שהוכנסו', value: stats.penalties, icon: Crosshair, color: 'text-emerald-600', line: 31.5 },
    { label: 'שערים עצמיים', value: stats.ownGoals, icon: RotateCcw, color: 'text-blue-600', line: 9.5 },
  ]

  return (
    <div>
      <div className="flex items-center gap-2 mb-1">
        <Gift className="h-5 w-5 text-primary" />
        <h2 className="font-suez text-xl text-foreground">סטטיסטיקת בונוסים</h2>
        <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
          {stats.matchCount} משחקים שהסתיימו
        </span>
      </div>
      {stats.lastSyncedAt && (
        <p className="text-[11px] text-muted-foreground mb-4">
          עודכן לאחרונה: {new Date(stats.lastSyncedAt).toLocaleString('he-IL', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
        </p>
      )}

      <div className="grid grid-cols-2 gap-3 mb-4 stagger">
        {cards.map((item) => (
          <div key={item.label} className="animate-pop-in">
            <Card>
              <CardHeader className="pb-1 pt-4 px-4 flex items-center gap-2 flex-row">
                <item.icon className={`h-4 w-4 ${item.color} shrink-0`} />
                <CardTitle className="text-xs text-muted-foreground font-medium">{item.label}</CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4">
                <p className={`text-3xl font-bold ${item.color}`}>{item.value}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {item.value > item.line
                    ? <span className="font-bold text-emerald-600">מעל</span>
                    : <span className="font-bold text-red-500">מתחת</span>}
                  {' '}{item.line}
                </p>
                {stats.matchCount > 0 && (() => {
                  const projected = (item.value / stats.matchCount) * TOTAL_MATCHES
                  const isOver = projected > item.line
                  const TrendIcon = isOver ? TrendingUp : TrendingDown
                  const trendColor = isOver ? 'text-emerald-600' : 'text-red-500'
                  return (
                    <p className={`text-[11px] mt-0.5 flex items-center gap-1 ${trendColor}`}>
                      <TrendIcon className="h-3 w-3 shrink-0" />
                      תחזית: {isOver ? 'מעל' : 'מתחת'} {item.line}
                    </p>
                  )
                })()}
              </CardContent>
            </Card>
          </div>
        ))}
      </div>

      {stats.topScorers.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <Crown className="h-4 w-4 text-amber-500" />
              מלכי השערים
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {stats.topScorers.map((p, i) => (
              <div key={i} className="flex items-center gap-3 p-2 rounded-xl bg-muted/40">
                <div className={`w-8 h-8 flex items-center justify-center rounded-full font-condensed text-lg font-bold shrink-0 ${medalStyles[i]}`}>
                  {i + 1}
                </div>
                {p.photo && (
                  <Image src={p.photo} alt={p.name} width={36} height={36} unoptimized className="rounded-full shrink-0 object-cover" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm truncate text-foreground">{p.name}</p>
                  <p className="text-xs text-muted-foreground truncate">{p.team}</p>
                </div>
                <div className="text-left shrink-0">
                  <p className="font-condensed text-2xl font-bold tabular-nums text-primary leading-none">{p.goals}</p>
                  <p className="text-[10px] text-muted-foreground tabular-nums" dir="rtl">{p.assists ?? 0} בישולים</p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
