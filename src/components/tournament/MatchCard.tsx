'use client'
import { useState, useEffect, useRef, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Lock, Check, Save, AlertCircle, ChevronLeft, Zap } from 'lucide-react'
import { Match, Bet } from '@/types'
import { useCountdown } from '@/hooks/useCountdown'
import { useTournament } from '@/context/TournamentContext'
import { useAuth } from '@/context/AuthContext'
import { getJokerStageGroup, HIDDEN_USER_ID } from '@/lib/constants'
import { TeamFlag } from '@/components/shared/TeamFlag'
import { CountdownTimer } from './CountdownTimer'
import { ScoreInput } from './ScoreInput'
import { PointsBadge } from '@/components/shared/PointsBadge'
import { betDisplayResult } from '@/lib/scoring'
import Image from 'next/image'
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

export function translateRound(round: string): string {
  if (ROUND_MAP[round]) return ROUND_MAP[round]
  // Regular Season - N → מחזור N
  const rsMatch = round.match(/^Regular Season - (\d+)$/)
  if (rsMatch) return `מחזור ${rsMatch[1]}`
  // Group Stage - N → מחזור N
  const gsMatch = round.match(/^Group Stage - (\d+)$/)
  if (gsMatch) return `מחזור ${gsMatch[1]}`
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

// ── Joker card icon — playing card with 4-pointed star ──────────────
function JokerCardIcon({ className, active }: { className?: string; active?: boolean }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      {/* Card outline */}
      <rect x="3" y="2" width="18" height="20" rx="2.5"
            stroke="currentColor" strokeWidth="1.5"
            fill={active ? 'currentColor' : 'none'}
            fillOpacity={active ? 0.18 : 0} />
      {/* 4-pointed star centered */}
      <path d="M12 7 L13.3 10.7 L17 12 L13.3 13.3 L12 17 L10.7 13.3 L7 12 L10.7 10.7 Z"
            fill="currentColor" />
    </svg>
  )
}

