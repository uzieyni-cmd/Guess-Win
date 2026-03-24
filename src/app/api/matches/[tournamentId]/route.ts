import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

export const revalidate = 30

const COLS =
  'id,tournament_id,home_team_id,home_team_name,home_team_short,home_team_flag,' +
  'away_team_id,away_team_name,away_team_short,away_team_flag,' +
  'match_start_time,status,actual_home_score,actual_away_score,api_fixture_id'

const WINDOW_PAST   = 7   // ימים אחורה לחלון הראשוני
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

  // ── מצב 2: טעינת כל המשחקים (כפתור "טען הכל") ────────────────
  if (all) {
    const { data, error } = await supabaseAdmin
      .from('matches')
      .select(COLS)
      .eq('tournament_id', tournamentId)
      .lte('match_start_time', now.toISOString()) // ישנים בלבד
      .order('match_start_time', { ascending: true })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ matches: data ?? [], hasMore: false }, {
      headers: { 'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60' },
    })
  }

  // ── מצב 3: חלון ראשוני — עבר קרוב + עתיד קרוב ────────────────
  const from = new Date(now.getTime() - WINDOW_PAST   * 86400_000).toISOString()
  const to   = new Date(now.getTime() + WINDOW_FUTURE * 86400_000).toISOString()

  let { data, error } = await supabaseAdmin
    .from('matches')
    .select(COLS)
    .eq('tournament_id', tournamentId)
    .gte('match_start_time', from)
    .lte('match_start_time', to)
    .order('match_start_time', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // fallback: אין משחקים בחלון — החזר 20 הקרובים ביותר
  if (!data || data.length === 0) {
    const { data: fallback } = await supabaseAdmin
      .from('matches')
      .select(COLS)
      .eq('tournament_id', tournamentId)
      .gte('match_start_time', now.toISOString())
      .order('match_start_time', { ascending: true })
      .limit(PAGE_SIZE)
    data = fallback ?? []
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

  return NextResponse.json({ matches: data, hasMore }, {
    headers: { 'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60' },
  })
}
