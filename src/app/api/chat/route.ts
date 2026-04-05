import { createOpenAI } from '@ai-sdk/openai'
import { streamText } from 'ai'
import { NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { translateTeam } from '@/lib/teams-he'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

const gateway = createOpenAI({
  baseURL: 'https://ai-gateway.vercel.sh/v1',
  apiKey: process.env.AI_GATEWAY_API_KEY ?? '',
})

export async function POST(req: NextRequest) {
  const { messages, tournamentId, userId } = await req.json()

  if (!messages?.length) {
    return new Response('Missing messages', { status: 400 })
  }

  // ── שלוף context מ-Supabase ──────────────────────────────────
  let contextBlock = ''

  if (tournamentId) {
    const [standingsRes, matchesRes, userBetsRes] = await Promise.all([
      // standings — נקודות לכל משתתף
      supabaseAdmin
        .from('bets')
        .select('user_id, points, profiles(display_name)')
        .eq('tournament_id', tournamentId)
        .not('points', 'is', null),

      // משחקים אחרונים (30 אחרונים)
      supabaseAdmin
        .from('matches')
        .select('home_team_name, away_team_name, actual_home_score, actual_away_score, status, match_start_time, round')
        .eq('tournament_id', tournamentId)
        .order('match_start_time', { ascending: false })
        .limit(30),

      // הניחושים של המשתמש הנוכחי
      userId
        ? supabaseAdmin
            .from('bets')
            .select('match_id, predicted_home, predicted_away, points, result, matches(home_team_name, away_team_name, status)')
            .eq('tournament_id', tournamentId)
            .eq('user_id', userId)
        : Promise.resolve({ data: [] }),
    ])

    // חשב standings
    const pointsByUser: Record<string, { name: string; points: number }> = {}
    for (const row of standingsRes.data ?? []) {
      const r = row as unknown as { user_id: string; points: number; profiles: { display_name: string }[] | { display_name: string } | null }
      const profileName = Array.isArray(r.profiles)
        ? r.profiles[0]?.display_name
        : r.profiles?.display_name
      if (!pointsByUser[r.user_id]) {
        pointsByUser[r.user_id] = { name: profileName ?? 'משתתף', points: 0 }
      }
      pointsByUser[r.user_id].points += r.points
    }
    const standings = Object.values(pointsByUser)
      .sort((a, b) => b.points - a.points)
      .map((s, i) => `${i + 1}. ${s.name} — ${s.points} נקודות`)

    // משחקים
    const matches = (matchesRes.data ?? []).map(m => {
      const r = m as unknown as { home_team_name: string; away_team_name: string; actual_home_score: number | null; actual_away_score: number | null; status: string; round: string | null }
      const home = translateTeam(r.home_team_name)
      const away = translateTeam(r.away_team_name)
      const score = r.actual_home_score !== null ? `${r.actual_home_score}:${r.actual_away_score}` : 'טרם שוחק'
      const status = r.status === 'finished' ? 'הסתיים' : r.status === 'live' ? 'חי' : 'מתוכנן'
      return `${home} נגד ${away} | תוצאה: ${score} | סטטוס: ${status}${r.round ? ` | סיבוב: ${r.round}` : ''}`
    })

    // ניחושי המשתמש
    const userBets = (userBetsRes.data ?? []).map(b => {
      const r = b as unknown as { predicted_home: number; predicted_away: number; points: number | null; result: string | null; matches: { home_team_name: string; away_team_name: string; status: string } | null }
      const home = translateTeam(r.matches?.home_team_name ?? '')
      const away = translateTeam(r.matches?.away_team_name ?? '')
      const pts = r.points !== null ? `${r.points} נק'` : 'טרם חושב'
      return `${home} נגד ${away}: ניחשת ${r.predicted_home}:${r.predicted_away} | ${pts}`
    })

    contextBlock = `
=== נתוני הטורניר ===
טבלת דירוג:
${standings.length ? standings.join('\n') : 'אין נתונים עדיין'}

משחקים אחרונים:
${matches.length ? matches.join('\n') : 'אין משחקים'}

${userBets.length ? `הניחושים שלך:\n${userBets.join('\n')}` : ''}
`
  }

  const systemPrompt = `אתה עוזר חכם של אתר Guess & Win — אתר ניחושי כדורגל.
תפקידך לענות רק על שאלות הקשורות לאתר: דירוגים, ניחושים, תוצאות, כללי הניקוד, משחקים.
אם שואלים אותך על נושאים אחרים — סרב בנימוס והפנה לשאלות על האתר.
ענה תמיד בעברית, בצורה קצרה וברורה.

כללי ניקוד:
- תוצאה מדויקת: 3 נקודות
- כיוון נכון (ניצחון/תיקו): 1 נקודה
- טעות: 0 נקודות

${contextBlock}`

  const result = streamText({
    model: gateway('google/gemini-2.0-flash-lite'),
    system: systemPrompt,
    messages,
    maxTokens: 400,
  })

  return result.toDataStreamResponse()
}