export function MatchCard({ match, userBet, allBets, participants }: Props) {
  const { isLocked } = useCountdown(match.matchStartTime)
  const { placeBet, jokerPicks, toggleJoker, activeTournament } = useTournament()
  const { currentUser } = useAuth()
  const router = useRouter()
  const [homeScore, setHomeScore] = useState<number | null>(userBet?.predictedScore.home ?? null)
  const [awayScore, setAwayScore] = useState<number | null>(userBet?.predictedScore.away ?? null)
  const [saved, setSaved] = useState(false)
  const [saveError, setSaveError] = useState<string | false>(false)
  const [dirty, setDirty] = useState(false)
  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [jokerError, setJokerError] = useState<string | false>(false)
  const [jokerSaving, setJokerSaving] = useState(false)

  // ── Joker derived state — quotas are independent per stage group ──
  const stageGroup = getJokerStageGroup(match.round)
  const roundByMatchId = useMemo(() => {
    const map = new Map<string, string | null>()
    activeTournament?.matches.forEach(m => map.set(m.id, m.round ?? null))
    return map
  }, [activeTournament])
  const myJokerPicks = jokerPicks.filter(j => j.userId === currentUser?.id)
  const isMyJoker    = myJokerPicks.some(j => j.matchId === match.id)
  const myGroupJokerCount = stageGroup
    ? myJokerPicks.filter(j => getJokerStageGroup(roundByMatchId.get(j.matchId)) === stageGroup).length
    : 0
  const canAddJoker  = !!stageGroup && (isMyJoker || myGroupJokerCount < stageGroup.max)

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

  const handleJokerToggle = async () => {
    if (!currentUser || jokerSaving) return
    setJokerSaving(true)
    const err = await toggleJoker(match.id, currentUser.id)
    setJokerSaving(false)
    if (err) {
      setJokerError(err)
      setTimeout(() => setJokerError(false), 4000)
    }
  }

  const handleSave = async () => {
    if (!currentUser) return
    if (homeScore === null || awayScore === null) {
      setSaveError('יש לבחור ניקוד לשתי הקבוצות')
      setTimeout(() => setSaveError(false), 4000)
      return
    }
    const error = await placeBet(match.id, { home: homeScore, away: awayScore }, currentUser.id)
    if (error) {
      setSaveError(error)
      setTimeout(() => setSaveError(false), 4000)
      return
    }
    setDirty(false)
    setSaved(true)
    if (savedTimerRef.current) clearTimeout(savedTimerRef.current)
    savedTimerRef.current = setTimeout(() => setSaved(false), 2500)
  }

  const submittedLabel = (() => {
    if (!userBet) return null
    const ts = new Date(userBet.updatedAt ?? userBet.submittedAt)
    const isUpdated = userBet.updatedAt && userBet.updatedAt !== userBet.submittedAt
    const timeStr = ts.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })
    const day   = String(ts.getDate()).padStart(2, '0')
    const month = String(ts.getMonth() + 1).padStart(2, '0')
    const year  = ts.getFullYear()
    return { text: `${timeStr} ${day}/${month}/${year}`, isUpdated }
  })()

  const matchDate = new Date(match.matchStartTime)
  const dateStr = matchDate.toLocaleDateString('he-IL', { weekday: 'short', day: 'numeric', month: 'short' })
  const timeStr = matchDate.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })
  const roundStr = match.round ? translateRound(match.round) : null

  const userResult = isFinished && userBet && match.actualScore ? betDisplayResult(userBet) : null

  const matchBetsAll = allBets.filter(b => b.matchId === match.id && b.userId !== HIDDEN_USER_ID)
  const msToStart = new Date(match.matchStartTime).getTime() - Date.now()
  const isUrgent = !isLocked && !isFinished && !isLive && !userBet && msToStart > 0 && msToStart < 2 * 60 * 60 * 1000

  return (
    <div className="animate-fade-up h-full">
      {saveError && (
        <div className="fixed top-4 inset-x-0 z-50 flex justify-center px-4 pointer-events-none">
          <div className="flex items-center gap-2 bg-red-600 text-white text-sm font-semibold px-4 py-3 rounded-xl shadow-lg max-w-sm animate-fade-up" role="alert">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>הניחוש לא נשמר: {saveError}</span>
          </div>
        </div>
      )}
      <Card className={cn(
        'overflow-hidden h-full flex flex-col',
        isFinished && 'border-emerald-400/50 bg-emerald-50/40',
        isLive && 'border-red-400/50 bg-red-50/40',
        isUrgent && 'border-orange-400/60',
        !isFinished && !isLive && !isUrgent && userBet && 'border-primary/30',
      )}>
        {/* ── Header bar — לחיצה פותחת מסך פרטי משחק ──────────── */}
        <div
          className={cn(
            'flex items-center justify-between px-4 py-2 text-xs cursor-pointer',
            isFinished  ? 'bg-emerald-100/60 text-muted-foreground hover:bg-emerald-100' :
            isLive      ? 'bg-red-100 text-red-700 hover:bg-red-200/60' :
                          'bg-muted/50 text-muted-foreground hover:bg-muted/70',
          )}
          onClick={() => router.push(`/tournament/${match.tournamentId}/match/${match.id}`)}
        >
          {/* שמאל: timer / LIVE indicator */}
          <div className="flex-1 flex items-center">
            {isLive ? (
              <LiveIndicator minute={liveMinute} period={match.matchPeriod} />
            ) : (
              <CountdownTimer matchStartTime={match.matchStartTime} />
            )}
          </div>

          {/* מרכז: שלב */}
          {roundStr && (
            <div className="flex-1 flex justify-center">
              <span className={cn('font-medium whitespace-nowrap text-xs leading-tight text-center', isLive ? 'text-red-700' : 'text-primary')}>
                {roundStr}
              </span>
            </div>
          )}

          {/* ימין: תאריך + חץ ניווט */}
          <div className={cn('flex items-center justify-end gap-1.5', roundStr ? 'flex-1' : 'flex-none')}>
            <span className="whitespace-nowrap text-xs leading-tight">{dateStr} · {timeStr}</span>
            <ChevronLeft className="h-3.5 w-3.5 opacity-50 shrink-0" />
          </div>
        </div>

        <div className="p-4 sm:p-6 flex-1">
          {/* שורה ראשית: קבוצה בית | ציון/ניחוש | קבוצה חוץ */}
          <div className="flex items-center gap-3 sm:gap-4">
            {/* קבוצת בית */}
            <div className="flex-1 flex flex-col items-center gap-2 min-w-0">
              <TeamFlag team={match.homeTeam} className="h-14 w-14 sm:h-20 sm:w-20" />
              <span className={cn('text-xs font-semibold text-center leading-tight line-clamp-2 w-full break-words', isLive && 'text-foreground')}>
                {match.homeTeam.name}
              </span>
            </div>

            {/* מרכז */}
            <div className="flex flex-col items-center gap-2 shrink-0">

              {(isLive || isFinished) && (match.actualScore || isLive) ? (
                /* ── ציון LIVE / תוצאה סופית ─── */
                <div className="flex flex-col items-center gap-1 min-h-[36px] justify-center">
                  <div className="flex items-center gap-2">
                    <span className="font-condensed text-3xl font-bold tabular-nums w-8 text-center text-foreground">
                      {match.actualScore?.home ?? 0}
                    </span>
                    <span className="text-base font-bold text-muted-foreground">–</span>
                    <span className="font-condensed text-3xl font-bold tabular-nums w-8 text-center text-foreground">
                      {match.actualScore?.away ?? 0}
                    </span>
                  </div>
                  {/* ניחוש המשתמש + נקודות מתחת לתוצאה */}
                  {userBet ? (
                    <div className="flex items-center gap-1.5 mt-1 flex-wrap justify-center">
                      <span className="text-xs text-muted-foreground">
                        ניחוש: <span className="font-condensed font-semibold tabular-nums text-sm text-foreground">{userBet.predictedScore.home}–{userBet.predictedScore.away}</span>
                      </span>
                      {userResult && <PointsBadge result={userResult.result} points={userResult.points} />}
                    </div>
                  ) : (
                    <span className="text-xs mt-0.5 text-muted-foreground">לא ניחשת</span>
                  )}
                </div>
              ) : (
                /* ── קלט ניחוש / ניחוש נעול ─── */
                <>
                  <div className="flex items-center gap-1.5">
                    <ScoreInput value={homeScore} onChange={handleHomeChange} disabled={isInputLocked} ariaLabel={`ניקוד ${match.homeTeam.name}`} />
                    <span className="text-xl font-bold text-muted-foreground">:</span>
                    <ScoreInput value={awayScore} onChange={handleAwayChange} disabled={isInputLocked} ariaLabel={`ניקוד ${match.awayTeam.name}`} />
                  </div>

                  {!isInputLocked && (
                    <div className="flex flex-col items-center gap-0.5">
                      <button
                        onClick={handleSave}
                        disabled={saved}
                        className={cn(
                          'flex items-center gap-1 text-xs px-3 py-2 rounded-full font-medium transition-all min-h-[44px]',
                          saveError
                            ? 'bg-red-100 text-red-600 cursor-default'
                            : dirty && !saved
                            ? 'bg-yellow-400 text-black hover:bg-yellow-500'
                            : 'bg-muted text-muted-foreground cursor-default'
                        )}
                      >
                        {saveError
                          ? <><AlertCircle className="h-3 w-3" />שגיאה</>
                          : saved
                          ? <><Check className="h-3 w-3" />נשמר</>
                          : <><Save className="h-3 w-3" />שמור</>}
                      </button>
                      {saveError && (
                        <span className="text-xs text-red-500 text-center leading-tight max-w-[120px]">{saveError}</span>
                      )}
                    </div>
                  )}
                  {submittedLabel && !isInputLocked && !dirty && (
                    <span className="flex items-center gap-1 text-xs text-emerald-600">
                      <Check className="h-2.5 w-2.5" />
                      {submittedLabel.isUpdated ? 'עודכן' : 'הוגש'} ב-{submittedLabel.text}
                    </span>
                  )}
                  {isUrgent && (
                    <span className="flex items-center gap-1 text-xs text-orange-500 font-medium animate-pulse">
                      <Zap className="h-3 w-3" />
                      פחות מ-2 שעות לקיקאוף
                    </span>
                  )}
                </>
              )}
            </div>

            {/* קבוצת חוץ */}
            <div className="flex-1 flex flex-col items-center gap-2 min-w-0">
              <TeamFlag team={match.awayTeam} className="h-14 w-14 sm:h-20 sm:w-20" />
              <span className={cn('text-xs font-semibold text-center leading-tight line-clamp-2 w-full break-words', isLive && 'text-foreground')}>
                {match.awayTeam.name}
              </span>
            </div>
          </div>

          {/* יחסי הימורים — מוסתרים */}

          {/* פס חלוקת ניחושים — גלוי אחרי נעילה */}
          {(isLocked || isLive || isFinished) && matchBetsAll.length > 0 && (
            <BetDistributionBar bets={matchBetsAll} totalParticipants={participants.filter(p => p.id !== HIDDEN_USER_ID).length} />
          )}

          {/* ממתינים לתוצאה — רק כשנעול ולא live ולא גמור */}
          {isLocked && !isFinished && !isLive && (
            <div className="mt-2 flex items-center justify-center gap-1.5 text-xs text-amber-600">
              <Lock className="h-3 w-3" />
              <span>הניחושים נעולים — ממתינים לתוצאה</span>
            </div>
          )}

          {/* ── ג'וקר — לפי קבוצת השלב (מכסה עצמאית לכל שלב) ──────── */}
          {stageGroup && (
            <div className="mt-3 flex flex-col items-center gap-1">
              {(isLocked || isLive || isFinished) ? (
                /* לאחר נעילה: תצוגת קריאה בלבד */
                isMyJoker && (
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-red-700 bg-red-100/80 border border-red-300/60 rounded-full px-3 py-1.5">
                    <JokerCardIcon className="h-3.5 w-3.5" active />
                    ג&apos;וקר פעיל · ×2
                  </div>
                )
              ) : (
                /* לפני נעילה: כפתור toggle */
                <>
                  <button
                    onClick={handleJokerToggle}
                    disabled={jokerSaving || (!canAddJoker)}
                    aria-pressed={isMyJoker}
                    className={cn(
                      'flex items-center gap-1.5 text-xs px-4 py-2 rounded-full font-semibold border-2 transition-all min-h-[44px]',
                      isMyJoker
                        ? 'bg-red-600 border-red-500 text-white shadow-md shadow-red-500/25 hover:bg-red-700'
                        : canAddJoker
                        ? 'bg-transparent border-red-400/50 text-red-600 hover:border-red-500 hover:bg-red-50'
                        : 'bg-transparent border-muted text-muted-foreground opacity-50 cursor-not-allowed'
                    )}
                  >
                    <JokerCardIcon className="h-4 w-4" active={isMyJoker} />
                    {jokerSaving
                      ? 'שומר...'
                      : isMyJoker
                      ? "ג'וקר פעיל · ×2"
                      : "ג'וקר"}
                  </button>
                  {jokerError && (
                    <span className="text-xs text-red-500 text-center leading-tight">{jokerError}</span>
                  )}
                </>
              )}
            </div>
          )}
        </div>

        {/* ── כפתור מעבר לפרטי המשחק ──────────────────────────── */}
        <div className="border-t border-border/60">
          <button
            className="w-full px-4 py-3 text-xs text-muted-foreground flex items-center justify-between hover:bg-muted/50 hover:text-foreground transition-colors min-h-[44px] group"
            onClick={() => router.push(`/tournament/${match.tournamentId}/match/${match.id}`)}
          >
            <span className="flex items-center gap-1.5 font-medium group-hover:text-primary transition-colors">
              <ChevronLeft className="h-3.5 w-3.5" />
              פרטי המשחק
            </span>
            <span className="text-[10px] opacity-50">ניחושים, טבלה ועוד</span>
          </button>
        </div>

      </Card>
    </div>
  )
}

