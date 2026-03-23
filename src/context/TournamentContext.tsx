'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { supabase, DbMatch, DbBet, DbTournament } from '@/lib/supabase'
import { deriveLeaderboard } from '@/lib/scoring'
import { Bet, Match, ParticipantStanding, Score, Tournament, User } from '@/types'

// ── Adapters: DB row → App type ──────────────────────────────────

function dbMatchToMatch(m: DbMatch): Match {
  return {
    id: m.id,
    tournamentId: m.tournament_id,
    homeTeam: {
      id: m.home_team_id,
      name: m.home_team_name,
      shortCode: m.home_team_short ?? m.home_team_name.slice(0, 3).toUpperCase(),
      flagUrl: m.home_team_flag ?? '',
    },
    awayTeam: {
      id: m.away_team_id,
      name: m.away_team_name,
      shortCode: m.away_team_short ?? m.away_team_name.slice(0, 3).toUpperCase(),
      flagUrl: m.away_team_flag ?? '',
    },
    matchStartTime: m.match_start_time,
    status: m.status as Match['status'],
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

interface TournamentContextType {
  tournaments: Tournament[]
  activeTournament: Tournament | null
  bets: Bet[]
  participants: User[]
  standings: ParticipantStanding[]
  setActiveTournamentId: (id: string) => void
  placeBet: (matchId: string, score: Score, userId: string) => Promise<void>
  setActualScore: (tournamentId: string, matchId: string, score: Score) => Promise<void>
  createTournament: (data: CreateTournamentInput) => Promise<void>
  addMatch: (tournamentId: string, match: Omit<Match, 'id' | 'tournamentId'>) => Promise<void>
  updateUserPermissions: (userId: string, competitionIds: string[]) => Promise<void>
  reload: () => void
}

const TournamentContext = createContext<TournamentContextType | null>(null)

export function TournamentProvider({ children }: { children: React.ReactNode }) {
  const [tournaments, setTournaments] = useState<Tournament[]>([])
  const [activeTournamentId, setActiveTournamentIdState] = useState<string | null>(null)
  const [bets, setBets] = useState<Bet[]>([])
  const [participants, setParticipants] = useState<User[]>([])

  // ── Load all tournaments ───────────────────────────────────────
  const loadTournaments = useCallback(async () => {
    const { data: rows } = await supabase
      .from('tournaments')
      .select('*')
      .order('created_at', { ascending: false })
    if (!rows) return

    const result: Tournament[] = await Promise.all(
      rows.map(async (t: DbTournament) => {
        const { data: matchRows } = await supabase
          .from('matches')
          .select('*')
          .eq('tournament_id', t.id)
          .order('match_start_time', { ascending: true })

        const { data: participantRows } = await supabase
          .from('tournament_participants')
          .select('user_id')
          .eq('tournament_id', t.id)

        return {
          id: t.id,
          name: t.name,
          logoUrl: t.logo_url ?? '',
          description: t.description ?? '',
          status: t.status,
          participantIds: participantRows?.map((p: { user_id: string }) => p.user_id) ?? [],
          matches: matchRows?.map(dbMatchToMatch) ?? [],
          createdAt: t.created_at,
          updatedAt: t.updated_at,
        }
      })
    )
    setTournaments(result)
  }, [])

  useEffect(() => { loadTournaments() }, [loadTournaments])

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
  const placeBet = useCallback(async (matchId: string, score: Score, userId: string) => {
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

    if (error) console.error('placeBet error:', error)
  }, [activeTournamentId])

  // ── Set actual score (Admin) ───────────────────────────────────
  const setActualScore = useCallback(async (tournamentId: string, matchId: string, score: Score) => {
    await supabase
      .from('matches')
      .update({ actual_home_score: score.home, actual_away_score: score.away, status: 'finished' })
      .eq('id', matchId)
    await loadTournaments()
  }, [loadTournaments])

  // ── Create tournament (Admin) ──────────────────────────────────
  const createTournament = useCallback(async (data: CreateTournamentInput) => {
    const { data: row, error } = await supabase
      .from('tournaments')
      .insert({
        name: data.name,
        description: data.description,
        logo_url: data.logoUrl || null,
        api_league_id: data.apiLeagueId ?? null,
        api_season: data.apiSeason ?? null,
        status: 'upcoming',
      })
      .select()
      .single()
    if (error || !row) return
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

  const reload = useCallback(() => { loadTournaments() }, [loadTournaments])

  return (
    <TournamentContext.Provider value={{
      tournaments, activeTournament, bets, participants, standings,
      setActiveTournamentId, placeBet, setActualScore, createTournament,
      addMatch, updateUserPermissions, reload,
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
