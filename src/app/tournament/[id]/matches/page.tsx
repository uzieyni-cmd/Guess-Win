'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { useTournament } from '@/context/TournamentContext'
import { BettingZone } from '@/components/tournament/BettingZone'
import { BettingZoneSkeleton } from '@/components/tournament/MatchCardSkeleton'
import { Target, ChevronDown, Loader2, EyeOff, Eye, Trophy } from 'lucide-react'

export default function MatchesPage() {
  const { id } = useParams() as { id: string }
  const { activeTournament, reloadMatches } = useTournament()

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
  const finishedCount = realMatches.filter(m => m.status === 'finished' || m.actualScore !== null).length
  const totalMatchCount = activeTournament.matches.length // כולל stubs
  const visibleMatches = hideFinished
    ? realMatches.filter(m => m.status !== 'finished' && m.actualScore === null)
    : realMatches

  return (
    <div>
      {/* שם הטורניר + לוגו */}
      <div className="flex items-center gap-3 mb-6 pb-5 border-b border-slate-700/50">
        {activeTournament.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={activeTournament.logoUrl} alt={activeTournament.name}
            className="h-14 w-14 object-contain rounded-lg shrink-0" />
        ) : (
          <Trophy className="h-10 w-10 text-slate-500 shrink-0" />
        )}
        <h1 className="font-suez text-2xl text-slate-100 leading-tight">{activeTournament.name}</h1>
      </div>

      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Target className="h-5 w-5 text-emerald-500" />
          <h2 className="font-suez text-xl text-slate-100">ניחושי משחקים</h2>
          {realMatches.length > 0 && (
            <span className="text-xs text-slate-300 bg-slate-700 px-2 py-0.5 rounded-full">
              {realMatches.length} משחקים
            </span>
          )}
        </div>

        <div className="flex items-center gap-3">
          {/* כפתור הסתרת משחקים שהסתיימו */}
          {finishedCount > 0 && (
            <button
              onClick={() => setHideFinished(v => !v)}
              className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
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
              className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200 disabled:opacity-50 transition-colors border border-slate-600 rounded-full px-2.5 py-1 hover:border-slate-400"
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
