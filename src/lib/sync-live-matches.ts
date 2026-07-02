// SEC-04: מייבא supabaseAdmin מ-lib/supabase-admin במקום ליצור instance חדש בכל קריאה.
import { supabaseAdmin } from './supabase-admin'
import { scoreMatch } from './bet-scoring'

// PERF-06: rate limit ב-DB — מונע sync כפול כשיש מספר serverless instances
const SYNC_INTERVAL_MS = 55_000

function mapStatus(short: string): string {
  if (['FT', 'AET', 'PEN', 'AWD', 'WO'].includes(short)) return 'finished'
  if (['1H', '2H', 'ET', 'P', 'LIVE', 'HT', 'BT'].includes(short)) return 'live'
  return 'scheduled'
}

/**
 * מסנכרן משחקים חיים/קרובים מ-API-Football → Supabase.
 * מחזיר את מספר המשחקים שעודכנו.
 */
export async function syncLiveMatches(opts: {
  tournamentId?: string  // אם לא מסופק — כל הטורנירים
}): Promise<number> {
  const apiKey = process.env.API_FOOTBALL_KEY
  if (!apiKey) return 0

  const now = new Date()

  // PERF-06: בדוק last_synced_at ב-DB לפני שמתחילים (distributed rate limit)
  if (opts.tournamentId) {
    const { data: t } = await supabaseAdmin
      .from('tournaments')
      .select('last_synced_at')
      .eq('id', opts.tournamentId)
      .single()
    if (t?.last_synced_at) {
      const elapsed = now.getTime() - new Date(t.last_synced_at).getTime()
      if (elapsed < SYNC_INTERVAL_MS) return 0
    }
    // סמן sync מיידית (אופטימיסטי) כדי לחסום instances מקבילים
    await supabaseAdmin
      .from('tournaments')
      .update({ last_synced_at: now.toISOString() })
      .eq('id', opts.tournamentId)
  }

  const windowStart = new Date(now.getTime() - 3 * 60 * 60 * 1000).toISOString()
  const windowEnd   = new Date(now.getTime() + 30 * 60 * 1000).toISOString()

  // Include matches in the normal time window OR any match still stuck in 'live'
  // (stuck matches have match_start_time older than 3h and never got synced to 'finished')
  let query = supabaseAdmin
    .from('matches')
    .select('id, api_fixture_id, tournament_id, status, actual_home_score, actual_away_score')
    .neq('status', 'finished')
    .not('api_fixture_id', 'is', null)
    .lte('match_start_time', windowEnd)
    .or(`and(match_start_time.gte.${windowStart},match_start_time.lte.${windowEnd}),status.eq.live`)

  if (opts.tournamentId) {
    query = query.eq('tournament_id', opts.tournamentId)
  }

  const { data: matchesRaw } = await query
  if (!matchesRaw?.length) return 0

  // dedup by api_fixture_id — אותו משחק יכול להופיע בכמה טורנירים
  const seen = new Set<number>()
  const matches = matchesRaw.filter((m: { api_fixture_id: number }) => {
    if (seen.has(m.api_fixture_id)) return false
    seen.add(m.api_fixture_id)
    return true
  })

  const BATCH = 20
  let synced = 0

  for (let i = 0; i < matches.length; i += BATCH) {
    const batch = matches.slice(i, i + BATCH)
    const ids   = batch.map((m: { api_fixture_id: number }) => m.api_fixture_id).join('-')

    const res = await fetch(
      `https://v3.football.api-sports.io/fixtures?ids=${ids}`,
      { headers: { 'x-apisports-key': apiKey }, cache: 'no-store' }
    )
    if (!res.ok) continue

    const json = await res.json()
    const fixtures: {
      fixture: { id: number; status: { short: string; elapsed: number | null } }
      goals: { home: number | null; away: number | null }
      score: { fulltime: { home: number | null; away: number | null } }
    }[] = json.response ?? []

    for (const f of fixtures) {
      const status = mapStatus(f.fixture.status.short)
      const isLive     = status === 'live'
      const isFinished = status === 'finished'

      const fields: Record<string, unknown> = {
        status,
        elapsed_minutes: isLive ? (f.fixture.status.elapsed ?? null) : null,
        match_period:    isLive ? (f.fixture.status.short   ?? null) : null,
      }

      if (isLive) {
        if (f.goals.home !== null && f.goals.home !== undefined) fields.actual_home_score = f.goals.home
        if (f.goals.away !== null && f.goals.away !== undefined) fields.actual_away_score = f.goals.away
      } else if (isFinished) {
        // goals = התוצאה הסופית כולל הארכה (AET); fulltime = רק תום 90 דק'.
        // מעדיפים goals כדי לא לאבד שערי הארכה.
        const fh = f.goals.home ?? f.score.fulltime.home
        const fa = f.goals.away ?? f.score.fulltime.away
        if (fh !== null && fh !== undefined) fields.actual_home_score = fh
        if (fa !== null && fa !== undefined) fields.actual_away_score = fa
      }

      await supabaseAdmin
        .from('matches')
        .update(fields)
        .eq('api_fixture_id', f.fixture.id)
      synced++

      // עדכון ניקוד — גם כשהמשחק עדיין live (ניקוד "חי" ב-DB, מתעדכן בכל סנכרון)
      // וגם ברגע שהוא הופך ל-finished (ניקוד סופי). הפונקציה אידמפוטנטית,
      // כך שאין הבדל בין הרצה במהלך המשחק להרצה בסיומו — מנגנון אחד בלבד.
      const dbMatch = batch.find(
        (m: { id: string; api_fixture_id: number; status: string; actual_home_score: number | null; actual_away_score: number | null }) =>
          m.api_fixture_id === f.fixture.id
      )
      if (dbMatch && isFinished) {
        // נופל לערך החי האחרון שנשמר ב-DB אם הספק עדיין לא החזיר תוצאת סיום —
        // כך שלא "מאפסים" בטעות את הניקוד של כולם ל-0:0 בטיק המעבר ל-finished
        const home = f.goals.home ?? f.score.fulltime.home ?? dbMatch.actual_home_score ?? 0
        const away = f.goals.away ?? f.score.fulltime.away ?? dbMatch.actual_away_score ?? 0
        await scoreMatch(dbMatch.id, { home, away })
      } else if (dbMatch && isLive) {
        const home = f.goals.home ?? (dbMatch as unknown as { actual_home_score: number | null }).actual_home_score ?? 0
        const away = f.goals.away ?? (dbMatch as unknown as { actual_away_score: number | null }).actual_away_score ?? 0
        await scoreMatch(dbMatch.id, { home, away })
      }

      // סנכרון events למשחקים חיים — delete + insert בכל טיק
      if (isLive && dbMatch) {
        const evRes = await fetch(
          `https://v3.football.api-sports.io/fixtures/events?fixture=${f.fixture.id}`,
          { headers: { 'x-apisports-key': apiKey }, cache: 'no-store' }
        )
        if (evRes.ok) {
          const evJson = await evRes.json()
          const events: {
            time: { elapsed: number }
            team: { id: number; name: string }
            player: { id: number | null; name: string | null }
            type: string
            detail: string
          }[] = evJson.response ?? []

          await supabaseAdmin.from('fixture_events').delete().eq('api_fixture_id', f.fixture.id)
          if (events.length > 0) {
            await supabaseAdmin.from('fixture_events').insert(
              events.map(e => ({
                api_fixture_id: f.fixture.id,
                tournament_id:  (dbMatch as unknown as { tournament_id: string }).tournament_id,
                type:           e.type,
                detail:         e.detail,
                player_id:      e.player.id ?? null,
                player_name:    e.player.name ?? null,
                team_id:        e.team.id ?? null,
                team_name:      e.team.name ?? null,
                elapsed:        e.time.elapsed ?? null,
              }))
            )
          }
        }
      }
    }
  }

  // Self-healing: matches can end up status='finished' without scoring ever
  // running (e.g. sync-fixtures upserts the final result/status directly).
  // Find any finished match that still has unscored bets and score it now.
  const { data: unscoredBets } = await supabaseAdmin
    .from('bets')
    .select('match_id')
    .is('points', null)

  if (unscoredBets?.length) {
    const matchIds = [...new Set(unscoredBets.map((b: { match_id: string }) => b.match_id))]

    let finishedQuery = supabaseAdmin
      .from('matches')
      .select('id, actual_home_score, actual_away_score, tournament_id')
      .eq('status', 'finished')
      .not('actual_home_score', 'is', null)
      .not('actual_away_score', 'is', null)
      .in('id', matchIds)

    if (opts.tournamentId) {
      finishedQuery = finishedQuery.eq('tournament_id', opts.tournamentId)
    }

    const { data: finishedUnscored } = await finishedQuery
    for (const m of finishedUnscored ?? []) {
      await scoreMatch(m.id, { home: m.actual_home_score!, away: m.actual_away_score! })
    }
  }

  return synced
}
