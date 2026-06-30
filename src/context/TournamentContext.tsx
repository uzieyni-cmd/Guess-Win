'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { supabase, DbMatch, DbBet, DbTournament } from '@/lib/supabase'
import { translateTeam } from '@/lib/teams-he'
import { Bet, JokerPick, Match, ParticipantStanding, Score, Tournament, User } from '@/types'
import {
  adminCreateTournament,
  adminUpdateTournament,
  adminDeleteTournament,
  adminToggleHide,
} from '@/app/actions/tournaments'
import { placeBetAction, setActualScoreAction } from '@/app/actions/bets'
import { toggleJokerPick } from '@/app/actions/joker'
import { getJokerStageGroup, MATCH_LOCK_BEFORE_MS } from '@/lib/constants'

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
    hidden: m.hidden ?? false,
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
  jokerPicks: JokerPick[]
  toggleJoker: (matchId: string, userId: string) => Promise<string | null>
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
  reloadMatches: (tournamentId: string, options?: { all?: boolean; after?: string; append?: boolean; includeHidden?: boolean }) => Promise<{ cursor: string | null; hasPast: boolean } | null>
  patchMatches: (tournamentId: string, updatedMatches: Match[]) => void
  betsReady: boolean
}

const TournamentContext = createContext<TournamentContextType | null>(null)

