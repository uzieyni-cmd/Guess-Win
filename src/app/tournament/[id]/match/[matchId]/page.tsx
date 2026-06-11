'use client'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useTournament } from '@/context/TournamentContext'
import { useAuth } from '@/context/AuthContext'
import { calculateScore } from '@/lib/scoring'
import { PointsBadge } from '@/components/shared/PointsBadge'
import { TeamFlag } from '@/components/shared/TeamFlag'
import { cn } from '@/lib/utils'
import { ArrowRight, Download, Loader2, Users } from 'lucide-react'
import { Match, Bet, User } from '@/types'
import { translateRound } from '@/components/tournament/MatchCard'
import { useCountdown } from '@/hooks/useCountdown'
import { HIDDEN_USER_ID } from '@/lib/constants'

// ── Types ────────────────────────────────────────────────────────

interface MatchEvent {
  minute: number
  teamId: number
  player: string
  type: 'Goal' | 'Card'
  detail: string
}

interface MatchDetail {
  status: { short: string; elapsed: number | null }
  goals:  { home: number | null; away: number | null }
  score:  {
    halftime: { home: number | null; away: number | null }
    fulltime: { home: number | null; away: number | null }
  }
  teams:  { home: { id: number }; away: { id: number } }
  events: MatchEvent[]
}

// ── אייקון אירוע ──────────────────────────────────────────────────

function BallIcon({ ownGoal = false, penalty = false }: { ownGoal?: boolean; penalty?: boolean }) {
  // שחור-לבן לשער רגיל · אדום-לבן לגול עצמי
  const bg   = ownGoal ? '#dc2626' : '#ffffff'
  const line = ownGoal ? '#ffffff' : '#111111'
  const patches = [
    '12,5.5 15.5,8 14.2,12 9.8,12 8.5,8',
    '12,5.5 8.5,8 6,6.5 6.5,3 10,2',
    '12,5.5 15.5,8 18,6.5 17.5,3 14,2',
    '14.2,12 15.5,8 18,6.5 21,9 20,13',
    '9.8,12 8.5,8 6,6.5 3,9 4,13',
    '9.8,12 4,13 5,17 8.5,18 11,15.5',
    '14.2,12 20,13 19,17 15.5,18 13,15.5',
  ]
  const star = '12,6.9 12.5,8.41 14.09,8.42 12.81,9.36 13.29,10.88 12,9.95 10.71,10.88 11.19,9.36 9.91,8.42 11.5,8.41'
  return (
    <svg viewBox="0 0 26 26" className="h-5 w-5" fill="none">
      {/* כדור — מוקם ב-12,12 כרגיל */}
      <circle cx="12" cy="12" r="11" fill={bg} stroke={line} strokeWidth="1.3" />
      {patches.map((pts, i) => (
        <polygon key={i} points={pts} fill={bg} stroke={line} strokeWidth="0.8" strokeLinejoin="round" />
      ))}
      <polygon points={star} fill={line} />
      {/* badge פנדל — פינה ימנית תחתונה */}
      {penalty && (
        <>
          <circle cx="21" cy="21" r="4.5" fill="#f59e0b" stroke={bg} strokeWidth="1" />
          <text x="21" y="23.5" textAnchor="middle" fontSize="5.5" fontWeight="bold" fill="#111" fontFamily="sans-serif">P</text>
        </>
      )}
    </svg>
  )
}

function CardIcon({ color }: { color: 'yellow' | 'red' | 'yr' }) {
  if (color === 'yellow') return (
    <div
      className="h-[20px] w-[14px] rounded-[3px] shrink-0 shadow-md"
      style={{ background: 'linear-gradient(145deg, #fde047 0%, #f59e0b 100%)', boxShadow: '0 2px 6px rgba(245,158,11,0.5)' }}
    />
  )
  if (color === 'red') return (
    <div
      className="h-[20px] w-[14px] rounded-[3px] shrink-0 shadow-md"
      style={{ background: 'linear-gradient(145deg, #f87171 0%, #dc2626 100%)', boxShadow: '0 2px 6px rgba(220,38,38,0.5)' }}
    />
  )
  // Yellow-Red (second yellow)
  return (
    <div className="relative h-[20px] w-[20px] shrink-0">
      <div className="absolute top-0 left-0 h-[20px] w-[14px] rounded-[3px]"
        style={{ background: 'linear-gradient(145deg, #fde047 0%, #f59e0b 100%)' }} />
      <div className="absolute top-0 right-0 h-[20px] w-[14px] rounded-[3px]"
        style={{ background: 'linear-gradient(145deg, #f87171 0%, #dc2626 100%)', boxShadow: '0 2px 6px rgba(220,38,38,0.5)' }} />
    </div>
  )
}