// ── יחסי הימורים (Bet365) ─────────────────────────────────────────────
function OddsBar({ odds }: { odds: { home: number; draw: number; away: number } }) {
  return (
    <div className="mt-3 space-y-1.5 text-xs">
      <div className="flex justify-end">
        <Image src="/bet365-logo.png" alt="Bet365" width={48} height={18} className="opacity-90" />
      </div>
    <div className="flex items-center justify-between gap-1">
      <div className="flex-1 flex flex-col items-center gap-0.5 bg-emerald-500/10 border border-emerald-500/20 rounded-lg py-1.5 px-2">
        <span className="text-muted-foreground font-medium">1</span>
        <span className="font-bold tabular-nums text-emerald-600">{odds.home.toFixed(2)}</span>
      </div>
      <div className="flex-1 flex flex-col items-center gap-0.5 bg-slate-500/10 border border-slate-500/20 rounded-lg py-1.5 px-2">
        <span className="text-muted-foreground font-medium">X</span>
        <span className="font-bold tabular-nums text-slate-500">{odds.draw.toFixed(2)}</span>
      </div>
      <div className="flex-1 flex flex-col items-center gap-0.5 bg-blue-500/10 border border-blue-500/20 rounded-lg py-1.5 px-2">
        <span className="text-muted-foreground font-medium">2</span>
        <span className="font-bold tabular-nums text-blue-600">{odds.away.toFixed(2)}</span>
      </div>
    </div>
    </div>
  )
}

