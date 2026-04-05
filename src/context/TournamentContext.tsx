'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { supabase, DbMatch, DbBet, DbTournament } from '@/lib/supabase'
import { translateTeam } from '@/lib/teams-he'
import { Bet, Match, ParticipantStanding, Score, Tournament, User } from '@/types'
import { calculateScore } from '@/lib/scoring'
import {
  adminCreateTournament,
  adminUpdateTournament,
  adminDeleteTournament,
  adminToggleHide,
} from '@/app/actions/tournaments'
import { placeBetAction, setActualScoreAction } from '@/app/actions/bets'

// ── Adapters: DB row → App type ──────────────────────────────────

function dbMatchToMatch(m: DbMatch): Match {
  const homeName = translateTeam(m.home_team_name)
  const awayName = translateTeam(m.away_team_name)
  return {
    id: m.id,
    tournamentId: m.tournament_id,
    homeTeam: {
      id: m.home_team_id,
      name: homeName,
      shortCode: m.home_team_short ?? m.home_team_name.slice(0, 3).toUpperCase(),
      flagUrl: m.home_team_flag ?? '',
    },
    awayTeam: {
      id: m.away_team_id,
      name: awayName,
      shortCode: m.away_team_short ?? m.away_team_name.slice(0, 3).toUpperCase(),
      flagUrl: m.away_team_flag ?? '',
    },
    matchStartTime: m.match_start_time,
    status: m.status as Match['status'],
    round: m.round ?? undefined,
    liveMinute: m.elapsed_minutes ?? undefined,
    matchPeriod: m.match_period ?? undefined,
    apiFixtureId: m.api_fixture_id ?? undefined,
    odds: m.odds_home && m.odds_draw && m.odds_away
      ? { home: m.odds_home, draw: m.odds_draw, away: m.odds_away }
      : undefined,
    actualScore:
      m.actual_home_score !== null && m.actual_away_score !== null
        ? { home: m.actual_home_score, away: m.actual_away_score }
        : null,
  }
}

// ── Context ──────────────────────────────────────────────────────

interface CreateTournamentInput {
  name: string
  description: string
  logoUrl: string
  apiLeagueId?: number
  apiSeason?: number
}

interface UpdateTournamentInput {
  name?: string
  logoUrl?: string
  description?: string
  status?: Tournament['status']
}

interface TournamentContextType {
  tournaments: Tournament[]
  activeTournament: Tournament | null
  bets: Bet[]
  participants: User[]
  standings: ParticipantStanding[]
  setActiveTournamentId: (id: string) => void
  placeBet: (matchId: string, score: Score, userId: string) => Promise<string | null>
  setActualScore: (tournamentId: string, matchId: string, score: Score) => Promise<void>
  createTournament: (data: CreateTournamentInput) => Promise<string | undefined>
  updateTournament: (id: string, data: UpdateTournamentInput) => Promise<void>
  deleteTournament: (id: string) => Promise<void>
  toggleHideTournament: (id: string, hidden: boolean) => Promise<void>
  addMatch: (tournamentId: string, match: Omit<Match, 'id' | 'tournamentId'>) => Promise<void>
  updateUserPermissions: (userId: string, competitionIds: string[]) => Promise<void>
  reload: () => void
  reloadMatches: (tournamentId: string, options?: { all?: boolean; after?: string; append?: boolean }) => Promise<{ cursor: string | null; hasPast: boolean } | null>
  patchMatches: (tournamentId: string, updatedMatches: Match[]) => void
}

const TournamentContext = createContext<TournamentContextType | null>(null)

