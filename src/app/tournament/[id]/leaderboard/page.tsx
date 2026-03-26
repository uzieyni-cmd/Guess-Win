'use client'
import { motion } from 'framer-motion'
import { BarChart2 } from 'lucide-react'
import { useTournament } from '@/context/TournamentContext'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { cn } from '@/lib/utils'

const rankStyles = [
  { text: 'text-yellow-400', bg: 'bg-yellow-400/20 border border-yellow-400/40', label: '1' },
  { text: 'text-slate-300',  bg: 'bg-slate-300/20 border border-slate-300/40',   label: '2' },
  { text: 'text-amber-500',  bg: 'bg-amber-500/20 border border-amber-500/40',   label: '3' },
]

export default function LeaderboardPage() {
  const { standings } = useTournament()

  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <BarChart2 className="h-5 w-5 text-indigo-600" />
        <h2 className="font-suez text-xl text-slate-100">טבלת דירוג</h2>
      </div>
      {standings.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">אין תוצאות עדיין.</div>
      ) : (
        <div className="space-y-2">
          {standings.map((s, i) => (
            <motion.div
              key={s.user.id}
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.05 }}
              className={cn(
                'flex items-center gap-3 p-3 rounded-xl bg-white border',
                i === 0 && 'border-yellow-300 bg-yellow-50',
                i === 1 && 'border-slate-300 bg-slate-50',
                i === 2 && 'border-amber-300 bg-amber-50'
              )}
            >
              <div className={cn(
                'w-8 h-8 flex items-center justify-center rounded-full text-sm font-bold shrink-0',
                i < 3 ? rankStyles[i].bg + ' ' + rankStyles[i].text : 'text-muted-foreground'
              )}>
                {i < 3 ? rankStyles[i].label : `${s.rank}`}
              </div>
              <Avatar className="h-9 w-9">
                <AvatarFallback className="bg-indigo-100 text-indigo-700 text-sm font-bold">
                  {s.user.displayName.charAt(0)}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm truncate">{s.user.displayName}</p>
                <p className="text-xs text-muted-foreground">{s.betResults.length} ניחושים עם ניקוד</p>
              </div>
              <div className="text-left">
                <motion.p
                  key={s.totalPoints}
                  initial={{ scale: 1.2 }}
                  animate={{ scale: 1 }}
                  className="text-xl font-bold text-indigo-700"
                >
                  {s.totalPoints}
                </motion.p>
                <p className="text-xs text-muted-foreground">נק׳</p>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  )
}
