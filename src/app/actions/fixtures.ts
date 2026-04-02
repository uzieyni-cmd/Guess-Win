'use server'

import { supabaseAdmin } from '@/lib/supabase-admin'
import { requireAdmin } from '@/lib/auth-server'
import { fetchFixtures, fetchFixtureById, fetchOdds, mapFixtureStatus } from '@/lib/api-football'

// סנכרון משחקים מ-API-Football לתחרות קיימת
// fromDate (YYYY-MM-DD) — אופציונלי: אם מוגדר, שולף רק משחקים מתאריך זה והלאה (לcron יומי)
export async function syncFixtures(
  tournamentId: string,
  leagueId: number,
  season: number,
  fromDate?: string,
): Promise<{ synced: number; error?: string }> {
  await requireAdmin()
  try {
    // noCache=true כשמסנכרן ידנית מניהול — חייבים נתונים טריים מה-API
    const noCache = !fromDate
    const fixtures = await fetchFixtures(leagueId, season, fromDate, noCache)

    const rows = fixtures.map((f) => ({
      tournament_id: tournamentId,
      home_team_id: String(f.teams.home.id),
      home_team_name: f.teams.home.name,
      home_team_short: f.teams.home.name.slice(0, 3).toUpperCase(),
      home_team_flag: f.teams.home.logo,
      away_team_id: String(f.teams.away.id),
      away_team_name: f.teams.away.name,
      away_team_short: f.teams.away.name.slice(0, 3).toUpperCase(),
      away_team_flag: f.teams.away.logo,
      match_start_time: f.fixture.date,
      status: mapFixtureStatus(f.fixture.status.short),
      actual_home_score: f.score.fulltime.home ?? null,
      actual_away_score: f.score.fulltime.away ?? null,
      api_fixture_id: f.fixture.id,
      round: f.league.round ?? null,
    }))

    // Upsert in batches of 50 — explicit ignoreDuplicates:false so existing rows get updated too
    const BATCH = 50
    for (let i = 0; i < rows.length; i += BATCH) {
      const batch = rows.slice(i, i + BATCH)
      const { error } = await supabaseAdmin
        .from('matches')
        .upsert(batch, { onConflict: 'api_fixture_id', ignoreDuplicates: false })
      if (error) throw error
    }

    return { synced: rows.length }
  } catch (err) {
    return { synced: 0, error: String(err) }
  }
}

// סנכרון יחסי הימורים (Bet365) לכל המשחקים הקרובים בטורניר
export async function syncOdds(
  tournamentId: string,
): Promise<{ synced: number; error?: string }> {
  await requireAdmin()
  try {
    const { data: matches } = await supabaseAdmin
      .from('matches')
      .select('id, api_fixture_id')
      .eq('tournament_id', tournamentId)
      .eq('status', 'scheduled')
      .not('api_fixture_id', 'is', null)

    if (!matches?.length) return { synced: 0 }

    let synced = 0
    for (const m of matches as { id: string; api_fixture_id: number }[]) {
      const odds = await fetchOdds(m.api_fixture_id)
      if (!odds) continue
      await supabaseAdmin
        .from('matches')
        .update({ odds_home: odds.home, odds_draw: odds.draw, odds_away: odds.away, odds_updated_at: new Date().toISOString() })
        .eq('id', m.id)
      synced++
    }
    return { synced }
  } catch (err) {
    return { synced: 0, error: String(err) }
  }
}

// עדכון תוצאות של משחק ספציפי
export async function refreshMatchResult(
  fixtureId: number
): Promise<{ ok: boolean; error?: string }> {
  await requireAdmin()
  try {
    const fixture = await fetchFixtureById(fixtureId)
    if (!fixture) return { ok: false, error: 'Fixture not found' }

    const { error } = await supabaseAdmin
      .from('matches')
      .update({
        status: mapFixtureStatus(fixture.fixture.status.short),
        actual_home_score: fixture.score.fulltime.home ?? null,
        actual_away_score: fixture.score.fulltime.away ?? null,
      })
      .eq('api_fixture_id', fixtureId)

    if (error) throw error
    return { ok: true }
  } catch (err) {
    return { ok: false, error: String(err) }
  }
}

// עדכון ידני של תוצאה (Admin)
export async function setMatchScore(
  matchId: string,
  homeScore: number,
  awayScore: number
): Promise<{ ok: boolean; error?: string }> {
  await requireAdmin()
  try {
    const { error } = await supabaseAdmin
      .from('matches')
      .update({ actual_home_score: homeScore, actual_away_score: awayScore, status: 'finished' })
      .eq('id', matchId)

    if (error) throw error
    return { ok: true }
  } catch (err) {
    return { ok: false, error: String(err) }
  }
}
