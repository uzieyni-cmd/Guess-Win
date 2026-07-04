'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Gift, ChevronLeft } from 'lucide-react'
import { getBonusQuestions } from '@/app/actions/bonus'
import { cn } from '@/lib/utils'

// ספירה לאחור עד lockTime — מחזיר null כשאין זמן / חלף
function useCountdown(lockTime: string | null) {
  const calc = () => {
    if (!lockTime) return null
    const diff = new Date(lockTime).getTime() - Date.now()
    if (diff <= 0) return null
    const totalSec = Math.floor(diff / 1000)
    return {
      days:    Math.floor(totalSec / 86400),
      hours:   Math.floor((totalSec % 86400) / 3600),
      minutes: Math.floor((totalSec % 3600) / 60),
      seconds: totalSec % 60,
      totalSec,
    }
  }
  const [r, setR] = useState(calc)
  useEffect(() => {
    setR(calc())
    const id = setInterval(() => setR(calc()), 1000)
    return () => clearInterval(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lockTime])
  return r
}

// באנר תזכורת: מוצג רק אם יש בונוס פתוח אחד לפחות (lockTime בעתיד).
// הספירה היא עד המועד המאוחר ביותר להיסגר — כלומר מתי הבונוס האחרון ננעל.
export function BonusCountdownBanner({ tournamentId }: { tournamentId: string }) {
  const [lockTime, setLockTime] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    getBonusQuestions(tournamentId).then(qs => {
      if (cancelled) return
      const now = Date.now()
      const last = qs
        .map(q => q.lockTime)
        .filter(t => new Date(t).getTime() > now)
        .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0]
      setLockTime(last ?? null)
    }).catch(() => { /* אין הרשאה / שגיאה — פשוט לא נציג באנר */ })
    return () => { cancelled = true }
  }, [tournamentId])

  const r = useCountdown(lockTime)
  if (!r) return null

  const pad = (n: number) => String(n).padStart(2, '0')
  const urgent  = r.totalSec < 5 * 60
  const warning = r.totalSec < 60 * 60
  const blocks  = [
    { value: String(r.days), label: 'ימים' },
    { value: pad(r.hours),   label: 'שעות' },
    { value: pad(r.minutes), label: 'דקות' },
    { value: pad(r.seconds), label: 'שניות' },
  ]

  return (
    <Link
      href={`/tournament/${tournamentId}/bonus`}
      className={cn(
        'flex items-center gap-3 w-full rounded-2xl px-4 py-3 mb-3 transition-colors',
        urgent ? 'bg-destructive/90 hover:bg-destructive' : 'bg-foreground hover:bg-foreground/90'
      )}
    >
      <div className="flex items-center gap-2 shrink-0">
        <Gift className={cn('h-5 w-5 shrink-0', urgent ? 'text-white' : 'text-primary')} />
        <div className="flex flex-col leading-tight">
          <span className="text-sm font-semibold text-white">בונוסים פתוחים</span>
          <span className={cn('text-[11px]', urgent ? 'text-white/80' : 'text-white/50')}>סגירה בעוד</span>
        </div>
      </div>

      <div className="flex-1" />

      <div className="flex items-center gap-2" dir="ltr">
        {blocks.map(({ value, label }) => (
          <div key={label} className="flex flex-col items-center min-w-[30px]">
            <span className={cn('font-condensed tabular-nums text-2xl font-black leading-none',
              urgent ? 'text-white' : warning ? 'text-amber-400' : 'text-primary'
            )}>
              {value}
            </span>
            <span className={cn('text-[9px] tracking-wider uppercase', urgent ? 'text-white/70' : 'text-white/40')}>
              {label}
            </span>
          </div>
        ))}
      </div>

      <ChevronLeft className={cn('h-4 w-4 shrink-0', urgent ? 'text-white/80' : 'text-white/50')} />
    </Link>
  )
}
