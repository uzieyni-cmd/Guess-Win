'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { supabase, DbMatch, DbBet, DbTournament } from '@/lib/supabase'
import { deriveLeaderboard } from '@/lib/scoring'
import { translateTeam } from '@/lib/teams-he'
import { Bet, Match, ParticipantStanding, Score, Tournament, User } from '@/types'
import {
  adminCreateTournament,
  adminUpdateTournament,
  adminDeleteTournament,
  adminToggleHide,
} from '@/app/actions/tournaments'

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
  placeBet: (matchId: string, score: Score, userId: string) => Promise<boolean>
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

  // ── Load tournaments (metadata only — no matches) ─────────────
  const loadTournaments = useCallback(async () => {
    const { data: rows } = await supabase
      .from('tournaments')
      .select('*')
      .order('created_at', { ascending: false })
    if (!rows) return

    // ספירת משחקים ומשתתפים בלי שאיבת כל השורות
    const tournamentIds = rows.map((t: DbTournament) => t.id)
    const [matchCountsRes, participantRowsRes] = await Promise.all([
      supabase.from('matches')
        .select('tournament_id', { count: 'exact' })
        .in('tournament_id', tournamentIds),
      supabase.from('tournament_participants')
        .select('tournament_id, user_id')
        .in('tournament_id', tournamentIds),
    ])

    // בנה מפת ספירת משחקים per tournament
    const matchCountMap: Record<string, number> = {}
    ;(matchCountsRes.data ?? []).forEach((m: { tournament_id: string }) => {
      matchCountMap[m.tournament_id] = (matchCountMap[m.tournament_id] ?? 0) + 1
    })

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

    // all=1 ו-after= יכולים להשתמש ב-cache קצר (30s) — רק live צריך no-store
    const res = await fetch(url, { next: { revalidate: 30 } })
    if (!res.ok) return null

    const json: { matches: DbMatch[]; hasMore: boolean; hasPast?: boolean } = await res.json()
    const newMatches = json.matches.map(dbMatchToMatch)

    setTournaments((prev) => prev.map((t) => {
      if (t.id !== tournamentId) return t
      const existing = append ? t.matches.filter(m => !!m.homeTeam) : []
      // מיזוג ללא כפילויות לפי id
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

  // ── Load full matches — רק אחרי שהטורנירים נטענו ────────────
  useEffect(() => {
    if (!activeTournamentId || !tournamentsLoaded) return
    loadActiveMatches(activeTournamentId) // fire-and-forget; hasPast handled in page
  }, [activeTournamentId, tournamentsLoaded, loadActiveMatches])

  // ── Load bets + participants when active tournament changes ────
  useEffect(() => {
    if (!activeTournamentId) return

    const loadBetsAndParticipants = async () => {
      // Bets with match times (for lock detection)
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
        isLocked: b.matches
          ? Date.now() >= new Date(b.matches.match_start_time).getTime() - 10 * 60 * 1000
          : false,
      }))
      setBets(mappedBets)

      // Participants
      const tournament = tournaments.find((t) => t.id === activeTournamentId)
      if (tournament?.participantIds.length) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('*')
          .in('id', tournament.participantIds)
        setParticipants(
          (profiles ?? []).map((p: { id: string; email: string; display_name: string; role: string }) => ({
            id: p.id,
            email: p.email,
            displayName: p.display_name,
            role: p.role as User['role'],
            competitionIds: [],
          }))
        )
      }
    }

    loadBetsAndParticipants()

    // Real-time subscription על bets
    const channel = supabase
      .channel(`bets-${activeTournamentId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'bets',
        filter: `tournament_id=eq.${activeTournamentId}`,
      }, () => {
        loadBetsAndParticipants()
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [activeTournamentId, tournaments])

  const activeTournament = useMemo(
    () => tournaments.find((t) => t.id === activeTournamentId) ?? null,
    [tournaments, activeTournamentId]
  )

  const standings = useMemo((): ParticipantStanding[] => {
    if (!activeTournament || !participants.length) return []
    return deriveLeaderboard(participants, bets, activeTournament.matches, activeTournament.id)
  }, [activeTournament, bets, participants])

  const setActiveTournamentId = useCallback((id: string) => {
    setActiveTournamentIdState(id)
  }, [])

  // ── Place / update a bet ───────────────────────────────────────
  const placeBet = useCallback(async (matchId: string, score: Score, userId: string): Promise<boolean> => {
    const { error } = await supabase
      .from('bets')
      .upsert({
        user_id: userId,
        match_id: matchId,
        tournament_id: activeTournamentId,
        predicted_home: score.home,
        predicted_away: score.away,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id,match_id' })

    if (error) { console.error('placeBet error:', error); return false }
    return true
  }, [activeTournamentId])

  // ── Set actual score (Admin) ───────────────────────────────────
  const setActualScore = useCallback(async (tournamentId: string, matchId: string, score: Score) => {
    await supabase
      .from('matches')
      .update({ actual_home_score: score.home, actual_away_score: score.away, status: 'finished' })
      .eq('id', matchId)
    await loadTournaments()
  }, [loadTournaments])

  // ── Create tournament (Admin) — via Server Action ──────────────
  const createTournament = useCallback(async (data: CreateTournamentInput) => {
    const result = await adminCreateTournament(data)
    if (result.error || !result.id) { console.error('createTournament:', result.error); return }
    await loadTournaments()
    return result.id
  }, [loadTournaments])

  // ── Update tournament (Admin) — via Server Action ──────────────
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
    // מחק את כל ההרשאות הקיימות
    await supabase
      .from('tournament_participants')
      .delete()
      .eq('user_id', userId)

    // הוסף את החדשות
    if (competitionIds.length > 0) {
      await supabase
        .from('tournament_participants')
        .insert(competitionIds.map((tid) => ({ tournament_id: tid, user_id: userId })))
    }
    await loadTournaments()
  }, [loadTournaments])

  // ── Delete tournament (Admin) — via Server Action ─────────────
  const deleteTournament = useCallback(async (id: string) => {
    const result = await adminDeleteTournament(id)
    if (!result.ok) { console.error('deleteTournament:', result.error); return }
    await loadTournaments()
  }, [loadTournaments])

  // ── Toggle visibility (Admin) — via Server Action ──────────────
  const toggleHideTournament = useCallback(async (id: string, hidden: boolean) => {
    const result = await adminToggleHide(id, hidden)
    if (!result.ok) { console.error('toggleHide:', result.error); return }
    // עדכון מיידי ב-state ללא reload מלא
    setTournaments((prev) => prev.map((t) => t.id === id ? { ...t, isHidden: hidden } : t))
  }, [])

  const reload = useCallback(() => { loadTournaments() }, [loadTournaments])
  const reloadMatches = useCallback((tournamentId: string, options?: { all?: boolean; after?: string; append?: boolean }) => {
    return loadActiveMatches(tournamentId, options ?? {})
  }, [loadActiveMatches])

  // עדכון חלקי — רק הmatches שהשתנו (לspolling של live)
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
