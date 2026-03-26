'use client'
import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Lock, ChevronDown, ChevronUp, Check, Save, AlertCircle } from 'lucide-react'
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
  const isFinished = match.status === 'finished' || match.actualScore !== null
  const isInputLocked = isLocked || isFinished

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
  const otherBets = (isLocked || isFinished)
    ? allBets.filter((b) => b.matchId === match.id && b.userId !== currentUser?.id)
    : []

  const userResult = isFinished && userBet && match.actualScore
    ? calculateScore(userBet, match)
    : null

  return (
    <motion.div layout initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
      <Card className={cn('overflow-hidden', isFinished && 'border-green-300 bg-green-50/60')}>
        <div className={cn('flex items-center justify-between px-4 py-2 text-xs text-muted-foreground', isFinished ? 'bg-green-100/70' : 'bg-muted/50')}>
          <CountdownTimer matchStartTime={match.matchStartTime} />
          <div className="flex items-center gap-1.5 text-left">
            {roundStr && <span className="font-medium text-emerald-400">{roundStr}</span>}
            {roundStr && <span>·</span>}
            <span>{dateStr} · {timeStr}</span>
          </div>
        </div>

        <div className="p-4 sm:p-6">
          {/* שורה ראשית: קבוצה בית | תוצאה | קבוצה חוץ */}
          <div className="flex items-center gap-3 sm:gap-4">
            {/* קבוצת בית */}
            <div className="flex-1 flex flex-col items-center gap-2 min-w-0">
              <TeamFlag team={match.homeTeam} size="xl" />
              <span className="text-xs font-semibold text-center leading-tight line-clamp-2 w-full break-words">{match.homeTeam.name}</span>
            </div>

            {/* ניחוש תוצאה */}
            <div className="flex flex-col items-center gap-2 shrink-0">
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
            </div>

            {/* קבוצת חוץ */}
            <div className="flex-1 flex flex-col items-center gap-2 min-w-0">
              <TeamFlag team={match.awayTeam} size="xl" />
              <span className="text-xs font-semibold text-center leading-tight line-clamp-2 w-full break-words">{match.awayTeam.name}</span>
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
              className="w-full px-4 py-3 text-xs text-muted-foreground flex items-center justify-between hover:bg-muted/50 transition-colors min-h-[44px]"
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