function EventIcon({ type, detail }: { type: string; detail: string }) {
  if (type === 'Goal') return <BallIcon ownGoal={detail === 'Own Goal'} penalty={detail === 'Penalty'} />
  if (type === 'Card') {
    if (detail === 'Yellow Card')      return <CardIcon color="yellow" />
    if (detail === 'Red Card')         return <CardIcon color="red" />
    return <CardIcon color="yr" />
  }
  return null
}

// ── שורת אירוע ────────────────────────────────────────────────────

function EventRow({ event, homeTeamId }: { event: MatchEvent; homeTeamId: number }) {
  const isHome = event.teamId === homeTeamId
  return (
    <div className="grid grid-cols-[1fr_52px_1fr] items-center gap-1 px-3 py-1.5 rounded-lg hover:bg-foreground/4 transition-colors">
      {/* שמאל — קבוצת חוץ */}
      <div className={cn('text-xs text-muted-foreground text-right truncate', isHome && 'opacity-0 pointer-events-none')}>
        {!isHome && event.player}
      </div>

      {/* מרכז — דקה + אייקון */}
      <div className="flex flex-col items-center gap-0.5">
        <span className="text-xs text-muted-foreground font-mono tabular-nums">{event.minute}&apos;</span>
        <EventIcon type={event.type} detail={event.detail} />
      </div>

      {/* ימין — קבוצת בית */}
      <div className={cn('text-xs text-muted-foreground text-left truncate', !isHome && 'opacity-0 pointer-events-none')}>
        {isHome && event.player}
      </div>
    </div>
  )
}

// ── ציר אירועים ──────────────────────────────────────────────────

function EventsTimeline({ events, homeTeamId, htScore }: {
  events: MatchEvent[]
  homeTeamId: number
  htScore: { home: number | null; away: number | null }
}) {
  // החדש למעלה — הפוך לפי דקה
  const firstHalf  = [...events].filter(e => e.minute <= 45).reverse()
  const secondHalf = [...events].filter(e => e.minute > 45).reverse()
  const hasEvents  = events.length > 0

  if (!hasEvents) {
    return (
      <div className="text-center py-12 text-muted-foreground text-sm">
        אין אירועים רשומים למשחק זה
      </div>
    )
  }

  return (
    /* dir="ltr" כדי שהעמודה הראשונה תהיה תמיד פיזית שמאל */
    <div className="space-y-0.5" dir="ltr">
      {/* מחצית שנייה תחילה (חדש למעלה) */}
      {secondHalf.map((e, i) => (
        <EventRow key={`2h-${i}`} event={e} homeTeamId={homeTeamId} />
      ))}

      {/* מפריד מחצית */}
      <div className="flex items-center gap-3 py-3 my-1 px-3">
        <div className="flex-1 h-px bg-border/60" />
        <span className="text-xs font-bold text-amber-700 tracking-wide px-2 py-0.5 rounded bg-amber-100 border border-amber-400/40">
          הפסקה · {htScore.home ?? 0}–{htScore.away ?? 0}
        </span>
        <div className="flex-1 h-px bg-border/60" />
      </div>

      {/* מחצית ראשונה */}
      {firstHalf.map((e, i) => (
        <EventRow key={`1h-${i}`} event={e} homeTeamId={homeTeamId} />
      ))}
    </div>
  )
}

// ── סכימת חלוקת ניחושים ─────────────────────────────────────────

