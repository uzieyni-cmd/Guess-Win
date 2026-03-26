'use client'
import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Lock, Check, Save, AlertCircle, Users, X } from 'lucide-react'
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
import { cn } from '@/lib/utils'

const ROUND_MAP: Record<string, string> = {
  // UCL שלב ליגה
  'League Stage - 1': 'שלב הליגה - 1',
  'League Stage - 2': 'שלב הליגה - 2',
  'League Stage - 3': 'שלב הליגה - 3',
  'League Stage - 4': 'שלב הליגה - 4',
  'League Stage - 5': 'שלב הליגה - 5',
  'League Stage - 6': 'שלב הליגה - 6',
  'League Stage - 7': 'שלב הליגה - 7',
  'League Stage - 8': 'שלב הליגה - 8',
  // שלבי נוק-אאוט — פורמט קצר (כפי שמגיע מ-API)
  'Round of 32':  'סיבוב 32',
  'Round of 16':  'שמינית גמר',
  'Quarter-finals': 'רבע גמר',
  'Semi-finals':  'חצי גמר',
  'Final':        'גמר',
  'Play-offs':    'פלייאוף',
  // שלבי נוק-אאוט — פורמט עם רגליים
  'Round of 16 - 1st leg':   'שמינית גמר - הלוך',
  'Round of 16 - 2nd leg':   'שמינית גמר - חזור',
  'Quarter-finals - 1st leg': 'רבע גמר - הלוך',
  'Quarter-finals - 2nd leg': 'רבע גמר - חזור',
  'Semi-finals - 1st leg':   'חצי גמר - הלוך',
  'Semi-finals - 2nd leg':   'חצי גמר - חזור',
  // סיבובי איכות
  '1st Qualifying Round': 'סיבוב מוקדם 1',
  '2nd Qualifying Round': 'סיבוב מוקדם 2',
  '3rd Qualifying Round': 'סיבוב מוקדם 3',
  'Knockout Round Play-offs':       'פלייאוף כניסה',
  'Knockout Round Play-offs - 1st leg': 'פלייאוף כניסה - הלוך',
  'Knockout Round Play-offs - 2nd leg': 'פלייאוף כניסה - חזור',
  // ליגות מקומיות
  'Regular Season': 'עונה סדירה',
  'Group Stage':    'שלב הבתים',
}

