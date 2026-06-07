'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { useTournament } from '@/context/TournamentContext'
import { useAuth } from '@/context/AuthContext'
import { BettingZone } from '@/components/tournament/BettingZone'
import { BettingZoneSkeleton } from '@/components/tournament/MatchCardSkeleton'
import { Target, ChevronDown, Loader2, EyeOff, Eye, Trophy } from 'lucide-react'

export default function MatchesPage() {
  const { id } = useParams() as { id: string }
  const { activeTournament, reloadMatches, bets, standings } = useTournament()
  const { currentUser } = useAuth()

  // ── state ───────────────────────────────────────────────────────
  const [loadingAll, setLoadingAll]       = useState(false)
  const [allPastLoaded, setAllPastLoaded] = useState(false)
  const [hasPast, setHasPast]             = useState(false)
  const [loadingMore, setLoadingMore]     = useState(false)
  const [hasMore, setHasMore]             = useState(false)
  const [cursor, setCursor]               = useState<string | null>(null)
  const [hideFinished, setHideFinished]   = useState(false)
  const sentinelRef = useRef<HTMLDivElement>(null)

  // ── טעינה ראשונית — קבל cursor + hasPast מה-API ────────────────
  useEffect(() => {
    if (!id) return
    reloadMatches(id).then((result) => {
      if (!result) return
      if (result.cursor) { setCursor(result.cursor); setHasMore(true) }
      if (result.hasPast) setHasPast(true)
    })
  }, [id]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── infinite scroll — טעינת 20 משחקים עתידיים נוספים ───────────
  const loadMore = useCallback(async () => {
    if (!cursor || loadingMore || !hasMore) return
    setLoadingMore(true)
    const result = await reloadMatches(id, { after: cursor, append: true })
    setLoadingMore(false)
    if (result?.cursor) {
      setCursor(result.cursor)
    } else {
      setHasMore(false)
    }
  }, [cursor, loadingMore, hasMore, id, reloadMatches])

  // ── IntersectionObserver על sentinel div ──────────────────────
  useEffect(() => {
    const sentinel = sentinelRef.current
    if (!sentinel) return
    const observer = new IntersectionObserver(
      (entries) => { if (entries[0].isIntersecting) loadMore() },
      { rootMargin: '200px' } // מתחיל לטעון 200px לפני הסוף
    )
    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [loadMore])

  // ── כפתור "טען משחקים ישנים" ────────────────────────────────────
  const handleLoadPast = async () => {
    setLoadingAll(true)
    await reloadMatches(id, { all: true, append: true })
    setLoadingAll(false)
    setAllPastLoaded(true)
  }

  if (!activeTournament) {
    return <BettingZoneSkeleton />
  }

  const isLoadingMatches = activeTournament.matches.length > 0 && activeTournament.matches.every(m => !m.homeTeam)
  const realMatches = activeTournament.matches.filter(m => !!m.homeTeam)
  const finishedCount = realMatches.filter(m => m.status === 'finished').length
  const totalMatchCount = activeTournament.matches.length // כולל stubs
  const visibleMatches = hideFinished
    ? realMatches.filter(m => m.status !== 'finished')
    : realMatches

  // ── סיכום אישי — ניקוד / מיקום / פגיעות / ניחושים שמולאו ───────
  const myStanding = standings.find(s => s.user.id === currentUser?.id)
  const myBets = bets.filter(b => b.userId === currentUser?.id)
  const correctOutcomeCount = myBets.filter(b => b.betResult === 'outcome').length
  const placedCount = myBets.length
  const progressPct = realMatches.length > 0 ? Math.round((placedCount / realMatches.length) * 100) : 0

  return (
    <div>
      {/* שם הטורניר + לוגו */}
      <div className="flex items-center gap-3 mb-6 pb-5 border-b border-border/50">
        {activeTournament.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={activeTournament.logoUrl} alt={activeTournament.name}
            className="h-14 w-14 object-contain rounded-lg shrink-0" />
        ) : (
          <Trophy className="h-10 w-10 text-muted-foreground/50 shrink-0" />
        )}
        <h1 className="font-suez text-2xl text-foreground leading-tight">{activeTournament.name}</h1>
      </div>

      {/* כרטיס סיכום אישי */}
      {currentUser && (
        <div className="rounded-2xl border border-border bg-card p-4 mb-6">
          <div className="grid grid-cols-4 gap-2 text-center mb-4">
            {[
              { label: 'נקודות', value: myStanding?.totalPoints ?? 0 },
              { label: 'מיקום', value: myStanding ? `#${myStanding.rank}` : '#' },
              { label: 'פגיעות בול', value: myStanding?.exactCount ?? 0 },
              { label: 'כיוון נכון', value: correctOutcomeCount },
            ].map(({ label, value }) => (
              <div key={label}>
                <p className="font-condensed text-xl font-bold text-foreground tabular-nums">{value}</p>
                <p className="text-xs text-muted-foreground">{label}</p>
              </div>
            ))}
          </div>
          <div className="flex items-center justify-between text-xs mb-1.5">
            <span className="font-bold text-foreground tabular-nums">{progressPct}%</span>
            <span className="font-semibold text-foreground/80">ניחושים: {placedCount} / {realMatches.length}</span>
          </div>
          <div className="h-1.5 rounded-full bg-muted overflow-hidden">
            <div className="h-full bg-red-500 rounded-full transition-all" style={{ width: `${progressPct}%` }} />
          </div>
        </div>
      )}

      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Target className="h-5 w-5 text-primary" />
          <h2 className="font-suez text-xl text-foreground">ניחושי משחקים</h2>
          {realMatches.length > 0 && (
            <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
              {realMatches.length} משחקים
            </span>
          )}
        </div>

        <div className="flex items-center gap-3">
          {/* כפתור הסתרת משחקים שהסתיימו */}
          {finishedCount > 0 && (
            <button
              onClick={() => setHideFinished(v => !v)}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer min-h-[44px] px-2"
            >
              {hideFinished
                ? <><Eye className="h-3.5 w-3.5" />הצג הכל ({finishedCount})</>
                : <><EyeOff className="h-3.5 w-3.5" />הסתר שהסתיימו ({finishedCount})</>}
            </button>
          )}

          {/* כפתור לטעינת משחקים שהסתיימו */}
          {!allPastLoaded && hasPast && (
            <button
              onClick={handleLoadPast}
              disabled={loadingAll}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground disabled:opacity-50 transition-colors border border-border rounded-full px-3 py-2.5 min-h-[44px] hover:border-foreground/60"
            >
              {loadingAll
                ? <><Loader2 className="h-3.5 w-3.5 animate-spin" />טוען...</>
                : <><ChevronDown className="h-3.5 w-3.5" />טען משחקים ישנים</>}
            </button>
          )}
        </div>
      </div>

      {isLoadingMatches ? <BettingZoneSkeleton /> : <BettingZone matches={visibleMatches} />}

      {/* Sentinel — IntersectionObserver מזהה כשמגיעים לכאן */}
      <div ref={sentinelRef} className="h-4" />

      {/* אינדיקטור טעינה */}
      {loadingMore && (
        <div className="flex justify-center py-4 gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          טוען משחקים נוספים...
        </div>
      )}

      {!hasMore && realMatches.length > 0 && (
        <p className="text-center text-xs text-muted-foreground py-4">
          כל המשחקים העתידיים נטענו ✓
        </p>
      )}
    </div>
  )
}