function ScoreDistribution({ matchBets, match, isLocked }: {
  matchBets: Bet[]
  match: Match
  isLocked: boolean
}) {
  if (!isLocked || matchBets.length === 0) return null

  // קיבוץ לפי תוצאה
  const scoreMap = new Map<string, number>()
  for (const bet of matchBets) {
    const key = `${bet.predictedScore.home}–${bet.predictedScore.away}`
    scoreMap.set(key, (scoreMap.get(key) ?? 0) + 1)
  }

  const sorted = Array.from(scoreMap.entries()).sort((a, b) => b[1] - a[1])
  const maxCount = sorted[0]?.[1] ?? 1
  const actualKey = match.actualScore
    ? `${match.actualScore.home}–${match.actualScore.away}`
    : null

  return (
    <div className="bg-card rounded-2xl border border-border overflow-hidden">
      <div className="px-4 py-3 border-b border-border">
        <h3 className="text-sm font-bold text-foreground">חלוקת ניחושים</h3>
        <p className="text-xs text-muted-foreground mt-0.5">{matchBets.length} ניחושים</p>
      </div>
      <div className="p-3 space-y-1.5">
        {sorted.map(([score, count]) => {
          const isActual = score === actualKey
          const pct = Math.round((count / matchBets.length) * 100)
          return (
            <div key={score} className={cn(
              'flex items-center gap-3 px-2 py-1.5 rounded-lg transition-colors',
              isActual ? 'bg-emerald-50 border border-emerald-300/50' : 'hover:bg-muted/40'
            )}>
              <span className={cn(
                'font-mono font-bold text-sm w-10 text-center shrink-0 tabular-nums',
                isActual ? 'text-emerald-700' : 'text-foreground'
              )}>
                {score}
              </span>
              <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className={cn(
                    'h-full rounded-full transition-all duration-500',
                    isActual ? 'bg-emerald-500' : 'bg-primary/50'
                  )}
                  style={{ width: `${(count / maxCount) * 100}%` }}
                />
              </div>
              <span className={cn(
                'text-xs shrink-0 w-24 text-left tabular-nums',
                isActual ? 'text-emerald-700 font-medium' : 'text-muted-foreground'
              )}>
                {count} משתתפ{count === 1 ? '' : 'ים'} · {pct}%
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── פאנל משתתפים ─────────────────────────────────────────────────

function ParticipantsPanel({ participants, matchBets, match, currentUserId, isLocked }: {
  participants: User[]
  matchBets: Bet[]
  match: Match
  currentUserId?: string
  isLocked: boolean
}) {
  const exportExcel = async () => {
    const { utils, writeFile } = await import('xlsx')
    const rows = participants.map(p => {
      const bet    = matchBets.find(b => b.userId === p.id) ?? null
      const result = (match.status === 'finished') && bet && match.actualScore
        ? calculateScore(bet, match) : null
      return {
        'שם':        p.displayName,
        'ניחוש':     bet ? `${bet.predictedScore.home}–${bet.predictedScore.away}` : 'לא ניחש',
        'נקודות':    result ? result.points : '',
        'תוצאה':     result ? ({ exact: 'מדויק', outcome: 'כיוון', miss: 'החטאה' }[result.result]) : '',
      }
    })
    const ws = utils.json_to_sheet(rows)
    const wb = utils.book_new()
    const name = `${match.homeTeam.name} vs ${match.awayTeam.name}`
    utils.book_append_sheet(wb, ws, 'ניחושים')
    writeFile(wb, `${name}.xlsx`)
  }

  return (
    <div className="bg-card rounded-2xl border border-border overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-bold text-foreground">ניחושי משתתפים</h3>
        </div>
        <button
          onClick={exportExcel}
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded hover:bg-foreground/8"
        >
          <Download className="h-3.5 w-3.5" />
          Excel
        </button>
      </div>

      <div className="divide-y divide-border/60 max-h-[480px] overflow-y-auto">
        {participants.map(p => {
          const bet    = matchBets.find(b => b.userId === p.id) ?? null
          const isMe   = p.id === currentUserId
          const result = (match.status === 'finished') && bet && match.actualScore
            ? calculateScore(bet, match) : null
          const showBet = isMe || isLocked

          return (
            <div key={p.id} className={cn(
              'flex items-center justify-between px-4 py-3',
              isMe && 'bg-primary/8 border-r-2 border-primary'
            )}>
              <span className={cn('text-sm truncate max-w-[130px]', isMe ? 'text-primary font-semibold' : 'text-muted-foreground')}>
                {p.displayName}
                {isMe && <span className="text-xs text-primary/60 mr-1">· אני</span>}
              </span>

              <div className="flex items-center gap-2 shrink-0">
                {showBet ? (
                  bet
                    ? <span className="font-mono font-bold text-foreground text-sm tabular-nums">{bet.predictedScore.home}–{bet.predictedScore.away}</span>
                    : <span className="text-xs text-muted-foreground">לא ניחש</span>
                ) : (
                  <span className="text-xs text-muted-foreground/50">נעול</span>
                )}
                {result && <PointsBadge result={result.result} points={result.points} />}
              </div>
            </div>
          )
        })}

        {participants.length === 0 && (
          <p className="text-center text-muted-foreground text-sm py-6">אין משתתפים</p>
        )}
      </div>
    </div>
  )
}

// ── כותרת המשחק ──────────────────────────────────────────────────

function MatchHeader({ match, detail }: { match: Match; detail: MatchDetail | null }) {
  const isLive     = match.status === 'live'
  const isFinished = match.status === 'finished'
  const score      = detail?.goals ?? match.actualScore

  const periodLabel: Record<string, string> = {
    '1H': 'מחצית ראשונה', '2H': 'מחצית שנייה',
    'HT': 'מחצית', 'ET': 'הארכה', 'P': 'פנדלים', 'BT': 'הפסקה לפני הארכה',
  }
  const period = match.matchPeriod ? periodLabel[match.matchPeriod] ?? match.matchPeriod : null

  return (
    <div className="bg-gradient-to-b from-surface to-base border-b border-border/40 py-6 px-4">
      {/* שם הליגה / סיבוב */}
      {match.round && (
        <p className="text-center text-xs text-muted-foreground mb-4">{translateRound(match.round)}</p>
      )}

      <div className="max-w-sm mx-auto flex items-center gap-2">
        {/* קבוצת בית */}
        <div className="flex-1 flex flex-col items-center gap-2">
          <TeamFlag team={match.homeTeam} size="xl" />
          <span className="text-xs font-bold text-foreground text-center leading-tight">{match.homeTeam.name}</span>
        </div>

        {/* ציון + סטטוס */}
        <div className="flex flex-col items-center gap-1 shrink-0 w-24">
          {isLive && (
            <div className="flex items-center gap-1 mb-1">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
              </span>
              <span className="text-xs text-red-600 font-bold tracking-wide">LIVE</span>
              {match.liveMinute != null && !['HT','BT'].includes(match.matchPeriod ?? '') && (
                <span className="text-xs text-red-600 font-mono">{match.liveMinute}&apos;</span>
              )}
            </div>
          )}

          <div className={cn(
            'text-3xl font-black tabular-nums',
            isLive ? 'text-foreground' : isFinished ? 'text-foreground' : 'text-muted-foreground'
          )}>
            {match.status === 'scheduled'
              ? '– : –'
              : `${score?.home ?? 0} : ${score?.away ?? 0}`}
          </div>

          {period && <span className="text-xs text-muted-foreground">{period}</span>}
          {isFinished && <span className="text-xs text-primary font-medium">סיום</span>}
          {match.status === 'scheduled' && (
            <span className="text-xs text-muted-foreground">
              {new Date(match.matchStartTime).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
        </div>

        {/* קבוצת חוץ */}
        <div className="flex-1 flex flex-col items-center gap-2">
          <TeamFlag team={match.awayTeam} size="xl" />
          <span className="text-xs font-bold text-foreground text-center leading-tight">{match.awayTeam.name}</span>
        </div>
      </div>
    </div>
  )
}

// ── דף ראשי ──────────────────────────────────────────────────────

export default function MatchDetailPage() {
  const { id: tournamentId, matchId } = useParams() as { id: string; matchId: string }
  const router   = useRouter()
  const { activeTournament, bets, participants } = useTournament()
  const { currentUser } = useAuth()

  const match = activeTournament?.matches.find(m => m.id === matchId)
  const { isLocked: isBettingLocked } = useCountdown(match?.matchStartTime ?? '')

  const [detail,  setDetail]  = useState<MatchDetail | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!match?.apiFixtureId) return

    const fetchDetail = (isInitial = false) => {
      if (isInitial) setLoading(true)
      fetch(`/api/match-detail/${match.apiFixtureId}`, { cache: 'no-store' })
        .then(r => r.ok ? r.json() : null)
        .then(data => { if (data) setDetail(data) })
        .finally(() => { if (isInitial) setLoading(false) })
    }

    fetchDetail(true)

    // poll כל עוד המשחק לא הסתיים — גם אם context עדיין מציג 'scheduled'
    if (match.status === 'finished') return
    const interval = setInterval(() => fetchDetail(false), 30_000)
    // רענון מיידי כשחוזרים לטאב (מובייל מקפיא timers ב-background)
    const onVisible = () => { if (!document.hidden) fetchDetail(false) }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      clearInterval(interval)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [match?.apiFixtureId, match?.status])

  if (!activeTournament) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-7 w-7 animate-spin text-primary" />
      </div>
    )
  }

  if (!match?.homeTeam) {
    return (
      <div className="text-center py-16 text-muted-foreground">משחק לא נמצא</div>
    )
  }

  const matchBets  = bets.filter(b => b.matchId === matchId)
  const isLocked   = match.status !== 'scheduled' || isBettingLocked

  // current user always first (אם המשתמש הנוכחי הוא המשתמש המוסתר, הוא עדיין רואה את עצמו)
  const visibleParticipants = participants.filter(p => p.id === currentUser?.id || p.id !== HIDDEN_USER_ID)
  const sortedParticipants = [
    ...visibleParticipants.filter(p => p.id === currentUser?.id),
    ...visibleParticipants.filter(p => p.id !== currentUser?.id),
  ]

  const homeTeamId = detail?.teams.home.id ?? 0
  const htScore    = detail?.score.halftime ?? { home: null, away: null }

  return (
    <div className="min-h-screen bg-base">
      {/* Back */}
      <div className="px-4 pt-3 pb-1">
        <button
          onClick={() => router.push(`/tournament/${tournamentId}/matches`)}
          className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors text-sm"
        >
          <ArrowRight className="h-4 w-4" />
          חזרה למשחקים
        </button>
      </div>

      {/* Match header */}
      <MatchHeader match={match} detail={detail} />

      {/* Body */}
      <div className="max-w-5xl mx-auto px-4 py-5">
        <div className="flex flex-col md:flex-row gap-5">

          {/* LEFT — משתתפים (מובייל: אחרי האירועים) */}
          <div className="md:w-72 shrink-0 order-2 md:order-1">
            <ParticipantsPanel
              participants={sortedParticipants}
              matchBets={matchBets}
              match={match}
              currentUserId={currentUser?.id}
              isLocked={isLocked}
            />
          </div>

          {/* RIGHT — אירועים + סכימת ניחושים */}
          <div className="flex-1 order-1 md:order-2 flex flex-col gap-5">
            <div className="bg-card rounded-2xl border border-border overflow-hidden">
              <div className="px-4 py-3 border-b border-border">
                <h3 className="text-sm font-bold text-foreground">אירועי משחק</h3>
              </div>

              <div className="p-2">
                {loading && (
                  <div className="flex justify-center py-10">
                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                  </div>
                )}
                {!loading && detail && (
                  <EventsTimeline
                    events={detail.events}
                    homeTeamId={homeTeamId}
                    htScore={htScore}
                  />
                )}
                {!loading && !detail && match.apiFixtureId && (
                  <p className="text-center text-muted-foreground text-sm py-10">
                    לא ניתן לטעון אירועים
                  </p>
                )}
                {!loading && !match.apiFixtureId && (
                  <p className="text-center text-muted-foreground text-sm py-10">
                    אין נתוני אירועים למשחק זה
                  </p>
                )}
              </div>
            </div>

            {/* סכימת חלוקת ניחושים — בין אירועים למשתתפים */}
            <ScoreDistribution matchBets={matchBets} match={match} isLocked={isLocked} />
          </div>

        </div>
      </div>
    </div>
  )
}
