'use client'
import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
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
    { label: 'תחרויות', value: tournaments.length, icon: Trophy, color: 'text-indigo-600' },
    { label: 'משתמשים', value: userCount, icon: Users, color: 'text-purple-600' },
    { label: 'סך ניחושים', value: bets.length, icon: Target, color: 'text-green-600' },
    { label: 'פעילות', value: tournaments.filter((t) => t.status === 'active').length, icon: BarChart2, color: 'text-amber-600' },
  ]

  return (
    <div className="p-6">
      <h1 className="font-suez text-2xl mb-6">סקירת מנהל</h1>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {stats.map((s, i) => (
          <motion.div key={s.label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}>
            <Card>
              <CardHeader className="pb-1 pt-4 px-4">
                <CardTitle className="text-xs text-muted-foreground">{s.label}</CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4">
                <div className="flex items-center gap-2">
                  <s.icon className={`h-5 w-5 ${s.color}`} />
                  <span className="text-3xl font-bold">{s.value}</span>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      <div className="space-y-4">
        <h2 className="font-semibold text-gray-700">כל התחרויות</h2>
        {tournaments.map((t) => (
          <Card key={t.id}>
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="font-medium">{t.name}</p>
                <p className="text-sm text-muted-foreground">{t.matches.length} משחקים · {t.participantIds.length} שחקנים</p>
              </div>
              <span className={`text-xs font-medium px-2 py-1 rounded-full ${t.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                {t.status === 'active' ? 'פעיל' : t.status === 'upcoming' ? 'בקרוב' : 'הסתיים'}
              </span>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
