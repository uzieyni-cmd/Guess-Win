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
  correct_option: string[] | null   // text[] column in DB
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
    correctOptions: r.correct_option,   // DB column = correct_option (text[])
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

// ── Admin: update bonus question ─────────────────────────────────
export async function updateBonusQuestion(
  id: string,
  input: {
    type: BonusQuestion['type']
    question: string
    options: string[]
    points: number
  }
): Promise<{ ok: boolean; error?: string }> {
  await requireAdmin()

  // Fetch the tournament_id for this question so we can recalculate lock_time
  const { data: qRow } = await supabaseAdmin
    .from('bonus_questions')
    .select('tournament_id')
    .eq('id', id)
    .single()

  let lockTime: string | undefined
  if (qRow) {
    const { data: firstMatch } = await supabaseAdmin
      .from('matches')
      .select('match_start_time')
      .eq('tournament_id', (qRow as { tournament_id: string }).tournament_id)
      .order('match_start_time', { ascending: true })
      .limit(1)
      .single()
    if (firstMatch) {
      lockTime = new Date(
        new Date((firstMatch as { match_start_time: string }).match_start_time).getTime() - 10 * 60 * 1000
      ).toISOString()
    }
  }

  const update: Record<string, unknown> = {
    type: input.type,
    question: input.question,
    options: input.options,
    points: input.points,
    updated_at: new Date().toISOString(),
  }
  if (lockTime) update.lock_time = lockTime

  const { error } = await supabaseAdmin
    .from('bonus_questions')
    .update(update)
    .eq('id', id)

  if (error) return { ok: false, error: error.message }
  return { ok: true }
}

// ── Admin: sync lock_time for ALL bonus questions in tournament ───
export async function syncAllBonusLockTimes(
  tournamentId: string
): Promise<{ ok: boolean; lockTime?: string; firstMatch?: string; error?: string }> {
  await requireAdmin()

  const { data: firstMatch } = await supabaseAdmin
    .from('matches')
    .select('match_start_time, home_team_name, away_team_name')
    .eq('tournament_id', tournamentId)
    .order('match_start_time', { ascending: true })
    .limit(1)
    .single()

  if (!firstMatch) return { ok: false, error: 'אין משחקים בטורניר' }

  const fm = firstMatch as { match_start_time: string; home_team_name: string; away_team_name: string }
  const lockTime = new Date(new Date(fm.match_start_time).getTime() - 10 * 60 * 1000).toISOString()

  console.log('[syncAllBonusLockTimes] firstMatch:', fm.home_team_name, 'vs', fm.away_team_name,
    '| match_start_time:', fm.match_start_time, '| lock_time:', lockTime)

  const { error } = await supabaseAdmin
    .from('bonus_questions')
    .update({ lock_time: lockTime, updated_at: new Date().toISOString() })
    .eq('tournament_id', tournamentId)

  if (error) return { ok: false, error: error.message }

  const firstMatchLabel = `${fm.home_team_name} נגד ${fm.away_team_name} — ${fm.match_start_time}`
  return { ok: true, lockTime, firstMatch: firstMatchLabel }
}

// ── Admin: delete bonus question ─────────────────────────────────
export async function deleteBonusQuestion(id: string): Promise<{ ok: boolean; error?: string }> {
  await requireAdmin()
  const { error } = await supabaseAdmin.from('bonus_questions').delete().eq('id', id)
  if (error) return { ok: false, error: error.message }
  return { ok: true }
}

// ── Admin: mark correct answers (multiple allowed) + award points ─
export async function setBonusResult(
  questionId: string,
  correctOptions: string[]   // מערך תשובות נכונות
): Promise<{ ok: boolean; awarded: number; error?: string }> {
  await requireAdmin()
  if (!correctOptions.length) return { ok: false, awarded: 0, error: 'לא נבחרה תשובה נכונה' }

  // Save correct answers as text[] array
  const { error: qErr } = await supabaseAdmin
    .from('bonus_questions')
    .update({ correct_option: correctOptions, updated_at: new Date().toISOString() })
    .eq('id', questionId)
  if (qErr) return { ok: false, awarded: 0, error: qErr.message }

  // Fetch points value
  const { data: q } = await supabaseAdmin
    .from('bonus_questions')
    .select('points')
    .eq('id', questionId)
    .single()
  const pts = (q as { points: number } | null)?.points ?? 0

  // Award points to anyone who picked any of the correct options, 0 to the rest
  const { data: picks } = await supabaseAdmin
    .from('bonus_picks')
    .select('id, pick')
    .eq('bonus_question_id', questionId)

  const correctSet = new Set(correctOptions)
  let awarded = 0
  for (const pick of (picks ?? []) as { id: string; pick: string }[]) {
    const isCorrect = correctSet.has(pick.pick)
    await supabaseAdmin
      .from('bonus_picks')
      .update({ points_awarded: isCorrect ? pts : 0, updated_at: new Date().toISOString() })
      .eq('id', pick.id)
    if (isCorrect) awarded++
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
