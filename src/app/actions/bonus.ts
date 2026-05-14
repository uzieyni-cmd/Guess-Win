'use server'

import { supabaseAdmin } from '@/lib/supabase-admin'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { requireAdmin } from '@/lib/auth-server'
import { BonusQuestion, BonusPick } from '@/types'

type DbBonusQuestion = {
  id: string
  tournament_id: string
  type: string
  question: string
  options: string[]
  correct_option: string | null
  points: number
  lock_time: string
}

type DbBonusPick = {
  id: string
  bonus_question_id: string
  tournament_id: string
  user_id: string
  pick: string
  points_awarded: number | null
}

function mapQuestion(r: DbBonusQuestion): BonusQuestion {
  return {
    id: r.id,
    tournamentId: r.tournament_id,
    type: r.type as BonusQuestion['type'],
    question: r.question,
    options: r.options,
    correctOption: r.correct_option,
    points: r.points,
    lockTime: r.lock_time,
  }
}

// ── Fetch all bonus questions for a tournament (public) ──────────
export async function getBonusQuestions(tournamentId: string): Promise<BonusQuestion[]> {
  const { data } = await supabaseAdmin
    .from('bonus_questions')
    .select('*')
    .eq('tournament_id', tournamentId)
    .order('created_at', { ascending: true })
  return (data ?? []).map(r => mapQuestion(r as DbBonusQuestion))
}

// ── Fetch user's picks for a tournament ──────────────────────────
export async function getMyBonusPicks(tournamentId: string): Promise<BonusPick[]> {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const { data } = await supabaseAdmin
    .from('bonus_picks')
    .select('*')
    .eq('tournament_id', tournamentId)
    .eq('user_id', user.id)

  return (data ?? []).map((r: DbBonusPick) => ({
    id: r.id,
    bonusQuestionId: r.bonus_question_id,
    tournamentId: r.tournament_id,
    userId: r.user_id,
    pick: r.pick,
    pointsAwarded: r.points_awarded,
  }))
}

// ── Admin: create bonus question ─────────────────────────────────
export async function createBonusQuestion(input: {
  tournamentId: string
  type: BonusQuestion['type']
  question: string
  options: string[]
  points: number
}): Promise<{ ok: boolean; error?: string }> {
  await requireAdmin()

  // lock_time = first match start − 10 min
  const { data: firstMatch } = await supabaseAdmin
    .from('matches')
    .select('match_start_time')
    .eq('tournament_id', input.tournamentId)
    .order('match_start_time', { ascending: true })
    .limit(1)
    .single()

  if (!firstMatch) return { ok: false, error: 'אין משחקים בטורניר — לא ניתן לחשב זמן נעילה' }

  const lockTime = new Date(new Date(firstMatch.match_start_time).getTime() - 10 * 60 * 1000).toISOString()

  const { error } = await supabaseAdmin
    .from('bonus_questions')
    .insert({
      tournament_id: input.tournamentId,
      type: input.type,
      question: input.question,
      options: input.options,
      points: input.points,
      lock_time: lockTime,
    })

  if (error) return { ok: false, error: error.message }
  return { ok: true }
}

// ── Admin: delete bonus question ─────────────────────────────────
export async function deleteBonusQuestion(id: string): Promise<{ ok: boolean; error?: string }> {
  await requireAdmin()
  const { error } = await supabaseAdmin.from('bonus_questions').delete().eq('id', id)
  if (error) return { ok: false, error: error.message }
  return { ok: true }
}

// ── Admin: mark correct answer + award points ────────────────────
export async function setBonusResult(
  questionId: string,
  correctOption: string
): Promise<{ ok: boolean; awarded: number; error?: string }> {
  await requireAdmin()

  // Save correct answer
  const { error: qErr } = await supabaseAdmin
    .from('bonus_questions')
    .update({ correct_option: correctOption, updated_at: new Date().toISOString() })
    .eq('id', questionId)
  if (qErr) return { ok: false, awarded: 0, error: qErr.message }

  // Fetch points value
  const { data: q } = await supabaseAdmin
    .from('bonus_questions')
    .select('points')
    .eq('id', questionId)
    .single()
  const pts = (q as { points: number } | null)?.points ?? 0

  // Award points to correct picks, 0 to wrong ones
  const { data: picks } = await supabaseAdmin
    .from('bonus_picks')
    .select('id, pick')
    .eq('bonus_question_id', questionId)

  let awarded = 0
  for (const pick of (picks ?? []) as { id: string; pick: string }[]) {
    const pointsAwarded = pick.pick === correctOption ? pts : 0
    await supabaseAdmin
      .from('bonus_picks')
      .update({ points_awarded: pointsAwarded, updated_at: new Date().toISOString() })
      .eq('id', pick.id)
    if (pick.pick === correctOption) awarded++
  }

  return { ok: true, awarded }
}

// ── User: submit/update pick ─────────────────────────────────────
export async function submitBonusPick(
  questionId: string,
  tournamentId: string,
  pick: string
): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Unauthorized' }

  // Check lock
  const { data: q } = await supabaseAdmin
    .from('bonus_questions')
    .select('lock_time, options')
    .eq('id', questionId)
    .single()
  if (!q) return { ok: false, error: 'שאלה לא נמצאה' }
  if (new Date() >= new Date((q as { lock_time: string }).lock_time)) {
    return { ok: false, error: 'ההימור נעול' }
  }
  if (!(q as { options: string[] }).options.includes(pick)) {
    return { ok: false, error: 'בחירה לא תקינה' }
  }

  const { error } = await supabaseAdmin
    .from('bonus_picks')
    .upsert({
      bonus_question_id: questionId,
      tournament_id: tournamentId,
      user_id: user.id,
      pick,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'bonus_question_id,user_id' })

  if (error) return { ok: false, error: error.message }
  return { ok: true }
}
