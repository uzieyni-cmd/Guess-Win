import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

export const dynamic = 'force-dynamic'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ tournamentId: string; userId: string }> }
) {
  const { tournamentId, userId } = await params

  const { data, error } = await supabaseAdmin
    .from('bonus_picks')
    .select('pick, points_awarded, bonus_questions(question, correct_option, points)')
    .eq('tournament_id', tournamentId)
    .eq('user_id', userId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  type Row = {
    pick: string
    points_awarded: number | null
    bonus_questions: { question: string; correct_option: string | null; points: number } | null
  }

  const picks = (data as unknown as Row[]).map(r => ({
    question:      r.bonus_questions?.question ?? '',
    pick:          r.pick,
    pointsAwarded: r.points_awarded ?? 0,
    isCorrect:     r.bonus_questions?.correct_option != null
                     ? r.pick === r.bonus_questions.correct_option
                     : null,
  }))

  return NextResponse.json({ picks })
}
