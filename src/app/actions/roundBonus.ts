'use server'

import { supabaseAdmin } from '@/lib/supabase-admin'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { requireAdmin } from '@/lib/auth-server'

// ── Auto-award +2 pts per match win for every team_pick ──────────
// Called from setActualScoreAction after each match result
export async function awardRoundBonusForMatch(matchId: string): Promise<void> {
  const { data: match } = await supabaseAdmin
    .from('matches')
    .select('tournament_id, home_team_name, away_team_name, actual_home_score, actual_away_score')
    .eq('id', matchId)
    .single()

  if (!match) return
  const m = match as {
    tournament_id: string
    home_team_name: string
    away_team_name: string
    actual_home_score: number
    actual_away_score: number
  }

  if (m.actual_home_score === m.actual_away_score) return // תיקו — אין ניצחון

  const winner = m.actual_home_score > m.actual_away_score ? m.home_team_name : m.away_team_name

  // כל הבחירות של הנבחרת המנצחת (כל הבחירות הנוכחיות + ישנות)
  const { data: picks } = await supabaseAdmin
    .from('round_bonus_picks')
    .select('id, points_awarded')
    .eq('tournament_id', m.tournament_id)
    .eq('team_name', winner)

  if (!picks?.length) return

  for (const pick of picks as { id: string; points_awarded: number }[]) {
    await supabaseAdmin
      .from('round_bonus_picks')
      .update({
        points_awarded: (pick.points_awarded ?? 0) + 2,
        updated_at: new Date().toISOString(),
      })
      .eq('id', pick.id)
  }
}

// ── Admin: award +5 pts to users who picked advancing teams ──────
// Admin selects which teams advanced to the next round → +5 per team per user
export async function awardAdvancementBonus(
  tournamentId: string,
  advancingTeams: string[],
): Promise<{ ok: boolean; awarded: number; error?: string }> {
  await requireAdmin()

  if (!advancingTeams.length) return { ok: false, awarded: 0, error: 'לא נבחרו נבחרות' }

  const { data: picks } = await supabaseAdmin
    .from('round_bonus_picks')
    .select('id, points_awarded')
    .eq('tournament_id', tournamentId)
    .in('team_name', advancingTeams)

  if (!picks?.length) return { ok: true, awarded: 0 }

  let awarded = 0
  for (const pick of picks as { id: string; points_awarded: number }[]) {
    const { error } = await supabaseAdmin
      .from('round_bonus_picks')
      .update({
        points_awarded: (pick.points_awarded ?? 0) + 5,
        updated_at: new Date().toISOString(),
      })
      .eq('id', pick.id)
    if (!error) awarded++
  }

  return { ok: true, awarded }
}

// ── Admin: sync existing team_pick bonus_picks → round_bonus_picks ─
// פעולה חד-פעמית שמסנכרנת בחירות קיימות שנוצרו לפני הוספת הלוגיקה
export async function syncExistingTeamPicks(
  tournamentId: string,
): Promise<{ ok: boolean; synced: number; error?: string }> {
  await requireAdmin()

  // שלוף את כל שאלות ה-team_pick בטורניר
  const { data: teamPickQuestions } = await supabaseAdmin
    .from('bonus_questions')
    .select('id')
    .eq('tournament_id', tournamentId)
    .eq('type', 'team_pick')

  if (!teamPickQuestions?.length) return { ok: true, synced: 0 }

  const questionIds = (teamPickQuestions as { id: string }[]).map(q => q.id)

  // שלוף את כל הבחירות לשאלות האלה
  const { data: bonusPicks } = await supabaseAdmin
    .from('bonus_picks')
    .select('bonus_question_id, user_id, pick')
    .eq('tournament_id', tournamentId)
    .in('bonus_question_id', questionIds)

  if (!bonusPicks?.length) return { ok: true, synced: 0 }

  let synced = 0
  for (const bp of bonusPicks as { bonus_question_id: string; user_id: string; pick: string }[]) {
    const { error } = await supabaseAdmin
      .from('round_bonus_picks')
      .upsert({
        tournament_id: tournamentId,
        user_id: bp.user_id,
        stage: bp.bonus_question_id,
        team_name: bp.pick,
        points_awarded: 0,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'tournament_id,user_id,stage' })
    if (!error) synced++
  }

  return { ok: true, synced }
}

// ── Admin: get all teams that appear in team_pick round_bonus_picks ─
// לשימוש ב-UI של עליה לשלב הבא
export async function getTeamPickTeams(
  tournamentId: string,
): Promise<string[]> {
  await requireAdmin()

  const { data } = await supabaseAdmin
    .from('round_bonus_picks')
    .select('team_name')
    .eq('tournament_id', tournamentId)

  if (!data?.length) return []

  const teams = new Set<string>()
  for (const row of data as { team_name: string }[]) {
    if (row.team_name) teams.add(row.team_name)
  }
  return Array.from(teams).sort()
}
