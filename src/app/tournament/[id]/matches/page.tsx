'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { useTournament } from '@/context/TournamentContext'
import { BettingZone } from '@/components/tournament/BettingZone'
import { Target, ChevronDown, Loader2, EyeOff, Eye } from 'lucide-react'

export default function MatchesPage() {
  const { id } = useParams() as { id: string }
  const { activeTournament, reloadMatches } = useTournament()

  // ── state ───────────────────────────────────────────────────────
  const [loadingAll, setLoadingAll]       = useState(false)
  const [allPastLoaded, setAllPastLoaded] = useState(false)
  const [loadingMore, setLoadingMore]     = useState(false)
  const [hasMore, setHasMore]             = useState(false)
  const [cursor, setCursor]               = useState<string | null>(null)
  const [hideFinished, setHideFinished]   = useState(false)
  const sentinelRef = useRef<HTMLDivElement>(null)

  // ── טעינה ראשונית — חלון שוטף ──────────────────────────────────
  useEffect(() => {
    if (!activeTournament) return
    const realMatches = activeTournament.matches.filter(m => !!m.homeTeam)
    if (realMatches.length === 0) return

    // קבע cursor לפי המשחק העתידי האחרון שנטען;
    // אם אין משחקים עתידיים בחלון (למשל הבא הוא >14 יום קדימה),
    // השתמש במשחק האחרון שנטען כנקודת המשך — ה-API יחזיר את הבאים אחריו
    const now = new Date()
    const lastFuture = [...realMatches]
      .filter(m => new Date(m.matchStartTime) > now)
      .at(-1)
    const lastMatch = [...realMatches].at(-1)
    const pivotMatch = lastFuture ?? lastMatch
    if (pivotMatch) {
      setCursor(pivotMatch.matchStartTime)
      setHasMore(true) // IntersectionObserver יבדוק אם יש עוד
    }
  }, [activeTournament?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── infinite scroll — טעינת 20 משחקים עתידיים נוספים ───────────
  const loadMore = useCallback(async () => {
    if (!cursor || loadingMore || !hasMore) return
    setLoadingMore(true)
    const nextCursor = await reloadMatches(id, { after: cursor, append: true })
    setLoadingMore(false)
    if (nextCursor) {
      setCursor(nextCursor)
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
    return (
      <div className="flex justify-center py-16">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    )
  }

  const realMatches = activeTournament.matches.filter(m => !!m.homeTeam)
  const finishedCount = realMatches.filter(m => m.status === 'finished' || m.actualScore !== null).length
  const visibleMatches = hideFinished
    ? realMatches.filter(m => m.status !== 'finished' && m.actualScore === null)
    : realMatches

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Target className="h-5 w-5 text-indigo-600" />
          <h2 className="font-suez text-xl text-gray-800">ניחושי משחקים</h2>
          {realMatches.length > 0 && (
            <span className="text-xs text-muted-foreground bg-gray-100 px-2 py-0.5 rounded-full">
              {realMatches.length} משחקים
            </span>
          )}
        </div>

        <div className="flex items-center gap-3">
          {/* כפתור הסתרת משחקים שהסתיימו */}
          {finishedCount > 0 && (
            <button
              onClick={() => setHideFinished(v => !v)}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-gray-700 transition-colors"
            >
              {hideFinished
                ? <><Eye className="h-3.5 w-3.5" />הצג הכל ({finishedCount})</>
                : <><EyeOff className="h-3.5 w-3.5" />הסתר שהסתיימו ({finishedCount})</>}
            </button>
          )}

          {/* כפתור לטעינת כל המשחקים הישנים */}
          {!allPastLoaded && (
            <button
              onClick={handleLoadPast}
              disabled={loadingAll}
              className="flex items-center gap-1.5 text-xs text-indigo-600 hover:text-indigo-800 disabled:opacity-50 transition-colors"
            >
              {loadingAll
                ? <><Loader2 className="h-3.5 w-3.5 animate-spin" />טוען...</>
                : <><ChevronDown className="h-3.5 w-3.5" />טען משחקים ישנים</>}
            </button>
          )}
        </div>
      </div>

      <BettingZone matches={visibleMatches} />

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
