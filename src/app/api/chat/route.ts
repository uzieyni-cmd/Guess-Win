import { createOpenAI } from '@ai-sdk/openai'
import { streamText, CoreMessage } from 'ai'
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { translateTeam } from '@/lib/teams-he'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

const gateway = createOpenAI({
  baseURL: 'https://ai-gateway.vercel.sh/v1',
  apiKey: process.env.AI_GATEWAY_API_KEY ?? '',
})

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { messages, tournamentId, userId } = body as {
      messages: CoreMessage[]
      tournamentId?: string
      userId?: string
    }

    if (!messages?.length) {
      return NextResponse.json({ error: 'Missing messages' }, { status: 400 })
    }

    // ── שלוף context מ-Supabase ──────────────────────────────────
    let contextBlock = ''

    if (tournamentId) {
      const [standingsRes, matchesRes, userBetsRes] = await Promise.all([
        supabaseAdmin
          .from('bets')
          .select('user_id, points, profiles(display_name)')
          .eq('tournament_id', tournamentId)
          .not('points', 'is', null),

        supabaseAdmin
          .from('matches')
          .select('home_team_name, away_team_name, actual_home_score, actual_away_score, status, match_start_time, round')
          .eq('tournament_id', tournamentId)
          .order('match_start_time', { ascending: false })
          .limit(30),

        userId
          ? supabaseAdmin
              .from('bets')
              .select('match_id, predicted_home, predicted_away, points, result, matches(home_team_name, away_team_name, status)')
              .eq('tournament_id', tournamentId)
              .eq('user_id', userId)
          : Promise.resolve({ data: [] }),
      ])

      // standings
      const pointsByUser: Record<string, { name: string; points: number }> = {}
      for (const row of standingsRes.data ?? []) {
        const r = row as unknown as { user_id: string; points: number; profiles: { display_name: string }[] | { display_name: string } | null }
        const profileName = Array.isArray(r.profiles) ? r.profiles[0]?.display_name : (r.profiles as { display_name: string } | null)?.display_name
        if (!pointsByUser[r.user_id]) pointsByUser[r.user_id] = { name: profileName ?? 'משתתף', points: 0 }
        pointsByUser[r.user_id].points += r.points
      }
      const standings = Object.values(pointsByUser)
        .sort((a, b) => b.points - a.points)
        .map((s, i) => `${i + 1}. ${s.name} — ${s.points} נקודות`)

      // matches
      const matches = (matchesRes.data ?? []).map(m => {
        const r = m as unknown as { home_team_name: string; away_team_name: string; actual_home_score: number | null; actual_away_score: number | null; status: string; round: string | null }
        const home = translateTeam(r.home_team_name)
        const away = translateTeam(r.away_team_name)
        const score = r.actual_home_score !== null ? `${r.actual_home_score}:${r.actual_away_score}` : 'טרם שוחק'
        const status = r.status === 'finished' ? 'הסתיים' : r.status === 'live' ? 'חי' : 'מתוכנן'
        return `${home} נגד ${away} | ${score} | ${status}${r.round ? ` | ${r.round}` : ''}`
      })

      // user bets
      const userBets = (userBetsRes.data ?? []).map(b => {
        const r = b as unknown as { predicted_home: number; predicted_away: number; points: number | null; matches: { home_team_name: string; away_team_name: string } | null }
        const home = translateTeam(r.matches?.home_team_name ?? '')
        const away = translateTeam(r.matches?.away_team_name ?? '')
        return `${home} נגד ${away}: ניחשת ${r.predicted_home}:${r.predicted_away}${r.points !== null ? ` | ${r.points} נק'` : ''}`
      })

      contextBlock = `
=== נתוני הטורניר ===
טבלת דירוג:
${standings.length ? standings.join('\n') : 'אין נתונים עדיין'}

משחקים:
${matches.length ? matches.join('\n') : 'אין משחקים'}

${userBets.length ? `הניחושים שלך:\n${userBets.join('\n')}` : ''}
`
    }

    const systemPrompt = `אתה עוזר של אתר Guess & Win — אתר ניחושי כדורגל.
ענה רק על שאלות על האתר: דירוגים, ניחושים, תוצאות, כללי ניקוד.
אם שואלים על נושא אחר — סרב בנימוס.
ענה בעברית, קצר וברור.

כללי ניקוד: תוצאה מדויקת = 3 נק', כיוון נכון = 1 נק', טעות = 0.
${contextBlock}`

    // סנן הודעות assistant ראשונות — LLM צריך להתחיל עם user
    const filteredMessages = messages.filter((m, i) =>
      !(i === 0 && m.role === 'assistant')
    ) as CoreMessage[]

    const result = streamText({
      model: gateway('google/gemini-2.0-flash-lite'),
      system: systemPrompt,
      messages: filteredMessages,
    })

    return result.toTextStreamResponse()
  } catch (err) {
    console.error('[/api/chat] error:', err)
    return NextResponse.json({ error: 'שגיאת שרת' }, { status: 500 })
  }
}
