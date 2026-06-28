import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { createSupabaseServerClient } from '@/lib/supabase-server'

export const dynamic = 'force-dynamic'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ tournamentId: string; userId: string }> }
) {
  const { tournamentId, userId } = await params

  // הצופה — בחירות של בונוס פתוח (טרם נעול) מוסתרות מכולם פרט לבעל הבחירה עצמו
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  const isSelf = user?.id === userId

  const { data, error } = await supabaseAdmin
    .from('bonus_picks')
    .select('pick, points_awarded, bonus_questions(question, correct_option, points, lock_time, created_at)')
    .eq('tournament_id', tournamentId)
    .eq('user_id', userId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  type Row = {
    pick: string
    points_awarded: number | null
    bonus_questions: { question: string; correct_option: string | null; points: number; lock_time: string | null; created_at: string | null } | null
  }

  const now = Date.now()
  const picks = (data as unknown as Row[])
    // הסתר בחירות של בונוסים שעדיין פתוחים (לפני נעילה) — אלא אם זו הבחירה של הצופה עצמו
    .filter(r => {
      const lock = r.bonus_questions?.lock_time
      const isLocked = lock ? now >= new Date(lock).getTime() : false
      return isLocked || isSelf
    })
    // סדר לפי סדר השאלות בבונוס (created_at של השאלה)
    .sort((a, b) => (a.bonus_questions?.created_at ?? '').localeCompare(b.bonus_questions?.created_at ?? ''))
    .map(r => ({
      question:      r.bonus_questions?.question ?? '',
      pick:          r.pick,
      // null = השאלה עדיין לא נוקדה (אין תוצאה). 0 = נוקדה אך לא זכתה.
      pointsAwarded: r.points_awarded,
      isCorrect:     r.bonus_questions?.correct_option != null
                       ? r.pick === r.bonus_questions.correct_option
                       : null,
    }))

  return NextResponse.json({ picks })
}
