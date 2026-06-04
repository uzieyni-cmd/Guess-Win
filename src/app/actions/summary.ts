'use server'

import { supabaseAdmin } from '@/lib/supabase-admin'
import { requireTournamentAdmin } from '@/lib/auth-server'

export interface TournamentSummary {
  participantCount: number
  bettorsCount: number
  bonusFilledCount: number
}

export interface BonusQuestionStat {
  id: string
  question: string
  points: number
  filledCount: number
  notFilledCount: number
  distribution: Record<string, number>
}

export interface BonusPickDetailRow {
  userId: string
  name: string
  pick: string
  pointsAwarded: number | null
}

export interface BonusPickDetail {
  filled: BonusPickDetailRow[]
  notFilled: { userId: string; name: string }[]
}

export interface MatchBettorRow {
  userId: string
  name: string
  predictedHome: number
  predictedAway: number
  result: string | null
  points: number | null
}

export interface MatchBettingDetail {
  homeTeam: string
  awayTeam: string
  actualHome: number | null
  actualAway: number | null
  status: string
  round: string | null
  bettors: MatchBettorRow[]
  nonBettors: { userId: string; name: string }[]
}

export interface MatchStat {
  matchId: string
  homeTeam: string
  awayTeam: string
  round: string | null
  status: string
  matchStartTime: string | null
  bettorsCount: number
  nonBettorsCount: number
}

// ── סיכום עליון ──────────────────────────────────────────────────
export async function getTournamentSummary(tournamentId: string): Promise<TournamentSummary> {
  await requireTournamentAdmin(tournamentId)

  const [participantsRes, bettorsRes, bonusRes] = await Promise.all([
    supabaseAdmin
      .from('tournament_participants')
      .select('user_id', { count: 'exact', head: true })
      .eq('tournament_id', tournamentId),

    supabaseAdmin
      .from('bets')
      .select('user_id')
      .eq('tournament_id', tournamentId),

    supabaseAdmin
      .from('bonus_picks')
      .select('user_id')
      .eq('tournament_id', tournamentId),
  ])

  const bettorIds = new Set((bettorsRes.data ?? []).map((r: { user_id: string }) => r.user_id))
  const bonusIds = new Set((bonusRes.data ?? []).map((r: { user_id: string }) => r.user_id))

  return {
    participantCount: participantsRes.count ?? 0,
    bettorsCount: bettorIds.size,
    bonusFilledCount: bonusIds.size,
  }
}

// ── סיכום בונוסים ────────────────────────────────────────────────
export async function getBonusQuestionStats(tournamentId: string): Promise<BonusQuestionStat[]> {
  await requireTournamentAdmin(tournamentId)

  const [questionsRes, picksRes, participantsRes] = await Promise.all([
    supabaseAdmin
      .from('bonus_questions')
      .select('id, question, points')
      .eq('tournament_id', tournamentId)
      .order('created_at', { ascending: true }),

    supabaseAdmin
      .from('bonus_picks')
      .select('bonus_question_id, user_id, pick')
      .eq('tournament_id', tournamentId),

    supabaseAdmin
      .from('tournament_participants')
      .select('user_id')
      .eq('tournament_id', tournamentId),
  ])

  const totalParticipants = (participantsRes.data ?? []).length
  const picks = (picksRes.data ?? []) as { bonus_question_id: string; user_id: string; pick: string }[]

  return (questionsRes.data ?? []).map((q: { id: string; question: string; points: number }) => {
    const qPicks = picks.filter(p => p.bonus_question_id === q.id)
    const filledCount = new Set(qPicks.map(p => p.user_id)).size
    const distribution: Record<string, number> = {}
    for (const p of qPicks) {
      distribution[p.pick] = (distribution[p.pick] ?? 0) + 1
    }
    return {
      id: q.id,
      question: q.question,
      points: q.points,
      filledCount,
      notFilledCount: totalParticipants - filledCount,
      distribution,
    }
  })
}

