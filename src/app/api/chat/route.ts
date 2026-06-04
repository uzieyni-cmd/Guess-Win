import { createOpenAI } from '@ai-sdk/openai'
import { generateText } from 'ai'
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { translateTeam } from '@/lib/teams-he'
import { fetchTeamRecentMatches } from '@/lib/api-football'

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
    let tournamentName = ''
    let currentUserName = ''

    // Fetch tournament name + current user name in parallel upfront
    const [tournamentRes, userProfileRes] = await Promise.all([
      tournamentId
        ? supabaseAdmin.from('tournaments').select('name').eq('id', tournamentId).single()
        : Promise.resolve({ data: null }),
      userId
        ? supabaseAdmin.from('profiles').select('display_name').eq('id', userId).single()
        : Promise.resolve({ data: null }),
    ])
    if (tournamentRes.data) tournamentName = (tournamentRes.data as { name: string }).name
    if (userProfileRes.data) currentUserName = (userProfileRes.data as { display_name: string }).display_name

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
              .select('match_id, predicted_home, predicted_away, points, result')
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

      type MatchRow = { home_team_name: string; away_team_name: string; actual_home_score: number | null; actual_away_score: number | null; status: string; round: string | null; match_start_time?: string | null; odds_home?: number | null; odds_draw?: number | null; odds_away?: number | null }

      const toIsraelTime = (iso: string) =>
        new Date(iso).toLocaleString('he-IL', { timeZone: 'Asia/Jerusalem', weekday: 'short', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })

      const finishedMatches = (finishedMatchesRes.data ?? []).map(m => {
        const r = m as unknown as MatchRow
        const home = translateTeam(r.home_team_name)
        const away = translateTeam(r.away_team_name)
        const timeStr = r.match_start_time ? ` | ${toIsraelTime(r.match_start_time)}` : ''
        const roundStr = r.round ? ` | ${r.round}` : ''
        return `${home} ${r.actual_home_score}:${r.actual_away_score} ${away}${timeStr}${roundStr}`
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

      const nowMs = Date.now()
      const upcomingMatches = (upcomingMatchesRes.data ?? []).map(m => {
        const r = m as unknown as MatchRow & { match_start_time?: string }
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
          oddsStr = ` | סיכויים סטטיסטיים: ${home} ${r.odds_home} / תיקו ${r.odds_draw} / ${away} ${r.odds_away} (${fav})`
        }
        const homeForm = teamForm(r.home_team_name)
        const awayForm = teamForm(r.away_team_name)
        const formStr = ` | ${home} לאחרונה: ${homeForm} | ${away} לאחרונה: ${awayForm}`
        let timeStr = ''
        if (r.match_start_time) {
          const matchMs = new Date(r.match_start_time).getTime()
          const hoursUntil = Math.round((matchMs - nowMs) / 36e5 * 10) / 10
          const localTime = new Date(r.match_start_time).toLocaleString('he-IL', { timeZone: 'Asia/Jerusalem', hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' })
          timeStr = ` | מועד: ${localTime} (בעוד ${hoursUntil} שעות)`
        }
        return `${home} נגד ${away}${score} | ${status}${r.round ? ` | ${r.round}` : ''}${timeStr}${oddsStr}${formStr}`
      })

      // user bets — fetch match details separately to avoid FK join issues
      type RawBet = { match_id: string; predicted_home: number; predicted_away: number; points: number | null; result: 'exact' | 'outcome' | 'miss' | null }
      type MatchDetail = { id: string; home_team_name: string; away_team_name: string; actual_home_score: number | null; actual_away_score: number | null; status: string; match_start_time: string | null }

      const rawBets = (userBetsRes.data ?? []) as unknown as RawBet[]
      console.log('[chat] userBets raw count:', rawBets.length, 'userId:', userId, 'tournamentId:', tournamentId)

      let matchDetailsMap: Record<string, MatchDetail> = {}
      if (rawBets.length > 0) {
        const matchIds = rawBets.map(b => b.match_id)
        const { data: matchRows, error: matchErr } = await supabaseAdmin
          .from('matches')
          .select('id, home_team_name, away_team_name, actual_home_score, actual_away_score, status, match_start_time')
          .in('id', matchIds)
        if (matchErr) console.error('[chat] match details error:', matchErr.message)
        for (const m of (matchRows ?? []) as unknown as MatchDetail[]) {
          matchDetailsMap[m.id] = m
        }
      }

      const sortedBets = [...rawBets].sort((a, b) => {
        const ta = matchDetailsMap[a.match_id]?.match_start_time ? new Date(matchDetailsMap[a.match_id].match_start_time!).getTime() : 0
        const tb = matchDetailsMap[b.match_id]?.match_start_time ? new Date(matchDetailsMap[b.match_id].match_start_time!).getTime() : 0
        return ta - tb
      })

      const RESULT_HE: Record<string, string> = { exact: 'מדויק ✓✓', outcome: 'כיוון ✓', miss: 'החטאה ✗' }
      const userBets = sortedBets.map(r => {
        const m = matchDetailsMap[r.match_id]
        const home = translateTeam(m?.home_team_name ?? '')
        const away = translateTeam(m?.away_team_name ?? '')
        const finished = m?.status === 'finished'
        const actualScore = finished && m?.actual_home_score !== null && m?.actual_home_score !== undefined
          ? `${m.actual_home_score}:${m.actual_away_score}`
          : null
        const resultLabel = r.result ? (RESULT_HE[r.result] ?? r.result) : (finished ? 'לא ניחש' : 'ממתין')
        const pts = r.points !== null && r.points !== undefined ? `${r.points} נק'` : (finished ? '0 נק\'' : '')
        const actualStr = actualScore ? ` | תוצאה בפועל: ${actualScore}` : ''
        return `${home} נגד ${away}: ניחשת ${r.predicted_home}:${r.predicted_away}${actualStr} | ${resultLabel}${pts ? ` | ${pts}` : ''}`
      })
      const totalPoints = sortedBets.reduce((sum, r) => sum + (r.points ?? 0), 0)
      const exactCount   = sortedBets.filter(r => r.result === 'exact').length
      const outcomeCount = sortedBets.filter(r => r.result === 'outcome').length
      console.log('[chat] userBets formatted:', userBets.length, 'totalPoints:', totalPoints)

      const nowISO = new Date().toLocaleString('he-IL', { timeZone: 'Asia/Jerusalem' })
      contextBlock = `
=== נתוני הטורניר ===
שם הטורניר: ${tournamentName || tournamentId}
שעה נוכחית (ישראל): ${nowISO}

טבלת דירוג:
${standings.length ? standings.join('\n') : 'אין נתונים עדיין'}

תוצאות משחקים שהסתיימו:
${finishedMatches.length ? finishedMatches.join('\n') : 'אין משחקים שהסתיימו עדיין'}

משחקים עתידיים / חיים:
${upcomingMatches.length ? upcomingMatches.join('\n') : 'אין משחקים מתוכננים'}

${userBets.length ? `ניחושים של ${currentUserName || 'המשתמש'} (${userBets.length} משחקים | ${exactCount} מדויקים | ${outcomeCount} כיוון | סה"כ ${totalPoints} נק'):\n${userBets.join('\n')}` : ''}
`
    }

    const systemPrompt = `אתה עוזר של אתר Guess & Win — אתר ניחושי כדורגל.
אתה מומחה כדורגל. ענה על שאלות על האתר (דירוגים, ניחושים, תוצאות, כללי ניקוד) וגם על שאלות כדורגל כלליות (שחקנים, קבוצות, ליגות, טורנירים עולמיים וכו').
אתה בקיא בנבחרות לקראת מונדיאל 2026: ענה על שאלות על המשחקים האחרונים של נבחרות, תארים ששיגרו, ביצועים בהכשרה, שחקני מפתח, וסיכויים — על סמך הידע שלך עד אוגוסט 2025.
אם שואלים על נושא שאינו קשור לכדורגל — סרב בנימוס.
ענה בעברית, קצר וברור.
${currentUserName ? `\nאתה מדבר עם ${currentUserName}.` : ''}${tournamentName ? `\nהטורניר הנוכחי: ${tournamentName}.` : ''}

כללי ניקוד: תוצאה מדויקת (בול) = 10 נק', כיוון נכון (ניצחון/תיקו/הפסד) = 5 נק', טעות = 0.

בסעיף "תוצאות משחקים שהסתיימו" מופיעות כל התוצאות הסופיות — השתמש בהן כמקור הסמכותי לכל שאלה על תוצאת משחק.
הפורמט: קבוצה_בית תוצאה_בית:תוצאה_חוץ קבוצה_חוץ

בסעיף "משחקים עתידיים" מופיעים:
- יחסי סיכויים סטטיסטיים (יחס נמוך = סיכוי גבוה לפי הניתוח)
- ביצועים אחרונים של כל קבוצה: נ=ניצחון, ת=תיקו, ה=הפסד

כשמישהו שואל על תחזית / ניחוש / מי ינצח — זוהי שאלה לגיטימית לחלוטין באתר ניחושי כדורגל:
1. נתח את הביצועים האחרונים של שתי הקבוצות
2. השתמש ביחסי הסיכויים כאינדיקטור נוסף
3. תן תחזית מנומקת קצרה — זה בדיוק תפקידך

כלל זמן למשחקים עתידיים:
- תן תחזית רק על משחקים שמתחילים תוך 24 שעות מעכשיו.
- אם משחק מרוחק יותר מ-24 שעות — ציין שהתחזית תינתן קרוב יותר לתאריך המשחק.
- כשמישהו שואל "היום" — הכוונה ל-24 השעות הקרובות (לא רק יום קלנדרי). כלול משחקים שמתחילים תוך 24 שעות.
- כשמישהו שואל על "המשחק הקרוב" / "המשחק הבא" / "הבא שלנו" — זהו המשחק עם הערך הנמוך ביותר של "בעוד X שעות" ברשימת המשחקים העתידיים (הראשון ברשימה, שהיא ממוינת לפי זמן עולה).
${contextBlock}`

    // סנן הודעות assistant ראשונות — LLM צריך להתחיל עם user
    const filteredMessages = messages.filter((m, i) =>
      !(i === 0 && m.role === 'assistant')
    )

    // ── שליפת תוצאות נבחרת מ-API אם יש שאלה רלוונטית ───────────────
    const lastUserMsg = [...filteredMessages].reverse().find(m => m.role === 'user')?.content ?? ''
    const lastUserText = typeof lastUserMsg === 'string' ? lastUserMsg : ''

    // Map Hebrew/common team names → English for API search (World Cup 2026 — 48 teams)
    const TEAM_MAP: Record<string, string> = {
      // אירופה (UEFA)
      'גרמניה': 'Germany', 'צרפת': 'France', 'ספרד': 'Spain', 'אנגליה': 'England',
      'פורטוגל': 'Portugal', 'הולנד': 'Netherlands', 'בלגיה': 'Belgium',
      'קרואטיה': 'Croatia', 'שוויץ': 'Switzerland', 'אוסטריה': 'Austria',
      'פולין': 'Poland', 'דנמרק': 'Denmark', 'סרביה': 'Serbia',
      'טורקיה': 'Turkey', 'הונגריה': 'Hungary', 'סקוטלנד': 'Scotland',
      'אוקראינה': 'Ukraine', 'רומניה': 'Romania', 'סלובקיה': 'Slovakia',
      'סלובניה': 'Slovenia', 'אלבניה': 'Albania', 'צ\'כיה': 'Czech Republic',
      'יוון': 'Greece', 'גיאורגיה': 'Georgia', 'אירלנד': 'Republic of Ireland',
      'נורווגיה': 'Norway', 'פינלנד': 'Finland', 'איסלנד': 'Iceland',
      // דרום אמריקה (CONMEBOL)
      'ארגנטינה': 'Argentina', 'ברזיל': 'Brazil', 'קולומביה': 'Colombia',
      'אורוגוואי': 'Uruguay', 'אקוודור': 'Ecuador', 'ונצואלה': 'Venezuela',
      'פרגוואי': 'Paraguay', 'בוליביה': 'Bolivia', 'צ\'ילה': 'Chile',
      'פרו': 'Peru',
      // צפון ומרכז אמריקה (CONCACAF)
      'ארה"ב': 'USA', 'מקסיקו': 'Mexico', 'קנדה': 'Canada',
      'פנמה': 'Panama', 'קוסטה ריקה': 'Costa Rica', 'ג\'מייקה': 'Jamaica',
      'הונדורס': 'Honduras',
      // אסיה (AFC)
      'יפן': 'Japan', 'קוריאה': 'South Korea', 'אוסטרליה': 'Australia',
      'איראן': 'Iran', 'ערב הסעודית': 'Saudi Arabia', 'עיראק': 'Iraq',
      'ירדן': 'Jordan', 'אינדונזיה': 'Indonesia',
      // אפריקה (CAF)
      'מרוקו': 'Morocco', 'סנגל': 'Senegal', 'מצרים': 'Egypt',
      'ניגריה': 'Nigeria', 'חוף השנהב': 'Ivory Coast', 'קמרון': 'Cameroon',
      'דרום אפריקה': 'South Africa', 'תוניסיה': 'Tunisia', 'אלג\'יריה': 'Algeria',
      // אוקיאניה (OFC)
      'ניו זילנד': 'New Zealand',
    }

    let teamDataBlock = ''
    for (const [he, en] of Object.entries(TEAM_MAP)) {
      if (lastUserText.includes(he) || lastUserText.toLowerCase().includes(en.toLowerCase())) {
        const matches = await fetchTeamRecentMatches(en, 5)
        if (matches.length) {
          const lines = matches.map(m => {
            const score = m.homeScore !== null ? `${m.homeScore}:${m.awayScore}` : 'טרם שוחק'
            const date = new Date(m.date).toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit', year: 'numeric' })
            return `${date} | ${m.homeTeam} ${score} ${m.awayTeam} | ${m.competition}`
          }).join('\n')
          teamDataBlock += `\n=== תוצאות אחרונות של ${he} (${en}) מה-API ===\n${lines}\n`
        }
        break
      }
    }

    const { text } = await generateText({
      model: gateway('google/gemini-2.5-flash-lite'),
      system: systemPrompt + teamDataBlock,
      messages: filteredMessages,
    })

    return NextResponse.json({ text })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[/api/chat] error:', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
