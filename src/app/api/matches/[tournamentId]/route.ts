import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { translateTeam } from '@/lib/teams-he'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function translateMatches(rows: any[]): any[] {
  return rows.map(m => ({
    ...m,
    home_team_name: translateTeam(m.home_team_name),
    away_team_name: translateTeam(m.away_team_name),
  }))
}

export const revalidate = 30

const COLS =
  'id,tournament_id,home_team_id,home_team_name,home_team_short,home_team_flag,' +
  'away_team_id,away_team_name,away_team_short,away_team_flag,' +
  'match_start_time,status,actual_home_score,actual_away_score,api_fixture_id,round,elapsed_minutes,match_period,' +
  'odds_home,odds_draw,odds_away,hidden'

const WINDOW_FUTURE = 60  // ימים קדימה לחלון הראשוני
const PAGE_SIZE     = 20  // גודל דף infinite scroll

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ tournamentId: string }> }
) {
  const { tournamentId } = await params
  const sp  = req.nextUrl.searchParams
  const all = sp.get('all') === '1'
  // includeHidden — רק ממשק הניהול מעביר; משתתפים לעולם לא רואים מוסתרים
  const includeHidden = sp.get('includeHidden') === '1'
  // cursor לטעינת משחקים עתידיים — תאריך המשחק האחרון שנטען
  const after = sp.get('after') // ISO string

  const now = new Date()

  // ── מצב 1: infinite scroll — 20 משחקים עתידיים אחרי cursor ──────
  if (after) {
    let q = supabaseAdmin
      .from('matches')
      .select(COLS)
      .eq('tournament_id', tournamentId)
      .gt('match_start_time', after)
      .order('match_start_time', { ascending: true })
      .limit(PAGE_SIZE)
    if (!includeHidden) q = q.eq('hidden', false)
    const { data, error } = await q

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ matches: translateMatches(data ?? []), hasMore: (data?.length ?? 0) === PAGE_SIZE }, {
      headers: { 'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60' },
    })
  }

  // ── מצב 2: all=1 — כל המשחקים (ניהול / כפתור "טען ישנים") ──────
  if (all) {
    let q = supabaseAdmin
      .from('matches')
      .select(COLS)
      .eq('tournament_id', tournamentId)
      .order('match_start_time', { ascending: true })
    if (!includeHidden) q = q.eq('hidden', false)
    const { data, error } = await q

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ matches: translateMatches(data ?? []), hasMore: false }, {
      headers: { 'Cache-Control': 'no-store' },
    })
  }

  // ── מצב 3: טעינה ראשונית — משחקי היום + עתידיים ────────────────
  const todayStart = new Date(now)
  todayStart.setHours(0, 0, 0, 0)
  const to = new Date(now.getTime() + WINDOW_FUTURE * 86400_000).toISOString()

  // כולל: (לא גמורים) OR (גמורים אבל התחילו היום)
  let mainQ = supabaseAdmin
    .from('matches')
    .select(COLS)
    .eq('tournament_id', tournamentId)
    .or(`status.neq.finished,match_start_time.gte.${todayStart.toISOString()}`)
    .lte('match_start_time', to)
    .order('match_start_time', { ascending: true })
  if (!includeHidden) mainQ = mainQ.eq('hidden', false)
  const mainRes = await mainQ
  let data = mainRes.data
  const error = mainRes.error

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // fallback: אין משחקים בחלון — קודם נסה ראשוני (טורניר עתידי), אחר כך אחרונים (טורניר שהסתיים)
  if (!data || data.length === 0) {
    let upcomingQ = supabaseAdmin
      .from('matches')
      .select(COLS)
      .eq('tournament_id', tournamentId)
      .neq('status', 'finished')
      .order('match_start_time', { ascending: true })
      .limit(PAGE_SIZE)
    if (!includeHidden) upcomingQ = upcomingQ.eq('hidden', false)
    const { data: upcoming } = await upcomingQ

    if (upcoming && upcoming.length > 0) {
      data = upcoming
    } else {
      // כל המשחקים הסתיימו — הצג 20 האחרונים
      let lastQ = supabaseAdmin
        .from('matches')
        .select(COLS)
        .eq('tournament_id', tournamentId)
        .order('match_start_time', { ascending: false })
        .limit(PAGE_SIZE)
      if (!includeHidden) lastQ = lastQ.eq('hidden', false)
      const { data: lastMatches } = await lastQ
      data = (lastMatches ?? []).reverse()
    }
  }

  // בדוק hasPast + hasMore במקביל (לא סדרתי)
  const rows = data as unknown as { match_start_time: string }[]
  const oldestInWindow = rows[0]?.match_start_time
  const lastDate       = rows.at(-1)?.match_start_time

  const pastQ = () => {
    let q = supabaseAdmin
      .from('matches')
      .select('id', { count: 'exact', head: true })
      .eq('tournament_id', tournamentId)
      .eq('status', 'finished')
      .lt('match_start_time', oldestInWindow!)
    if (!includeHidden) q = q.eq('hidden', false)
    return q
  }
  const moreQ = () => {
    let q = supabaseAdmin
      .from('matches')
      .select('id', { count: 'exact', head: true })
      .eq('tournament_id', tournamentId)
      .gt('match_start_time', lastDate!)
    if (!includeHidden) q = q.eq('hidden', false)
    return q
  }

  const [hasPastResult, hasMoreResult] = await Promise.all([
    oldestInWindow ? pastQ() : Promise.resolve({ count: 0 }),
    lastDate ? moreQ() : Promise.resolve({ count: 0 }),
  ])

  const hasPast = (hasPastResult.count ?? 0) > 0
  const hasMore = (hasMoreResult.count ?? 0) > 0

  // PERF-04: כשיש משחק חי — cache קצר; אחרת 30s
  const hasLive = (data as unknown as { status: string }[]).some(m => m.status === 'live')
  const cacheControl = hasLive
    ? 'public, s-maxage=5, stale-while-revalidate=10'
    : 'public, s-maxage=30, stale-while-revalidate=60'

  return NextResponse.json({ matches: translateMatches(data as unknown as Record<string, unknown>[]), hasMore, hasPast }, {
    headers: { 'Cache-Control': cacheControl },
  })
}
