'use client'
import { useEffect, useState } from 'react'
import { Trophy, Users, Target, BarChart2 } from 'lucide-react'
import { useTournament } from '@/context/TournamentContext'
import { supabase } from '@/lib/supabase'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export default function AdminOverviewPage() {
  const { tournaments, bets } = useTournament()
  const [userCount, setUserCount] = useState(0)

  useEffect(() => {
    supabase.from('profiles').select('id', { count: 'exact', head: true })
      .then(({ count }) => setUserCount(count ?? 0))
  }, [])

  const stats = [
    { label: 'תחרויות',   value: tournaments.length,                                        icon: Trophy,    color: 'text-emerald-600', bg: 'bg-emerald-500/10' },
    { label: 'משתמשים',   value: userCount,                                                  icon: Users,     color: 'text-blue-600',    bg: 'bg-blue-500/10'    },
    { label: 'סך ניחושים', value: bets.length,                                               icon: Target,    color: 'text-amber-600',   bg: 'bg-amber-500/10'   },
    { label: 'תחרויות פעילות', value: tournaments.filter((t) => t.status === 'active').length, icon: BarChart2, color: 'text-orange-600', bg: 'bg-orange-500/10'  },
  ]

  return (
    <div className="p-6 max-w-4xl">
      <h1 className="font-suez text-2xl text-foreground mb-6">סקירת מנהל</h1>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8 stagger">
        {stats.map((s) => (
          <div key={s.label} className="animate-fade-up">
            <div className="rounded-xl bg-card border border-border p-4">
              <p className="text-xs text-muted-foreground mb-2">{s.label}</p>
              <div className="flex items-center gap-2.5">
                <div className={`p-1.5 rounded-lg ${s.bg}`}>
                  <s.icon className={`h-4 w-4 ${s.color}`} />
                </div>
                <span className="text-3xl font-bold text-foreground">{s.value}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="space-y-2">
        <h2 className="text-sm font-medium text-muted-foreground mb-3">כל התחרויות</h2>
        {tournaments.map((t) => (
          <div key={t.id} className="flex items-center justify-between rounded-xl bg-card border border-border/60 px-4 py-3">
            <div>
              <p className="font-medium text-foreground text-sm">{t.name}</p>
              <p className="text-xs text-muted-foreground">{t.matches.length} משחקים · {t.participantIds.length} שחקנים</p>
            </div>
            <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${
              t.status === 'active'   ? 'bg-emerald-100 text-emerald-700' :
              t.status === 'upcoming' ? 'bg-blue-100 text-blue-700' :
                                        'bg-muted text-muted-foreground'
            }`}>
              {t.status === 'active' ? 'פעיל' : t.status === 'upcoming' ? 'בקרוב' : 'הסתיים'}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