function translateRound(round: string): string {
  if (ROUND_MAP[round]) return ROUND_MAP[round]
  // Regular Season - N
  const rsMatch = round.match(/^Regular Season - (\d+)$/)
  if (rsMatch) return `מחזור ${rsMatch[1]}`
  // League Stage - N (fallback)
  const lsMatch = round.match(/^League Stage - (\d+)$/)
  if (lsMatch) return `שלב הליגה - ${lsMatch[1]}`
  return round
}

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
  const [homeScore, setHomeScore] = useState<number | null>(userBet?.predictedScore.home ?? 0)
  const [awayScore, setAwayScore] = useState<number | null>(userBet?.predictedScore.away ?? 0)
  const [saved, setSaved] = useState(false)
  const [saveError, setSaveError] = useState(false)
  const [dirty, setDirty] = useState(false)
  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [showOthers, setShowOthers] = useState(false)

  const isFinished = match.status === 'finished'
  // isLive = DB עדכן ל-live, OR: המשחק התחיל בשעתיים האחרונות ועדיין לא גמור
  const isLive = match.status === 'live' || (
    !isFinished && isLocked &&
    new Date(match.matchStartTime).getTime() > Date.now() - 2.5 * 60 * 60 * 1000
  )
  // דקה: מה-DB אם קיימת; בהפסקה/פנדלים/הארכה אל תחשב לפי שעון (לא מדויק)
  const skipClientCalc = ['HT', 'BT', 'P', 'ET'].includes(match.matchPeriod ?? '')
  const liveMinute = match.liveMinute ??
    (isLive && !skipClientCalc
      ? Math.min(90, Math.floor((Date.now() - new Date(match.matchStartTime).getTime()) / 60000))
      : undefined)
  const isInputLocked = isLocked || isFinished || isLive

  // סנכרן מהשרת כשהבט מגיע אסינכרונית
  const syncedBetId = useRef<string | null>(null)
  useEffect(() => {
    if (userBet && userBet.id !== syncedBetId.current) {
      syncedBetId.current = userBet.id
      setHomeScore(userBet.predictedScore.home)
      setAwayScore(userBet.predictedScore.away)
      setDirty(false)
    }
  }, [userBet?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleHomeChange = (v: number) => { setHomeScore(v); setDirty(true); setSaved(false) }
  const handleAwayChange = (v: number) => { setAwayScore(v); setDirty(true); setSaved(false) }

  const handleSave = async () => {
    if (homeScore === null || awayScore === null || !currentUser) return
    const ok = await placeBet(match.id, { home: homeScore, away: awayScore }, currentUser.id)
    if (!ok) { setSaveError(true); setTimeout(() => setSaveError(false), 3000); return }
    setDirty(false)
    setSaved(true)
    if (savedTimerRef.current) clearTimeout(savedTimerRef.current)
    savedTimerRef.current = setTimeout(() => setSaved(false), 2500)
  }

  const matchDate = new Date(match.matchStartTime)
  const dateStr = matchDate.toLocaleDateString('he-IL', { weekday: 'short', day: 'numeric', month: 'short' })
  const timeStr = matchDate.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })
  const roundStr = match.round ? translateRound(match.round) : null

  // ניחושי משתתפים אחרים (גלויים רק אחרי נעילה)
  const otherBets = (isLocked || isFinished || isLive)
    ? allBets.filter((b) => b.matchId === match.id && b.userId !== currentUser?.id)
    : []

  const userResult = isFinished && userBet && match.actualScore
    ? calculateScore(userBet, match)
    : null

  return (
    <motion.div layout initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
      <Card className={cn(
        'overflow-hidden',
        isFinished && 'border-green-300 bg-green-50/60',
        isLive && 'border-red-500/40 bg-red-950/10',
      )}>
        {/* ── Header bar ─────────────────────────────────────────── */}
        <div className={cn(
          'flex items-center justify-between px-4 py-2 text-xs',
          isFinished  ? 'bg-green-100/70 text-muted-foreground' :
          isLive      ? 'bg-red-950/30 text-red-300' :
                        'bg-muted/50 text-muted-foreground',
        )}>
          {/* שמאל: timer / LIVE indicator */}
          {isLive ? (
            <LiveIndicator minute={liveMinute} period={match.matchPeriod} />
          ) : (
            <CountdownTimer matchStartTime={match.matchStartTime} />
          )}

          {/* ימין: סיבוב + תאריך */}
          <div className="flex items-center gap-1.5 text-left">
            {roundStr && <span className={cn('font-medium', isLive ? 'text-red-300' : 'text-emerald-400')}>{roundStr}</span>}
            {roundStr && <span>·</span>}
            <span>{dateStr} · {timeStr}</span>
          </div>
        </div>

        <div className="p-4 sm:p-6">
          {/* שורה ראשית: קבוצה בית | ציון/ניחוש | קבוצה חוץ */}
          <div className="flex items-center gap-3 sm:gap-4">
            {/* קבוצת בית */}
            <div className="flex-1 flex flex-col items-center gap-2 min-w-0">
              <TeamFlag team={match.homeTeam} size="xl" />
              <span className={cn('text-xs font-semibold text-center leading-tight line-clamp-2 w-full break-words', isLive && 'text-slate-200')}>{match.homeTeam.name}</span>
            </div>

            {/* מרכז */}
            <div className="flex flex-col items-center gap-2 shrink-0">

              {(isLive || isFinished) && (match.actualScore || isLive) ? (
                /* ── ציון LIVE / תוצאה סופית ─── */
                <div className="flex flex-col items-center gap-1 min-h-[36px] justify-center">
                  <div className="flex items-center gap-2">
                    <span className={cn('text-2xl font-bold tabular-nums w-7 text-center', isLive ? 'text-white' : 'text-slate-800')}>
                      {match.actualScore?.home ?? 0}
                    </span>
                    <span className={cn('text-base font-bold', isLive ? 'text-slate-400' : 'text-slate-500')}>–</span>
                    <span className={cn('text-2xl font-bold tabular-nums w-7 text-center', isLive ? 'text-white' : 'text-slate-800')}>
                      {match.actualScore?.away ?? 0}
                    </span>
                  </div>
                  {/* ניחוש המשתמש + נקודות מתחת לתוצאה */}
                  {userBet ? (
                    <div className="flex items-center gap-1.5 mt-1 flex-wrap justify-center">
                      <span className={cn('text-[11px]', isLive ? 'text-slate-300' : 'text-slate-500')}>
                        ניחוש: <span className={cn('font-mono font-semibold tabular-nums', isLive ? 'text-slate-200' : 'text-slate-600')}>{userBet.predictedScore.home}–{userBet.predictedScore.away}</span>
                      </span>
                      {userResult && <PointsBadge result={userResult.result} points={userResult.points} />}
                    </div>
                  ) : (
                    <span className={cn('text-[11px] mt-0.5', isLive ? 'text-slate-400' : 'text-slate-500')}>לא ניחשת</span>
                  )}
                </div>
              ) : (
                /* ── קלט ניחוש / ניחוש נעול ─── */
                <>
                  <div className="flex items-center gap-1.5">
                    <ScoreInput value={homeScore} onChange={handleHomeChange} disabled={isInputLocked} />
                    <span className="text-xl font-bold text-muted-foreground">:</span>
                    <ScoreInput value={awayScore} onChange={handleAwayChange} disabled={isInputLocked} />
                  </div>

                  {!isInputLocked && (
                    <button
                      onClick={handleSave}
                      disabled={!dirty || saved}
                      className={cn(
                        'flex items-center gap-1 text-xs px-3 py-2 rounded-full font-medium transition-all min-h-[36px]',
                        saveError
                          ? 'bg-red-100 text-red-600 cursor-default'
                          : dirty && !saved
                          ? 'bg-orange-500 text-white hover:bg-orange-600'
                          : 'bg-muted text-muted-foreground cursor-default'
                      )}
                    >
                      {saveError
                        ? <><AlertCircle className="h-3 w-3" />שגיאה</>
                        : saved
                        ? <><Check className="h-3 w-3" />נשמר</>
                        : <><Save className="h-3 w-3" />שמור</>}
                    </button>
                  )}
                </>
              )}
            </div>

            {/* קבוצת חוץ */}
            <div className="flex-1 flex flex-col items-center gap-2 min-w-0">
              <TeamFlag team={match.awayTeam} size="xl" />
              <span className={cn('text-xs font-semibold text-center leading-tight line-clamp-2 w-full break-words', isLive && 'text-slate-200')}>{match.awayTeam.name}</span>
            </div>
          </div>

          {/* ממתינים לתוצאה — רק כשנעול ולא live ולא גמור */}
          {isLocked && !isFinished && !isLive && (
            <div className="mt-2 flex items-center justify-center gap-1.5 text-xs text-amber-600">
              <Lock className="h-3 w-3" />
              <span>הניחושים נעולים — ממתינים לתוצאה</span>
            </div>
          )}
        </div>

        {/* כפתור ניחושי שאר משתתפים */}
        {(isLocked || isFinished || isLive) && otherBets.length > 0 && (
          <div className="border-t">
            <button
              className="w-full px-4 py-3 text-xs text-muted-foreground flex items-center justify-between hover:bg-muted/50 transition-colors min-h-[44px]"
              onClick={() => setShowOthers(true)}
            >
              <span className="flex items-center gap-1.5">
                <Users className="h-3 w-3" />
                ניחושי שאר המשתתפים ({otherBets.length})
              </span>
              <span className="text-[10px] opacity-60">לחץ לפתיחה</span>
            </button>
          </div>
        )}

        {/* Modal צף */}
        <AnimatePresence>
          {showOthers && (
            <>
              {/* backdrop */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
                onClick={() => setShowOthers(false)}
              />
              {/* panel */}
              <motion.div
                initial={{ opacity: 0, y: 40, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 40, scale: 0.96 }}
                transition={{ type: 'spring', damping: 22, stiffness: 300 }}
                className="fixed inset-x-4 bottom-4 z-50 mx-auto max-w-sm rounded-2xl bg-[#0d1b14] border border-emerald-800/40 shadow-2xl overflow-hidden"
              >
                {/* header */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-emerald-800/30">
                  <div className="text-sm font-semibold text-slate-200">
                    {match.homeTeam.name} – {match.awayTeam.name}
                  </div>
                  <button
                    onClick={() => setShowOthers(false)}
                    className="p-1 rounded-full hover:bg-white/10 transition-colors text-slate-400"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <div className="px-4 py-1 text-[11px] text-slate-500 border-b border-emerald-800/20">
                  ניחושי המשתתפים ({otherBets.length})
                </div>
                {/* list */}
                <div className="overflow-y-auto max-h-72 divide-y divide-emerald-900/30">
                  {otherBets.map((bet) => {
                    const betUser = participants.find((u) => u.id === bet.userId)
                    const result = isFinished && match.actualScore ? calculateScore(bet, match) : null
                    return (
                      <div key={bet.id} className="flex items-center justify-between px-4 py-3 text-sm">
                        <span className="text-slate-300 font-medium">{betUser?.displayName ?? 'משתתף'}</span>
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-slate-200 tabular-nums">
                            {bet.predictedScore.home} – {bet.predictedScore.away}
                          </span>
                          {result && <PointsBadge result={result.result} points={result.points} />}
                        </div>
                      </div>
                    )
                  })}
                </div>
                <div className="px-4 py-3">
                  <button
                    onClick={() => setShowOthers(false)}
                    className="w-full text-xs text-slate-400 hover:text-slate-200 transition-colors py-1"
                  >
                    סגור
                  </button>
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </Card>
    </motion.div>
  )
}

// ── אינדיקטור LIVE ─────────────────────────────────────────────────
function LiveIndicator({ minute, period }: { minute?: number; period?: string }) {
  // תצוגת זמן לפי period
  const timeChip = (() => {
    if (period === 'HT') return { label: 'הפסקה', cls: 'bg-amber-500/20 text-amber-300 border border-amber-500/30' }
    if (period === 'BT') return { label: 'הפסקה', cls: 'bg-amber-500/20 text-amber-300 border border-amber-500/30' }
    if (period === 'P')  return { label: 'פנדלים', cls: 'bg-purple-500/20 text-purple-300 border border-purple-500/30' }
    if (period === 'ET') return { label: minute != null ? `${minute}′` : 'הארכה', cls: 'bg-orange-500/20 text-orange-300 border border-orange-500/30' }
    if (minute != null)  return { label: `${minute}′`, cls: 'bg-red-500/20 text-red-200 border border-red-500/40' }
    return null
  })()

  return (
    <div className="flex items-center gap-2">
      {/* pill LIVE */}
      <span className="inline-flex items-center gap-1.5 bg-red-600 text-white text-[11px] font-bold tracking-widest px-2 py-0.5 rounded-sm uppercase leading-none">
        <span className="relative flex h-1.5 w-1.5 shrink-0">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75" />
          <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-white" />
        </span>
        LIVE
      </span>
      {/* chip זמן */}
      {timeChip && (
        <span className={cn('inline-flex items-center text-[11px] font-mono font-semibold px-2 py-0.5 rounded-sm leading-none min-w-[36px] justify-center', timeChip.cls)}>
          {timeChip.label}
        </span>
      )}
    </div>
  )
}
