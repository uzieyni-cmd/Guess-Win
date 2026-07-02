import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { fetchTopScorers } from '@/lib/api-football'

export const runtime = 'nodejs'
export const maxDuration = 60

// Vercel Cron — כל שעתיים בין 19:00 ל-07:00 שעון ישראל (ראה vercel.json)
// מושך את רשימת מלכי השערים המוכנה מה-API (/players/topscorers) לכל תחרות
// פעילה (api_league_id + api_season) — Delete + Insert מחדש לכל תחרות
export async function GET(req: Request) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: tournaments, error } = await supabaseAdmin
    .from('tournaments')
    .select('api_league_id, api_season')
    .eq('status', 'active')
    .not('api_league_id', 'is', null)
    .not('api_season', 'is', null)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!tournaments?.length) return NextResponse.json({ synced: 0 })

  // dedup — כמה טורנירים יכולים לחלוק אותה תחרות (בתים + נוקאאוט)
  const seen = new Set<string>()
  const competitions = (tournaments as { api_league_id: number; api_season: number }[]).filter(t => {
    const key = `${t.api_league_id}:${t.api_season}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })

  let synced = 0
  let failed = 0
  const errors: string[] = []

  for (const comp of competitions) {
    try {
      const scorers = await fetchTopScorers(comp.api_league_id, comp.api_season)

      await supabaseAdmin
        .from('top_scorers')
        .delete()
        .eq('api_league_id', comp.api_league_id)
        .eq('api_season', comp.api_season)

      if (scorers.length > 0) {
        const rows = scorers.map((s, i) => {
          const stat = s.statistics[0]
          return {
            api_league_id: comp.api_league_id,
            api_season:    comp.api_season,
            rank:          i + 1,
            player_id:     s.player.id,
            player_name:   s.player.name,
            photo:         s.player.photo ?? `https://media.api-sports.io/football/players/${s.player.id}.png`,
            team_id:       stat?.team.id ?? null,
            team_name:     stat?.team.name ?? null,
            team_logo:     stat?.team.logo ?? null,
            goals:         stat?.goals.total ?? 0,
            assists:       stat?.goals.assists ?? null,
            penalties:     stat?.penalty.scored ?? null,
            appearances:   stat?.games.appearences ?? null,
          }
        })

        const { error: insertErr } = await supabaseAdmin
          .from('top_scorers')
          .insert(rows)

        if (insertErr) throw insertErr
      }

      synced++

      // השהיה קצרה בין קריאות API למניעת rate limit
      await new Promise(r => setTimeout(r, 200))
    } catch (err) {
      failed++
      errors.push(`league ${comp.api_league_id}/${comp.api_season}: ${err instanceof Error ? err.message : JSON.stringify(err)}`)
    }
  }

  return NextResponse.json({
    synced,
    failed,
    total: competitions.length,
    ...(errors.length ? { errors } : {}),
    at: new Date().toISOString(),
  })
}
