import { createOpenAI } from '@ai-sdk/openai'
import { generateText } from 'ai'
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
      messages: { role: 'user' | 'assistant'; content: string }[]
      tournamentId?: string
      userId?: string
    }

    if (!messages?.length) {
      return NextResponse.json({ error: 'Missing messages' }, { status: 400 })
    }

    // ── שלוף context מ-Supabase ──────────────────────────────────
    let contextBlock = ''

    if (tournamentId) {
      const [participantsRes, finishedMatchesRes, upcomingMatchesRes, userBetsRes, scoredBetsRes, bonusPicksRes] = await Promise.all([
        // Participants list for this tournament
        supabaseAdmin
          .from('tournament_participants')
          .select('user_id')
          .eq('tournament_id', tournamentId),

        // Finished matches — primary results data source
        supabaseAdmin
          .from('matches')
          .select('home_team_name, away_team_name, actual_home_score, actual_away_score, status, match_start_time, round')
          .eq('tournament_id', tournamentId)
          .eq('status', 'finished')
          .order('match_start_time', { ascending: false })
          .limit(50),

        // Upcoming / live matches (with odds)
        supabaseAdmin
          .from('matches')
          .select('home_team_name, away_team_name, actual_home_score, actual_away_score, status, match_start_time, round, odds_home, odds_draw, odds_away')
          .eq('tournament_id', tournamentId)
          .neq('status', 'finished')
          .order('match_start_time', { ascending: true })
          .limit(20),

        userId
          ? supabaseAdmin
              .from('bets')
              .select('match_id, predicted_home, predicted_away, points, result, matches(home_team_name, away_team_name, status)')
              .eq('tournament_id', tournamentId)
              .eq('user_id', userId)
          : Promise.resolve({ data: [] }),

        // All bets for standings
        supabaseAdmin
          .from('bets')
          .select('user_id, points')
          .eq('tournament_id', tournamentId),

        // Bonus picks points
        supabaseAdmin
          .from('bonus_picks')
          .select('user_id, points_awarded')
          .eq('tournament_id', tournamentId)
          .not('points_awarded', 'is', null),
      ])

      // standings — replicate TournamentContext logic exactly
      const participantIds = (participantsRes.data ?? []).map(
        (p: { user_id: string }) => p.user_id
      )

      // Fetch profiles for participants
      const profilesRes = participantIds.length
        ? await supabaseAdmin
            .from('profiles')
            .select('id, display_name')
            .in('id', participantIds)
        : { data: [] }

      const nameById: Record<string, string> = {}
      for (const p of (profilesRes.data ?? []) as { id: string; display_name: string }[]) {
        nameById[p.id] = p.display_name
      }

      // Sum points per user (filter nulls in JS)
      const pointsByUser: Record<string, number> = {}
      for (const row of (scoredBetsRes.data ?? []) as { user_id: string; points: number | null }[]) {
        if (row.points === null || row.points === undefined) continue
        pointsByUser[row.user_id] = (pointsByUser[row.user_id] ?? 0) + row.points
      }
      for (const row of (bonusPicksRes.data ?? []) as { user_id: string; points_awarded: number }[]) {
        pointsByUser[row.user_id] = (pointsByUser[row.user_id] ?? 0) + row.points_awarded
      }

      // Build standings for ALL participants (same as leaderboard page)
      const standings = participantIds
        .map((uid: string) => ({
          name: nameById[uid] ?? 'משתתף',
          points: pointsByUser[uid] ?? 0,
        }))
        .sort((a: { points: number }, b: { points: number }) => b.points - a.points)
        .map((s: { name: string; points: number }, i: number) => `${i + 1}. ${s.name} — ${s.points} נקודות`)

      type MatchRow = { home_team_name: string; away_team_name: string; actual_home_score: number | null; actual_away_score: number | null; status: string; round: string | null; odds_home?: number | null; odds_draw?: number | null; odds_away?: number | null }

      const finishedMatches = (finishedMatchesRes.data ?? []).map(m => {
        const r = m as unknown as MatchRow
        const home = translateTeam(r.home_team_name)
        const away = translateTeam(r.away_team_name)
        return `${home} ${r.actual_home_score}:${r.actual_away_score} ${away}${r.round ? ` (${r.round})` : ''}`
      })

      // Helper: recent form of a team from finished matches (last 5)
      const finishedRaw = (finishedMatchesRes.data ?? []) as unknown as MatchRow[]
      const teamForm = (teamName: string): string => {
        const results = finishedRaw
          .filter(m => m.home_team_name === teamName || m.away_team_name === teamName)
          .slice(0, 5)
          .map(m => {
            const isHome = m.home_team_name === teamName
            const gs = isHome ? m.actual_home_score! : m.actual_away_score!
            const ga = isHome ? m.actual_away_score! : m.actual_home_score!
            const opp = translateTeam(isHome ? m.away_team_name : m.home_team_name)
            const result = gs > ga ? 'נ' : gs < ga ? 'ה' : 'ת'
            return `${result}(${gs}:${ga} מול ${opp})`
          })
        return results.length ? results.join(', ') : 'אין היסטוריה'
      }

      const upcomingMatches = (upcomingMatchesRes.data ?? []).map(m => {
        const r = m as unknown as MatchRow
        const home = translateTeam(r.home_team_name)
        const away = translateTeam(r.away_team_name)
        const status = r.status === 'live' ? 'חי כעת' : 'מתוכנן'
        const score = r.actual_home_score !== null ? ` ${r.actual_home_score}:${r.actual_away_score}` : ''
        let oddsStr = ''
        if (r.odds_home && r.odds_draw && r.odds_away) {
          const fav = r.odds_home < r.odds_away
            ? `${home} מועדף`
            : r.odds_away < r.odds_home
              ? `${away} מועדף`
              : 'שוויון'
          oddsStr = ` | יחסים: ${home} ${r.odds_home} / תיקו ${r.odds_draw} / ${away} ${r.odds_away} (${fav})`
        }
        const homeForm = teamForm(r.home_team_name)
        const awayForm = teamForm(r.away_team_name)
        const formStr = ` | ${home} לאחרונה: ${homeForm} | ${away} לאחרונה: ${awayForm}`
        return `${home} נגד ${away}${score} | ${status}${r.round ? ` | ${r.round}` : ''}${oddsStr}${formStr}`
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

תוצאות משחקים שהסתיימו:
${finishedMatches.length ? finishedMatches.join('\n') : 'אין משחקים שהסתיימו עדיין'}

משחקים עתידיים / חיים:
${upcomingMatches.length ? upcomingMatches.join('\n') : 'אין משחקים מתוכננים'}

${userBets.length ? `הניחושים שלך:\n${userBets.join('\n')}` : ''}
`
    }

    const systemPrompt = `אתה עוזר של אתר Guess & Win — אתר ניחושי כדורגל.
ענה רק על שאלות על האתר: דירוגים, ניחושים, תוצאות משחקים, כללי ניקוד.
אם שואלים על נושא אחר — סרב בנימוס.
ענה בעברית, קצר וברור.

כללי ניקוד: תוצאה מדויקת (בול) = 10 נק', כיוון נכון (ניצחון/תיקו/הפסד) = 5 נק', טעות = 0.

בסעיף "תוצאות משחקים שהסתיימו" מופיעות כל התוצאות הסופיות — השתמש בהן כמקור הסמכותי לכל שאלה על תוצאת משחק.
הפורמט: קבוצה_בית תוצאה_בית:תוצאה_חוץ קבוצה_חוץ

בסעיף "משחקים עתידיים" מופיעים:
- יחסי הימורים של Bet365 (יחס נמוך = סיכוי גבוה)
- ביצועים אחרונים של כל קבוצה: נ=ניצחון, ת=תיקו, ה=הפסד

כשמישהו שואל על תחזית / ניחוש / מי ינצח:
1. נתח את הביצועים האחרונים של שתי הקבוצות
2. השתמש ביחסים כאינדיקטור נוסף
3. תן המלצה מנומקת קצרה
${contextBlock}`

    // סנן הודעות assistant ראשונות — LLM צריך להתחיל עם user
    const filteredMessages = messages.filter((m, i) =>
      !(i === 0 && m.role === 'assistant')
    )

    const { text } = await generateText({
      model: gateway('google/gemini-2.0-flash-lite'),
      system: systemPrompt,
      messages: filteredMessages,
    })

    return NextResponse.json({ text })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[/api/chat] error:', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