export function TournamentProvider({ children }: { children: React.ReactNode }) {
  const [tournaments, setTournaments] = useState<Tournament[]>([])
  const [tournamentsLoaded, setTournamentsLoaded] = useState(false)
  const [activeTournamentId, setActiveTournamentIdState] = useState<string | null>(null)
  const [bets, setBets] = useState<Bet[]>([])
  const [betsReady, setBetsReady] = useState(false)
  const [participants, setParticipants] = useState<User[]>([])
  const [participantsVersion, setParticipantsVersion] = useState(0)
  // Raw bonus picks (bonus_questions) — Realtime מעדכן שורות בודדות; הסכום נגזר ב-useMemo
  type BonusPickRaw = { id: string; userId: string; pointsAwarded: number | null }
  const [bonusPicksRaw, setBonusPicksRaw] = useState<BonusPickRaw[]>([])

  // Joker picks — כל הבחירות של כל המשתמשים לטורניר הפעיל
  const [jokerPicksRaw, setJokerPicksRaw] = useState<JokerPick[]>([])

  const bonusPointsByUser = useMemo(() => {
    const map: Record<string, number> = {}
    for (const p of bonusPicksRaw) {
      if (p.pointsAwarded === null || p.pointsAwarded === 0) continue
      map[p.userId] = (map[p.userId] ?? 0) + p.pointsAwarded
    }
    return map
  }, [bonusPicksRaw])

  // H3: פילטור בטים לטורניר הפעיל — useMemo נפרד כך ש-baseStandings לא מחשב מחדש על כל bet
  const activeBets = useMemo(
    () => bets.filter(b => b.tournamentId === activeTournamentId),
    [bets, activeTournamentId]
  )

  // baseStandings — נגזר מ-bets state (מתעדכן ב-Realtime) + bonus picks
  const baseStandings = useMemo<ParticipantStanding[]>(() => {
    if (!participants.length) return []
    const pointsByUser: Record<string, number> = { ...bonusPointsByUser }
    // ניקוד בונוס = שאלות בונוס בלבד; בונוס נבחרת מדורגת (teamBonusPick) נחשב חלק מניקוד המשחקים
    const bonusByUser: Record<string, number> = { ...bonusPointsByUser }
    const matchByUser: Record<string, number> = {}
    const countByUser: Record<string, number> = {}
    const exactByUser: Record<string, number> = {}
    for (const bet of activeBets) {
      if (bet.teamBonusPick) {
        pointsByUser[bet.userId] = (pointsByUser[bet.userId] ?? 0) + bet.teamBonusPick
        matchByUser[bet.userId] = (matchByUser[bet.userId] ?? 0) + bet.teamBonusPick
      }
      if (bet.points === null) continue
      pointsByUser[bet.userId] = (pointsByUser[bet.userId] ?? 0) + bet.points
      matchByUser[bet.userId] = (matchByUser[bet.userId] ?? 0) + bet.points
      countByUser[bet.userId] = (countByUser[bet.userId] ?? 0) + 1
      if (bet.betResult === 'exact') {
        exactByUser[bet.userId] = (exactByUser[bet.userId] ?? 0) + 1
      }
    }
    const newStandings: ParticipantStanding[] = participants
      .map(user => ({
        user,
        totalPoints: pointsByUser[user.id] ?? 0,
        rank: 0,
        betResults: [],
        scoredBetsCount: countByUser[user.id] ?? 0,
        exactCount: exactByUser[user.id] ?? 0,
        matchPoints: matchByUser[user.id] ?? 0,
        bonusPoints: bonusByUser[user.id] ?? 0,
      }))
      .sort((a, b) => b.totalPoints - a.totalPoints || b.exactCount - a.exactCount)
    // אדמין-על אינו תופס מיקום בשום טורניר — שומרים לו נקודות אך rank=0 (לא מדורג).
    // שאר המשתתפים מקבלים מיקומים רציפים 1..M ללא חורים.
    let rank = 0
    newStandings.forEach((s) => {
      if (s.user.role === 'admin') { s.rank = 0; return }
      rank += 1
      s.rank = rank
    })
    return newStandings
  }, [activeBets, bonusPointsByUser, participants])

  // Ref לשמירת זמני התחלת משחקים — לשימוש ב-Realtime callback ללא closure stale
  const matchTimesRef = useRef<Map<string, string>>(new Map())

  // Ref למצב חיבור Realtime — מונע race condition עם polling fallback
  const realtimeConnectedRef = useRef(false)

  // Ref ל-tournaments — מאפשר גישה בתוך effects ללא dependency (מניעת re-run על כל עדכון משחק)
  const tournamentsRef = useRef<typeof tournaments>([])
  useEffect(() => { tournamentsRef.current = tournaments }, [tournaments])

  // ── Load tournaments (metadata only — no matches) ─────────────
  const loadTournaments = useCallback(async () => {
    const { data: rows } = await supabase
      .from('tournaments')
      .select('*')
      .order('created_at', { ascending: false })
    if (!rows) return

    const tournamentIds = rows.map((t: DbTournament) => t.id)

    // H2: query אחד עם GROUP BY במקום N HEAD requests
    const [matchCountRes, participantRowsRes] = await Promise.all([
      supabase.rpc('get_match_counts', { tournament_ids: tournamentIds }),
      supabase.from('tournament_participants')
        .select('tournament_id, user_id')
        .in('tournament_id', tournamentIds),
    ])

    const matchCountMap = Object.fromEntries(
      ((matchCountRes.data ?? []) as { tournament_id: string; match_count: number }[])
        .map(r => [r.tournament_id, r.match_count])
    )

    const result: Tournament[] = rows.map((t: DbTournament) => ({
      id: t.id,
      name: t.name,
      logoUrl: t.logo_url ?? '',
      description: t.description ?? '',
      status: t.status,
      isHidden: t.is_hidden ?? false,
      rules: t.rules ?? null,
      uniqueBonusEnabled: t.unique_bonus_enabled ?? true,
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
    options: { all?: boolean; after?: string; append?: boolean; includeHidden?: boolean } = {}
  ) => {
    const { all = false, after, append = false, includeHidden = false } = options
    const params = new URLSearchParams()
    if (all)  params.set('all', '1')
    if (after) params.set('after', after)
    if (includeHidden) params.set('includeHidden', '1')
    const qs = params.toString()
    const url = `/api/matches/${tournamentId}${qs ? `?${qs}` : ''}`

    // PERF-04: next: { revalidate } הוא no-op בתוך Client Component — הוסר
    const res = await fetch(url)
    if (!res.ok) return null

    const json: { matches: DbMatch[]; hasMore: boolean; hasPast?: boolean } = await res.json()
    const newMatches = json.matches.map(dbMatchToMatch)

    setTournaments((prev) => prev.map((t) => {
      if (t.id !== tournamentId) return t
      const existingReal = t.matches.filter(m => !!m.homeTeam)
      // אם כבר טענו יותר משחקים (למשל all=true), לא להחליף עם טעינה חלקית
      if (!append && !all && existingReal.length > newMatches.length) {
        const patchMap = new Map(newMatches.map(m => [m.id, m]))
        return { ...t, matches: existingReal.map(m => patchMap.get(m.id) ?? m) }
      }
      const existing = append ? existingReal : []
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

  // ── liveBonus — חלק תצוגתי בלבד: כמה מ-totalPoints מקורו במשחקים שעדיין live ──
  // הניקוד עצמו (כולל בונוס נבחרת מדורגת וג'וקר) כבר מחושב ונשמר ב-DB
  // ע"י אותו מנגנון שמריץ ניקוד סופי — לא מחושב כאן מחדש.
  const standings = useMemo<ParticipantStanding[]>(() => {
    if (!baseStandings.length) return baseStandings
    const liveMatchIds = new Set(
      (activeTournament?.matches ?? [])
        .filter(m => m.status === 'live')
        .map(m => m.id)
    )
    if (!liveMatchIds.size) return baseStandings

    const liveBonusByUser: Record<string, number> = {}
    for (const bet of activeBets) {
      if (!liveMatchIds.has(bet.matchId)) continue
      const pts = (bet.points ?? 0) + (bet.teamBonusPick ?? 0)
      if (pts === 0) continue
      liveBonusByUser[bet.userId] = (liveBonusByUser[bet.userId] ?? 0) + pts
    }
    if (!Object.keys(liveBonusByUser).length) return baseStandings

    return baseStandings.map(s => ({ ...s, liveBonus: liveBonusByUser[s.user.id] ?? 0 }))
  }, [baseStandings, activeTournament, activeBets])

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
    let cancelled = false

    const loadBetsAndParticipants = async () => {
      setBetsReady(false)
      setParticipants([])
      setBonusPicksRaw([])
      setJokerPicksRaw([])

      // נסה לטעון את הניחושים עד שמצליח — לא נציג את הדף עד שיש תקשורת תקינה עם ה-DB
      let betRows: (DbBet & { matches: { match_start_time: string } | null })[] | null = null
      let attempt = 0
      while (!cancelled) {
        const { data, error } = await supabase
          .from('bets')
          .select('*, matches(match_start_time)')
          .eq('tournament_id', activeTournamentId)

        if (!error) {
          betRows = (data ?? []) as (DbBet & { matches: { match_start_time: string } | null })[]
          break
        }

        attempt++
        console.error(`[bets] load failed (attempt ${attempt}):`, error.message)
        // המתנה הולכת וגדלה בין ניסיונות (1s, 2s, 4s... עד מקסימום 10s)
        await new Promise(res => setTimeout(res, Math.min(1000 * 2 ** (attempt - 1), 10_000)))
      }

      if (cancelled) return

      const mappedBets: Bet[] = (betRows ?? []).map((b: DbBet & { matches: { match_start_time: string } | null }) => ({
        id: b.id,
        userId: b.user_id,
        matchId: b.match_id,
        tournamentId: b.tournament_id,
        predictedScore: { home: b.predicted_home, away: b.predicted_away },
        submittedAt: b.submitted_at,
        updatedAt: b.updated_at,
        isLocked: b.matches
          ? Date.now() >= new Date(b.matches.match_start_time).getTime() - MATCH_LOCK_BEFORE_MS
          : false,
        points: b.points ?? null,
        teamBonusPick: b.team_bonus_pick ?? 0,
        betResult: b.result ?? null,
      }))
      setBets(mappedBets)
      setBetsReady(true)

      const tournament = tournamentsRef.current.find((t) => t.id === activeTournamentId)

      // H1: כל 3 הבקשות רצות במקביל
      const tid = activeTournamentId
      const [profilesRes, bonusPicksRes, jokerPicksRes] = await Promise.all([
        tournament?.participantIds.length
          ? supabase.from('profiles').select('*').in('id', tournament.participantIds)
          : Promise.resolve({ data: [] as unknown[] }),
        supabase.from('bonus_picks').select('id, user_id, points_awarded').eq('tournament_id', tid),
        supabase.from('joker_picks').select('id, match_id, user_id').eq('tournament_id', tid),
      ])

      if (profilesRes.data?.length) {
        const profileUsers = (profilesRes.data as { id: string; email: string; display_name: string; role: string; avatar_url?: string }[]).map(p => ({
          id: p.id,
          email: p.email,
          displayName: p.display_name,
          avatarUrl: p.avatar_url ?? undefined,
          role: p.role as User['role'],
          competitionIds: [],
        }))
        setParticipants(profileUsers)
      }

      setBonusPicksRaw(
        ((bonusPicksRes.data ?? []) as { id: string; user_id: string; points_awarded: number | null }[]).map(p => ({
          id: p.id, userId: p.user_id, pointsAwarded: p.points_awarded,
        }))
      )
      setJokerPicksRaw(
        ((jokerPicksRes.data ?? []) as { id: string; match_id: string; user_id: string }[]).map(j => ({
          id: j.id, matchId: j.match_id, tournamentId: tid, userId: j.user_id,
        }))
      )
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
          ? Date.now() >= new Date(matchStart).getTime() - MATCH_LOCK_BEFORE_MS
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
          teamBonusPick: raw.team_bonus_pick ?? 0,
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

    return () => { cancelled = true; supabase.removeChannel(channel) }
  }, [activeTournamentId, participantsVersion, tournamentsLoaded]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Realtime: joker_picks — INSERT / DELETE ──────────────────────
  useEffect(() => {
    if (!activeTournamentId) return

    const channel = supabase
      .channel(`joker-picks-${activeTournamentId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'joker_picks',
        filter: `tournament_id=eq.${activeTournamentId}`,
      }, (payload) => {
        const row = payload.new as { id: string; match_id: string; user_id: string }
        setJokerPicksRaw(prev => {
          // Replace placeholder (from optimistic update) or add new
          const idx = prev.findIndex(j => j.matchId === row.match_id && j.userId === row.user_id)
          const pick: JokerPick = { id: row.id, matchId: row.match_id, tournamentId: activeTournamentId, userId: row.user_id }
          if (idx >= 0) { const next = [...prev]; next[idx] = pick; return next }
          return [...prev, pick]
        })
      })
      .on('postgres_changes', {
        event: 'DELETE',
        schema: 'public',
        table: 'joker_picks',
      }, (payload) => {
        // REPLICA IDENTITY FULL מאפשר קבלת id בשורת DELETE
        const old = payload.old as { id?: string; match_id?: string; user_id?: string }
        setJokerPicksRaw(prev => {
          if (old.id) return prev.filter(j => j.id !== old.id)
          if (old.match_id && old.user_id)
            return prev.filter(j => !(j.matchId === old.match_id && j.userId === old.user_id))
          return prev
        })
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [activeTournamentId])

  // ── Realtime: tournament_participants — כשמנהל מוסיף/מסיר משתתף, טען מחדש ──
  useEffect(() => {
    if (!activeTournamentId) return

    const channel = supabase
      .channel(`participants-${activeTournamentId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'tournament_participants',
        filter: `tournament_id=eq.${activeTournamentId}`,
      }, () => { setParticipantsVersion(v => v + 1) })
      .on('postgres_changes', {
        event: 'DELETE',
        schema: 'public',
        table: 'tournament_participants',
        filter: `tournament_id=eq.${activeTournamentId}`,
      }, () => { setParticipantsVersion(v => v + 1) })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [activeTournamentId])

  // ── Realtime: bonus_picks — כשהמנהל קובע תשובה נכונה, הדירוג מתעדכן מיד ──
  useEffect(() => {
    if (!activeTournamentId) return

    const upsertPick = (row: { id: string; user_id: string; points_awarded: number | null }) => {
      const pick = { id: row.id, userId: row.user_id, pointsAwarded: row.points_awarded }
      setBonusPicksRaw(prev => {
        const idx = prev.findIndex(p => p.id === row.id)
        if (idx >= 0) {
          const next = [...prev]
          next[idx] = pick
          return next
        }
        return [...prev, pick]
      })
    }

    const channel = supabase
      .channel(`bonus-picks-${activeTournamentId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'bonus_picks',
        filter: `tournament_id=eq.${activeTournamentId}`,
      }, payload => upsertPick(payload.new as { id: string; user_id: string; points_awarded: number | null }))
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'bonus_picks',
        filter: `tournament_id=eq.${activeTournamentId}`,
      }, payload => upsertPick(payload.new as { id: string; user_id: string; points_awarded: number | null }))
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [activeTournamentId])

  // ── Toggle joker pick ─────────────────────────────────────────
  const toggleJoker = useCallback(async (matchId: string, userId: string): Promise<string | null> => {
    if (!activeTournamentId) return 'שגיאה פנימית'

    const userJokers = jokerPicksRaw.filter(j => j.userId === userId)
    const isCurrentJoker = userJokers.some(j => j.matchId === matchId)

    const roundByMatchId = new Map<string, string | null>()
    activeTournament?.matches.forEach(m => roundByMatchId.set(m.id, m.round ?? null))
    const stageGroup = getJokerStageGroup(roundByMatchId.get(matchId))

    // Optimistic update
    if (isCurrentJoker) {
      setJokerPicksRaw(prev => prev.filter(j => !(j.matchId === matchId && j.userId === userId)))
    } else {
      if (!stageGroup) return "ג'וקר אינו זמין בשלב זה"
      const sameGroupCount = userJokers.filter(j => getJokerStageGroup(roundByMatchId.get(j.matchId)) === stageGroup).length
      if (sameGroupCount >= stageGroup.max) {
        return `ניתן לסמן עד ${stageGroup.max} ג'וקר${stageGroup.max > 1 ? `ים (${stageGroup.label})` : ` ב${stageGroup.label}`}`
      }
      // placeholder id — Realtime יחליף עם id אמיתי
      setJokerPicksRaw(prev => [...prev, { id: `opt-${Date.now()}`, matchId, tournamentId: activeTournamentId, userId }])
    }

    const result = await toggleJokerPick(matchId, activeTournamentId)
    if (!result.ok) {
      // Revert optimistic update
      if (isCurrentJoker) {
        setJokerPicksRaw(prev => [...prev, { id: `rev-${Date.now()}`, matchId, tournamentId: activeTournamentId, userId }])
      } else {
        setJokerPicksRaw(prev => prev.filter(j => !(j.matchId === matchId && j.userId === userId)))
      }
      return result.error ?? 'שגיאה לא ידועה'
    }
    return null
  }, [activeTournamentId, jokerPicksRaw, activeTournament])

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
  // H4: הסרת loadTournaments() — Realtime מעדכן matches + bets אוטומטית
  const setActualScore = useCallback(async (_tournamentId: string, matchId: string, score: Score) => {
    await setActualScoreAction(matchId, score.home, score.away)
  }, [])

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
  const reloadMatches = useCallback((tournamentId: string, options?: { all?: boolean; after?: string; append?: boolean; includeHidden?: boolean }) => {
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
      tournaments, activeTournament, bets, betsReady, participants, standings,
      jokerPicks: jokerPicksRaw, toggleJoker,
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
