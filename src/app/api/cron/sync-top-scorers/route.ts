import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

export const runtime = 'nodejs'
export const maxDuration = 60

// Vercel Cron — כל שעתיים בין 19:00 ל-07:00 שעון ישראל (ראה vercel.json)
// מחשב את טבלת מלכי השערים מתוך fixture_events שלנו (הגולים שנרשמו במשחקים
// בפועל) במקום להסתמך על /players/topscorers של ה-API — שהתגלה כלא-עקבי עם
// תוצאות המשחקים. הצבירה היא לפי תחרות (api_league_id + api_season); אירועים
// של טורנירים ששותפים לאותה תחרות (בתים + נוקאאוט) מאוחדים יחד.
export async function GET(req: Request) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: tournaments, error } = await supabaseAdmin
    .from('tournaments')
    .select('id, api_league_id, api_season')
    .eq('status', 'active')
    .not('api_league_id', 'is', null)
    .not('api_season', 'is', null)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!tournaments?.length) return NextResponse.json({ synced: 0 })

  // קבץ tournament_ids לפי תחרות — אירועי אותה תחרות מפוצלים בין כמה טורנירים
  const byComp = new Map<string, { league: number; season: number; tournamentIds: string[] }>()
  for (const t of tournaments as { id: string; api_league_id: number; api_season: number }[]) {
    const key = `${t.api_league_id}:${t.api_season}`
    const entry = byComp.get(key) ?? { league: t.api_league_id, season: t.api_season, tournamentIds: [] }
    entry.tournamentIds.push(t.id)
    byComp.set(key, entry)
  }

  let synced = 0
  let failed = 0
  const errors: string[] = []

  for (const { league, season, tournamentIds } of byComp.values()) {
    try {
      const { data: events, error: evErr } = await supabaseAdmin
        .from('fixture_events')
        .select('api_fixture_id, player_id, player_name, team_name, detail, elapsed, assist_player_id, assist_player_name')
        .in('tournament_id', tournamentIds)
        .eq('type', 'Goal') as {
          data: {
            api_fixture_id: number; player_id: number | null; player_name: string | null
            team_name: string | null; detail: string; elapsed: number | null
            assist_player_id: number | null; assist_player_name: string | null
          }[] | null
          error: { message: string } | null
        }
      if (evErr) throw new Error(evErr.message)

      // צבירה לפי player_id (השמות מגיעים בכמה צורות כתיב לאותו שחקן, למשל
      // "K. Mbappe" / "Kylian Mbappé" — אז מקבצים לפי id ולא לפי שם).
      // גול = Normal Goal / Penalty (לא Own Goal ולא Missed Penalty).
      // כל fixture נשמר פעם אחת ב-fixture_events, אז אין צורך ב-dedup.
      type Agg = { playerId: number; name: string; team: string | null; goals: number; assists: number }
      const players = new Map<number, Agg>()

      const upsert = (id: number, name: string | null, team: string | null) => {
        const a = players.get(id) ?? { playerId: id, name: '', team: null, goals: 0, assists: 0 }
        // מעדיפים את צורת השם המלאה/הארוכה לתצוגה
        if (name && name.length > a.name.length) a.name = name
        if (team && !a.team) a.team = team
        players.set(id, a)
        return a
      }

      for (const e of events ?? []) {
        if (e.detail !== 'Normal Goal' && e.detail !== 'Penalty') continue
        if (e.player_id == null) continue

        upsert(e.player_id, e.player_name, e.team_name).goals += 1
        if (e.assist_player_id != null) {
          upsert(e.assist_player_id, e.assist_player_name, null).assists += 1
        }
      }

      // מלכי שערים = מי שהבקיע לפחות גול אחד; מיון לפי גולים ואז בישולים
      const ranked = [...players.values()]
        .filter(p => p.goals > 0)
        .sort((a, b) => b.goals - a.goals || b.assists - a.assists)
        .slice(0, 20)

      await supabaseAdmin
        .from('top_scorers')
        .delete()
        .eq('api_league_id', league)
        .eq('api_season', season)

      if (ranked.length > 0) {
        const rows = ranked.map((p, i) => ({
          api_league_id: league,
          api_season:    season,
          rank:          i + 1,
          player_id:     p.playerId,
          player_name:   p.name || `#${p.playerId}`,
          photo:         `https://media.api-sports.io/football/players/${p.playerId}.png`,
          team_id:       null,
          team_name:     p.team,
          team_logo:     null,
          goals:         p.goals,
          assists:       p.assists,
          penalties:     null,
          appearances:   null,
        }))

        const { error: insertErr } = await supabaseAdmin
          .from('top_scorers')
          .insert(rows)

        if (insertErr) throw new Error(insertErr.message)
      }

      synced++
    } catch (err) {
      failed++
      errors.push(`league ${league}/${season}: ${err instanceof Error ? err.message : JSON.stringify(err)}`)
    }
  }

  return NextResponse.json({
    synced,
    failed,
    total: byComp.size,
    ...(errors.length ? { errors } : {}),
    at: new Date().toISOString(),
  })
}