// ── פירוט בונוס ─────────────────────────────────────────────────
export async function getBonusPickDetail(questionId: string, tournamentId: string): Promise<BonusPickDetail> {
  await requireTournamentAdmin(tournamentId)

  const [picksRes, participantsRes] = await Promise.all([
    supabaseAdmin
      .from('bonus_picks')
      .select('user_id, pick, points_awarded')
      .eq('bonus_question_id', questionId)
      .eq('tournament_id', tournamentId),

    supabaseAdmin
      .from('tournament_participants')
      .select('user_id')
      .eq('tournament_id', tournamentId),
  ])

  const picks = (picksRes.data ?? []) as { user_id: string; pick: string; points_awarded: number | null }[]
  const participantIds = (participantsRes.data ?? []).map((r: { user_id: string }) => r.user_id)
  const filledIds = new Set(picks.map(p => p.user_id))
  const notFilledIds = participantIds.filter((id: string) => !filledIds.has(id))
  const allIds = [...participantIds]

  const profilesRes = await supabaseAdmin
    .from('profiles')
    .select('id, display_name')
    .in('id', allIds)

  const nameById: Record<string, string> = {}
  for (const p of (profilesRes.data ?? []) as { id: string; display_name: string }[]) {
    nameById[p.id] = p.display_name
  }

  return {
    filled: picks.map(p => ({
      userId: p.user_id,
      name: nameById[p.user_id] ?? p.user_id,
      pick: p.pick,
      pointsAwarded: p.points_awarded,
    })),
    notFilled: notFilledIds.map((id: string) => ({
      userId: id,
      name: nameById[id] ?? id,
    })),
  }
}

// ── סטטיסטיקות משחקים ───────────────────────────────────────────
export async function getMatchStats(tournamentId: string): Promise<MatchStat[]> {
  await requireTournamentAdmin(tournamentId)

  const [matchesRes, betsRes, participantsRes] = await Promise.all([
    supabaseAdmin
      .from('matches')
      .select('id, home_team_name, away_team_name, round, status, match_start_time')
      .eq('tournament_id', tournamentId)
      .order('match_start_time', { ascending: true }),

    supabaseAdmin
      .from('bets')
      .select('match_id, user_id')
      .eq('tournament_id', tournamentId),

    supabaseAdmin
      .from('tournament_participants')
      .select('user_id')
      .eq('tournament_id', tournamentId),
  ])

  const totalParticipants = (participantsRes.data ?? []).length
  const bets = (betsRes.data ?? []) as { match_id: string; user_id: string }[]

  return (matchesRes.data ?? []).map((m: { id: string; home_team_name: string; away_team_name: string; round: string | null; status: string; match_start_time: string | null }) => {
    const matchBettors = new Set(bets.filter(b => b.match_id === m.id).map(b => b.user_id))
    return {
      matchId: m.id,
      homeTeam: m.home_team_name,
      awayTeam: m.away_team_name,
      round: m.round,
      status: m.status,
      matchStartTime: m.match_start_time,
      bettorsCount: matchBettors.size,
      nonBettorsCount: totalParticipants - matchBettors.size,
    }
  })
}

// ── פירוט משחק ──────────────────────────────────────────────────
export async function getMatchBettingDetail(matchId: string, tournamentId: string): Promise<MatchBettingDetail> {
  await requireTournamentAdmin(tournamentId)

  const [matchRes, betsRes, participantsRes] = await Promise.all([
    supabaseAdmin
      .from('matches')
      .select('home_team_name, away_team_name, actual_home_score, actual_away_score, status, round')
      .eq('id', matchId)
      .single(),

    supabaseAdmin
      .from('bets')
      .select('user_id, predicted_home, predicted_away, result, points')
      .eq('match_id', matchId)
      .eq('tournament_id', tournamentId),

    supabaseAdmin
      .from('tournament_participants')
      .select('user_id')
      .eq('tournament_id', tournamentId),
  ])

  const bets = (betsRes.data ?? []) as { user_id: string; predicted_home: number; predicted_away: number; result: string | null; points: number | null }[]
  const participantIds = (participantsRes.data ?? []).map((r: { user_id: string }) => r.user_id)
  const bettorIds = new Set(bets.map(b => b.user_id))
  const allIds = [...participantIds]

  const profilesRes = await supabaseAdmin
    .from('profiles')
    .select('id, display_name')
    .in('id', allIds)

  const nameById: Record<string, string> = {}
  for (const p of (profilesRes.data ?? []) as { id: string; display_name: string }[]) {
    nameById[p.id] = p.display_name
  }

  const m = matchRes.data as { home_team_name: string; away_team_name: string; actual_home_score: number | null; actual_away_score: number | null; status: string; round: string | null }

  return {
    homeTeam: m?.home_team_name ?? '',
    awayTeam: m?.away_team_name ?? '',
    actualHome: m?.actual_home_score ?? null,
    actualAway: m?.actual_away_score ?? null,
    status: m?.status ?? '',
    round: m?.round ?? null,
    bettors: bets.map(b => ({
      userId: b.user_id,
      name: nameById[b.user_id] ?? b.user_id,
      predictedHome: b.predicted_home,
      predictedAway: b.predicted_away,
      result: b.result,
      points: b.points,
    })).sort((a, b) => (b.points ?? -1) - (a.points ?? -1)),
    nonBettors: participantIds
      .filter((id: string) => !bettorIds.has(id))
      .map((id: string) => ({ userId: id, name: nameById[id] ?? id })),
  }
}
