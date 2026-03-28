import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

export const revalidate = 30

const COLS =
  'id,tournament_id,home_team_id,home_team_name,home_team_short,home_team_flag,' +
  'away_team_id,away_team_name,away_team_short,away_team_flag,' +
  'match_start_time,status,actual_home_score,actual_away_score,api_fixture_id,round,elapsed_minutes,match_period'

const WINDOW_FUTURE = 30  // ימים קדימה לחלון הראשוני
const PAGE_SIZE     = 20  // גודל דף infinite scroll

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ tournamentId: string }> }
) {
  const { tournamentId } = await params
  const sp  = req.nextUrl.searchParams
  const all = sp.get('all') === '1'
  // cursor לטעינת משחקים עתידיים — תאריך המשחק האחרון שנטען
  const after = sp.get('after') // ISO string

  const now = new Date()

  // ── מצב 1: infinite scroll — 20 משחקים עתידיים אחרי cursor ──────
  if (after) {
    const { data, error } = await supabaseAdmin
      .from('matches')
      .select(COLS)
      .eq('tournament_id', tournamentId)
      .gt('match_start_time', after)
      .order('match_start_time', { ascending: true })
      .limit(PAGE_SIZE)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ matches: data ?? [], hasMore: (data?.length ?? 0) === PAGE_SIZE }, {
      headers: { 'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60' },
    })
  }

  // ── מצב 2: טעינת משחקים ישנים (כפתור "טען משחקים ישנים") ───────
  if (all) {
    const { data, error } = await supabaseAdmin
      .from('matches')
      .select(COLS)
      .eq('tournament_id', tournamentId)
      .eq('status', 'finished')
      .order('match_start_time', { ascending: true })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ matches: data ?? [], hasMore: false }, {
      headers: { 'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60' },
    })
  }

  // ── מצב 3: טעינה ראשונית — משחקי היום + עתידיים ────────────────
  const todayStart = new Date(now)
  todayStart.setHours(0, 0, 0, 0)
  const to = new Date(now.getTime() + WINDOW_FUTURE * 86400_000).toISOString()

  // כולל: (לא גמורים) OR (גמורים אבל התחילו היום)
  let { data, error } = await supabaseAdmin
    .from('matches')
    .select(COLS)
    .eq('tournament_id', tournamentId)
    .or(`status.neq.finished,match_start_time.gte.${todayStart.toISOString()}`)
    .lte('match_start_time', to)
    .order('match_start_time', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // fallback: אין משחקים בחלון (למשל תחרות שהסתיימה) — הצג 20 האחרונים
  if (!data || data.length === 0) {
    const { data: fallback } = await supabaseAdmin
      .from('matches')
      .select(COLS)
      .eq('tournament_id', tournamentId)
      .order('match_start_time', { ascending: false })
      .limit(PAGE_SIZE)
    data = (fallback ?? []).reverse() // מהישן לחדש
  }

  // בדוק כמה משחקים finished ישנים לא נכללו בחלון
  const oldestInWindow = (data as unknown as { match_start_time: string }[])[0]?.match_start_time
  let hasPast = false
  if (oldestInWindow) {
    const { count } = await supabaseAdmin
      .from('matches')
      .select('*', { count: 'exact', head: true })
      .eq('tournament_id', tournamentId)
      .eq('status', 'finished')
      .lt('match_start_time', oldestInWindow)
    hasPast = (count ?? 0) > 0
  }

  // בדוק אם יש משחקים עתידיים מעבר לחלון
  const lastDate = (data as unknown as { match_start_time: string }[]).at(-1)?.match_start_time
  let hasMore = false
  if (lastDate) {
    const { count } = await supabaseAdmin
      .from('matches')
      .select('*', { count: 'exact', head: true })
      .eq('tournament_id', tournamentId)
      .gt('match_start_time', lastDate)
    hasMore = (count ?? 0) > 0
  }

  return NextResponse.json({ matches: data, hasMore, hasPast }, {
    headers: { 'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60' },
  })
}
