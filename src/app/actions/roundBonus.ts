'use server'

import { supabaseAdmin } from '@/lib/supabase-admin'
import { requireAdmin } from '@/lib/auth-server'

// ── Admin: award +5 pts to users who picked advancing teams ──────
// Admin selects which teams advanced to the next round → +5 per team per user
// נשמר על bonus_picks.points_awarded (לשורות team_pick, שלא נוגעות בו במסלול הרגיל)
export async function awardAdvancementBonus(
  tournamentId: string,
  advancingTeams: string[],
): Promise<{ ok: boolean; awarded: number; error?: string }> {
  await requireAdmin()

  if (!advancingTeams.length) return { ok: false, awarded: 0, error: 'לא נבחרו נבחרות' }

  const { data: questions } = await supabaseAdmin
    .from('bonus_questions')
    .select('id')
    .eq('tournament_id', tournamentId)
    .eq('type', 'team_pick')

  if (!questions?.length) return { ok: true, awarded: 0 }

  const { data: picks } = await supabaseAdmin
    .from('bonus_picks')
    .select('id, points_awarded')
    .in('bonus_question_id', (questions as { id: string }[]).map(q => q.id))
    .in('pick', advancingTeams)

  if (!picks?.length) return { ok: true, awarded: 0 }

  let awarded = 0
  for (const pick of picks as { id: string; points_awarded: number | null }[]) {
    const { error } = await supabaseAdmin
      .from('bonus_picks')
      .update({
        points_awarded: (pick.points_awarded ?? 0) + 5,
        updated_at: new Date().toISOString(),
      })
      .eq('id', pick.id)
    if (!error) awarded++
  }

  return { ok: true, awarded }
}

// ── Admin: get all teams chosen as "team_pick" in the tournament ─
// לשימוש ב-UI של עליה לשלב הבא
export async function getTeamPickTeams(
  tournamentId: string,
): Promise<string[]> {
  await requireAdmin()

  const { data: questions } = await supabaseAdmin
    .from('bonus_questions')
    .select('id')
    .eq('tournament_id', tournamentId)
    .eq('type', 'team_pick')

  if (!questions?.length) return []

  const { data: picks } = await supabaseAdmin
    .from('bonus_picks')
    .select('pick')
    .in('bonus_question_id', (questions as { id: string }[]).map(q => q.id))

  if (!picks?.length) return []

  const teams = new Set<string>()
  for (const row of picks as { pick: string }[]) {
    if (row.pick) teams.add(row.pick)
  }
  return Array.from(teams).sort()
}