export function TournamentProvider({ children }: { children: React.ReactNode }) {
  const [tournaments, setTournaments] = useState<Tournament[]>([])
  const [tournamentsLoaded, setTournamentsLoaded] = useState(false)
  const [activeTournamentId, setActiveTournamentIdState] = useState<string | null>(null)
  const [bets, setBets] = useState<Bet[]>([])
  const [participants, setParticipants] = useState<User[]>([])
  const [baseStandings, setStandings] = useState<ParticipantStanding[]>([])

  // Ref לשמירת זמני התחלת משחקים — לשימוש ב-Realtime callback ללא closure stale
  const matchTimesRef = useRef<Map<string, string>>(new Map())

  // Ref למצב חיבור Realtime — מונע race condition עם polling fallback
  const realtimeConnectedRef = useRef(false)

  // ── Load tournaments (metadata only — no matches) ─────────────
  const loadTournaments = useCallback(async () => {
    const { data: rows } = await supabase
      .from('tournaments')
      .select('*')
      .order('created_at', { ascending: false })
    if (!rows) return

    const tournamentIds = rows.map((t: DbTournament) => t.id)

    // PERF-03: ספירת משחקים עם HEAD requests (ללא שליפת שורות) + שליפת משתתפים במקביל
    const [matchCountResults, participantRowsRes] = await Promise.all([
      Promise.all(
        tournamentIds.map(async (tid: string) => {
          const { count } = await supabase
            .from('matches')
            .select('*', { count: 'exact', head: true })
            .eq('tournament_id', tid)
          return [tid, count ?? 0] as const
        })
      ),
      supabase.from('tournament_participants')
        .select('tournament_id, user_id')
        .in('tournament_id', tournamentIds),
    ])

    const matchCountMap = Object.fromEntries(matchCountResults)

    const result: Tournament[] = rows.map((t: DbTournament) => ({
      id: t.id,
      name: t.name,
      logoUrl: t.logo_url ?? '',
      description: t.description ?? '',
      status: t.status,
      isHidden: t.is_hidden ?? false,
      participantIds: (participantRowsRes.data ?? [])
        .filter((p: { tournament_id: string }) => p.tournament_id === t.id)
        .map((p: { user_id: string }) => p.user_id),
      matches: new Array(matchCountMap[t.id] ?? 0)
        .fill(null).map((_, i) => ({ id: `stub-${i}` } as unknown as Match)),
      createdAt: t.created_at,
      updatedAt: t.updated_at,
    }))
    setTournaments(result)
    setTournamentsLoaded(true)
  }, [])

  // ── Load matches — Route Handler עם cache ─────────────────────
  const loadActiveMatches = useCallback(async (
    tournamentId: string,
    options: { all?: boolean; after?: string; append?: boolean } = {}
  ) => {
    const { all = false, after, append = false } = options
    let url = `/api/matches/${tournamentId}`
    if (all)  url += '?all=1'
    if (after) url += `?after=${encodeURIComponent(after)}`

    // PERF-04: next: { revalidate } הוא no-op בתוך Client Component — הוסר
    const res = await fetch(url)
    if (!res.ok) return null

    const json: { matches: DbMatch[]; hasMore: boolean; hasPast?: boolean } = await res.json()
    const newMatches = json.matches.map(dbMatchToMatch)

    setTournaments((prev) => prev.map((t) => {
      if (t.id !== tournamentId) return t
      const existing = append ? t.matches.filter(m => !!m.homeTeam) : []
      const ids = new Set(existing.map(m => m.id))
      const merged = [...existing, ...newMatches.filter(m => !ids.has(m.id))]
      return { ...t, matches: merged }
    }))

    return {
      cursor: json.hasMore ? newMatches.at(-1)?.matchStartTime ?? null : null,
      hasPast: json.hasPast ?? false,
    }
  }, [])

  useEffect(() => { loadTournaments() }, [loadTournaments])

  useEffect(() => {
    if (!activeTournamentId || !tournamentsLoaded) return
    loadActiveMatches(activeTournamentId)
  }, [activeTournamentId, tournamentsLoaded, loadActiveMatches])

  // ── עדכון ref זמני המשחקים כשה-activeTournament משתנה ─────────
  const activeTournament = useMemo(
    () => tournaments.find((t) => t.id === activeTournamentId) ?? null,
    [tournaments, activeTournamentId]
  )

  // ── ניקוד חי — מוסיף ניקוד זמני ממשחקים חיים על גבי ה-DB standings ──
  const standings = useMemo<ParticipantStanding[]>(() => {
    if (!baseStandings.length) return baseStandings
    const liveMatches = (activeTournament?.matches ?? []).filter(
      m => m.status === 'live' && m.actualScore !== null
    )
    if (!liveMatches.length) return baseStandings

    const liveMatchIds = new Set(liveMatches.map(m => m.id))
    const liveMatchMap = new Map(liveMatches.map(m => [m.id, m]))

    // בטים על משחקים חיים בלבד (שעדיין לא קיבלו points ב-DB)
    const liveBets = bets.filter(b => liveMatchIds.has(b.matchId) && b.tournamentId === activeTournamentId)

    // חשב ניקוד זמני לכל משתמש
    const livePointsByUser: Record<string, number> = {}
    for (const bet of liveBets) {
      const match = liveMatchMap.get(bet.matchId)
      if (!match) continue
      const result = calculateScore(bet, match)
      livePointsByUser[bet.userId] = (livePointsByUser[bet.userId] ?? 0) + result.points
    }

    if (!Object.keys(livePointsByUser).length) return baseStandings

    const updated = baseStandings.map(s => ({
      ...s,
      totalPoints: s.totalPoints + (livePointsByUser[s.user.id] ?? 0),
      liveBonus: livePointsByUser[s.user.id] ?? 0,
    }))
    updated.sort((a, b) => b.totalPoints - a.totalPoints)
    updated.forEach((s, i) => { s.rank = i + 1 })
    return updated
  }, [baseStandings, activeTournament, bets, activeTournamentId])

  useEffect(() => {
    if (!activeTournament) { matchTimesRef.current = new Map(); return }
    const map = new Map<string, string>()
    activeTournament.matches.forEach(m => {
      if (m.matchStartTime) map.set(m.id, m.matchStartTime)
    })
    matchTimesRef.current = map
  }, [activeTournament])

  // ── Load bets + participants when active tournament changes ────
  useEffect(() => {
    if (!activeTournamentId) return

    const loadBetsAndParticipants = async () => {
      const { data: betRows } = await supabase
        .from('bets')
        .select('*, matches(match_start_time)')
        .eq('tournament_id', activeTournamentId)

      const mappedBets: Bet[] = (betRows ?? []).map((b: DbBet & { matches: { match_start_time: string } | null }) => ({
        id: b.id,
        userId: b.user_id,
        matchId: b.match_id,
        tournamentId: b.tournament_id,
        predictedScore: { home: b.predicted_home, away: b.predicted_away },
        submittedAt: b.submitted_at,
        updatedAt: b.updated_at,
        isLocked: b.matches
          ? Date.now() >= new Date(b.matches.match_start_time).getTime() - 10 * 60 * 1000
          : false,
        points: b.points ?? null,
        betResult: b.result ?? null,
      }))
      setBets(mappedBets)

      const tournament = tournaments.find((t) => t.id === activeTournamentId)
      if (tournament?.participantIds.length) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('*')
          .in('id', tournament.participantIds)

        const profileUsers = (profiles ?? []).map((p: { id: string; email: string; display_name: string; role: string; avatar_url?: string }) => ({
          id: p.id,
          email: p.email,
          displayName: p.display_name,
          avatarUrl: p.avatar_url ?? undefined,
          role: p.role as User['role'],
          competitionIds: [],
        }))
        setParticipants(profileUsers)

        // Load standings from pre-computed points in DB
        const { data: scoredBets } = await supabase
          .from('bets')
          .select('user_id, points')
          .eq('tournament_id', activeTournamentId)
          .not('points', 'is', null)

        const pointsByUser: Record<string, number> = {}
        const countByUser: Record<string, number> = {}
        for (const row of (scoredBets ?? []) as { user_id: string; points: number }[]) {
          pointsByUser[row.user_id] = (pointsByUser[row.user_id] ?? 0) + row.points
          countByUser[row.user_id] = (countByUser[row.user_id] ?? 0) + 1
        }

        const newStandings: ParticipantStanding[] = profileUsers
          .map((user: User) => ({
            user,
            totalPoints: pointsByUser[user.id] ?? 0,
            rank: 0,
            betResults: [],
            scoredBetsCount: countByUser[user.id] ?? 0,
          }))
          .sort((a: ParticipantStanding, b: ParticipantStanding) => b.totalPoints - a.totalPoints)
        newStandings.forEach((s: ParticipantStanding, i: number) => { s.rank = i + 1 })
        setStandings(newStandings)
      }
    }

    loadBetsAndParticipants()

    // PERF-02: Realtime — surgical upsert במקום re-fetch מלא של כל הbets
    const channel = supabase
      .channel(`bets-${activeTournamentId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'bets',
        filter: `tournament_id=eq.${activeTournamentId}`,
      }, (payload) => {
        if (payload.eventType === 'DELETE') {
          const old = payload.old as { id: string }
          setBets(prev => prev.filter(b => b.id !== old.id))
          return
        }
        const raw = payload.new as DbBet
        // גלה isLocked מה-ref העדכני — ללא DB round-trip
        const matchStart = matchTimesRef.current.get(raw.match_id)
        const isLocked = matchStart
          ? Date.now() >= new Date(matchStart).getTime() - 10 * 60 * 1000
          : false
        const newBet: Bet = {
          id: raw.id,
          userId: raw.user_id,
          matchId: raw.match_id,
          tournamentId: raw.tournament_id,
          predictedScore: { home: raw.predicted_home, away: raw.predicted_away },
          submittedAt: raw.submitted_at,
          updatedAt: raw.updated_at,
          isLocked,
          points: raw.points ?? null,
          betResult: raw.result ?? null,
        }
        setBets(prev => {
          const idx = prev.findIndex(b => b.userId === raw.user_id && b.matchId === raw.match_id)
          if (idx >= 0) {
            const updated = [...prev]
            updated[idx] = newBet
            return updated
          }
          return [...prev, newBet]
        })
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [activeTournamentId, tournaments])

  const setActiveTournamentId = useCallback((id: string) => {
    setActiveTournamentIdState(id)
  }, [])

  // ── Place / update a bet — דרך Server Action (ולידציה server-side) ──
  const placeBet = useCallback(async (matchId: string, score: Score, _userId: string): Promise<string | null> => {
    if (!activeTournamentId) return 'שגיאה פנימית'
    const result = await placeBetAction(matchId, activeTournamentId, score.home, score.away)
    if (!result.ok) {
      console.error('placeBet error:', result.error)
      return result.error ?? 'שגיאה לא ידועה'
    }
    return null
  }, [activeTournamentId])

  // ── Set actual score (Admin) — updates match + scores all bets ──
  const setActualScore = useCallback(async (tournamentId: string, matchId: string, score: Score) => {
    await setActualScoreAction(matchId, score.home, score.away)
    await loadTournaments()
  }, [loadTournaments])

  // ── Create tournament (Admin) ──────────────────────────────────
  const createTournament = useCallback(async (data: CreateTournamentInput) => {
    const result = await adminCreateTournament(data)
    if (result.error || !result.id) { console.error('createTournament:', result.error); return }
    await loadTournaments()
    return result.id
  }, [loadTournaments])

  // ── Update tournament (Admin) ──────────────────────────────────
  const updateTournament = useCallback(async (id: string, data: UpdateTournamentInput) => {
    const result = await adminUpdateTournament(id, data)
    if (!result.ok) { console.error('updateTournament:', result.error); return }
    await loadTournaments()
  }, [loadTournaments])

  // ── Add match (Admin) ──────────────────────────────────────────
  const addMatch = useCallback(async (tournamentId: string, match: Omit<Match, 'id' | 'tournamentId'>) => {
    await supabase.from('matches').insert({
      tournament_id: tournamentId,
      home_team_id: match.homeTeam.id,
      home_team_name: match.homeTeam.name,
      home_team_short: match.homeTeam.shortCode,
      home_team_flag: match.homeTeam.flagUrl,
      away_team_id: match.awayTeam.id,
      away_team_name: match.awayTeam.name,
      away_team_short: match.awayTeam.shortCode,
      away_team_flag: match.awayTeam.flagUrl,
      match_start_time: match.matchStartTime,
      status: 'scheduled',
    })
    await loadTournaments()
  }, [loadTournaments])

  // ── Update user permissions (Admin) ───────────────────────────
  const updateUserPermissions = useCallback(async (userId: string, competitionIds: string[]) => {
    await supabase
      .from('tournament_participants')
      .delete()
      .eq('user_id', userId)

    if (competitionIds.length > 0) {
      await supabase
        .from('tournament_participants')
        .insert(competitionIds.map((tid) => ({ tournament_id: tid, user_id: userId })))
    }
    await loadTournaments()
  }, [loadTournaments])

  // ── Delete tournament (Admin) ──────────────────────────────────
  const deleteTournament = useCallback(async (id: string) => {
    const result = await adminDeleteTournament(id)
    if (!result.ok) { console.error('deleteTournament:', result.error); return }
    await loadTournaments()
  }, [loadTournaments])

  // ── Toggle visibility (Admin) ──────────────────────────────────
  const toggleHideTournament = useCallback(async (id: string, hidden: boolean) => {
    const result = await adminToggleHide(id, hidden)
    if (!result.ok) { console.error('toggleHide:', result.error); return }
    setTournaments((prev) => prev.map((t) => t.id === id ? { ...t, isHidden: hidden } : t))
  }, [])

  const reload = useCallback(() => { loadTournaments() }, [loadTournaments])
  const reloadMatches = useCallback((tournamentId: string, options?: { all?: boolean; after?: string; append?: boolean }) => {
    return loadActiveMatches(tournamentId, options ?? {})
  }, [loadActiveMatches])

  const patchMatches = useCallback((tournamentId: string, updatedMatches: Match[]) => {
    if (!updatedMatches.length) return
    const patchMap = new Map(updatedMatches.map((m) => [m.id, m]))
    setTournaments((prev) =>
      prev.map((t) =>
        t.id !== tournamentId
          ? t
          : { ...t, matches: t.matches.map((m) => patchMap.get(m.id) ?? m) }
      )
    )
  }, [])

  // ── Realtime: עדכוני ציון / סטטוס חי (WebSocket push) ────────
  // מעדכן realtimeConnectedRef כדי ש-polling יידע אם הוא צריך לפעול
  useEffect(() => {
    if (!activeTournamentId) return
    const channel = supabase
      .channel(`matches-live-${activeTournamentId}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'matches',
        filter: `tournament_id=eq.${activeTournamentId}`,
      }, (payload) => {
        patchMatches(activeTournamentId, [dbMatchToMatch(payload.new as DbMatch)])
      })
      .subscribe((status) => {
        realtimeConnectedRef.current = status === 'SUBSCRIBED'
      })
    return () => {
      realtimeConnectedRef.current = false
      supabase.removeChannel(channel)
    }
  }, [activeTournamentId, patchMatches])

  // ── Live polling fallback — פועל רק כש-Realtime מנותק ────────
  // כשחוזרים לטאב (מובייל) — תמיד מסנכרן כי Realtime אולי עדיין מתחבר מחדש
  useEffect(() => {
    if (!activeTournamentId) return

    const poll = async (force = false) => {
      if (!force && realtimeConnectedRef.current) return
      try {
        const res = await fetch(`/api/live/${activeTournamentId}`, { cache: 'no-store' })
        if (!res.ok) return
        const { matches: liveRows }: { matches: DbMatch[] } = await res.json()
        if (liveRows?.length) {
          patchMatches(activeTournamentId, liveRows.map(dbMatchToMatch))
        }
      } catch { /* שקט בשגיאות רשת */ }
    }

    // טעינה ראשונית תמיד (לפני ש-Realtime התחבר)
    poll(true)
    // interval — רק אם Realtime נפל
    const interval = setInterval(() => poll(false), 30_000)
    // חזרה לטאב — תמיד (Realtime עשוי להיות באמצע reconnect)
    const onVisible = () => { if (!document.hidden) poll(true) }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      clearInterval(interval)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [activeTournamentId, patchMatches])

  return (
    <TournamentContext.Provider value={{
      tournaments, activeTournament, bets, participants, standings,
      setActiveTournamentId, placeBet, setActualScore, createTournament,
      updateTournament, deleteTournament, toggleHideTournament, addMatch, updateUserPermissions, reload, reloadMatches, patchMatches,
    }}>
      {children}
    </TournamentContext.Provider>
  )
}

export function useTournament() {
  const ctx = useContext(TournamentContext)
  if (!ctx) throw new Error('useTournament must be used within TournamentProvider')
  return ctx
}