// ── פס חלוקת ניחושים ──────────────────────────────────────────────────
function BetDistributionBar({ bets, totalParticipants }: { bets: Bet[]; totalParticipants: number }) {
  const total = bets.length
  const homeWins = bets.filter(b => b.predictedScore.home > b.predictedScore.away).length
  const draws    = bets.filter(b => b.predictedScore.home === b.predictedScore.away).length
  const awayWins = bets.filter(b => b.predictedScore.home < b.predictedScore.away).length

  const homePct = Math.round((homeWins / total) * 100)
  const drawPct = Math.round((draws    / total) * 100)
  const awayPct = 100 - homePct - drawPct

  return (
    <div className="mt-3 space-y-1.5">
      <div className="flex justify-between items-center text-xs font-medium px-0.5">
        <span className="text-emerald-600">{homePct}% בית</span>
        <span className="text-muted-foreground/60 text-xs">{total}/{totalParticipants} ניחשו</span>
        <span className="text-blue-600">{awayPct}% חוץ</span>
      </div>
      <div className="h-1.5 rounded-full overflow-hidden flex bg-muted/40">
        {homePct > 0 && (
          <div className="h-full bg-emerald-500/70 transition-all duration-700" style={{ width: `${homePct}%` }} />
        )}
        {drawPct > 0 && (
          <div className="h-full bg-slate-400/50 transition-all duration-700" style={{ width: `${drawPct}%` }} />
        )}
        {awayPct > 0 && (
          <div className="h-full bg-blue-500/70 transition-all duration-700" style={{ width: `${awayPct}%` }} />
        )}
      </div>
      {drawPct > 0 && (
        <div className="flex justify-center text-xs text-muted-foreground/50">
          {drawPct}% תיקו
        </div>
      )}
    </div>
  )
}

// ── אינדיקטור LIVE ─────────────────────────────────────────────────
function LiveIndicator({ minute, period }: { minute?: number; period?: string }) {
  // תצוגת זמן לפי period
  const timeChip = (() => {
    if (period === 'HT') return { label: 'מחצית', cls: 'bg-amber-100 text-amber-700 border border-amber-400/50' }
    if (period === 'BT') return { label: 'הפסקה לפני הארכה', cls: 'bg-amber-100 text-amber-700 border border-amber-400/50' }
    if (period === 'P')  return { label: 'פנדלים', cls: 'bg-purple-100 text-purple-700 border border-purple-400/50' }
    if (period === 'ET') return { label: minute != null ? `${minute}′` : 'הארכה', cls: 'bg-orange-100 text-orange-700 border border-orange-400/50' }
    if (minute != null)  return { label: `${minute}′`, cls: 'bg-red-100 text-red-700 border border-red-400/50' }
    return null
  })()

  return (
    <div className="flex items-center gap-2">
      {/* pill LIVE */}
      <span className="inline-flex items-center gap-1.5 bg-red-600 text-white text-xs font-bold tracking-widest px-2 py-0.5 rounded-sm uppercase leading-none">
        <span className="relative flex h-1.5 w-1.5 shrink-0">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75" />
          <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-white" />
        </span>
        LIVE
      </span>
      {/* chip זמן */}
      {timeChip && (
        <span className={cn('inline-flex items-center text-xs font-mono font-semibold px-2 py-0.5 rounded-sm leading-none min-w-[36px] justify-center', timeChip.cls)}>
          {timeChip.label}
        </span>
      )}
    </div>
  )
}
