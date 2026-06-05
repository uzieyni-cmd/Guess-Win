'use server'

/**
 * AI Monkey Player — "קוף 🐒"
 * מתחרה AI שמנחש משחקים ובונוסים אוטומטית לפני נעילה.
 */

import { supabaseAdmin } from '@/lib/supabase-admin'
import { createOpenAI } from '@ai-sdk/openai'
import { generateText } from 'ai'
import { fetchTeamRecentMatches } from '@/lib/api-football'
import { translateTeam } from '@/lib/teams-he'

const MONKEY_EMAIL = 'ai-monkey@guessandwin.internal'
const MONKEY_NAME  = 'קוף 🐒'
const MONKEY_AVATAR = '/monkey.png'

const gateway = createOpenAI({
  baseURL: 'https://ai-gateway.vercel.sh/v1',
  apiKey: process.env.AI_GATEWAY_API_KEY ?? '',
})

// ── שלוף / צור את מזהה הקוף ──────────────────────────────────────

async function getMonkeyUserId(): Promise<string | null> {
  const { data } = await supabaseAdmin
    .from('profiles')
    .select('id')
    .eq('email', MONKEY_EMAIL)
    .single()
  return data?.id ?? null
}

// ── הגדרת הקוף (פעם ראשונה בלבד) ───────────────────────────────

export async function setupMonkey(): Promise<{ ok: boolean; userId?: string; error?: string }> {
  try {
    // בדוק אם כבר קיים
    const existing = await getMonkeyUserId()
    if (existing) return { ok: true, userId: existing }

    // צור user ב-Supabase Auth
    const { data: authData, error: authErr } = await supabaseAdmin.auth.admin.createUser({
      email: MONKEY_EMAIL,
      password: crypto.randomUUID(), // סיסמה רנדומית — לא אמורים להתחבר ידנית
      email_confirm: true,
    })
    if (authErr || !authData.user) return { ok: false, error: authErr?.message }

    const userId = authData.user.id

    // עדכן/צור פרופיל
    await supabaseAdmin.from('profiles').upsert({
      id: userId,
      email: MONKEY_EMAIL,
      display_name: MONKEY_NAME,
      avatar_url: MONKEY_AVATAR,
      role: 'user',
    }, { onConflict: 'id' })

    return { ok: true, userId }
  } catch (e) {
    return { ok: false, error: String(e) }
  }
}

// ── רשום את הקוף לטורניר ─────────────────────────────────────────

export async function joinMonkeyToTournament(tournamentId: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const userId = await getMonkeyUserId()
    if (!userId) return { ok: false, error: 'Monkey user not found — run setupMonkey() first' }

    await supabaseAdmin
      .from('tournament_participants')
      .upsert({ tournament_id: tournamentId, user_id: userId, paid: true }, { onConflict: 'tournament_id,user_id' })

    return { ok: true }
  } catch (e) {
    return { ok: false, error: String(e) }
  }
}

// ── ניחוש AI לתוצאת משחק ─────────────────────────────────────────

async function predictScore(
  homeTeam: string,
  awayTeam: string,
  oddsHome?: number | null,
  oddsDraw?: number | null,
  oddsAway?: number | null,
): Promise<{ home: number; away: number } | null> {
  try {
    // שלוף תוצאות אחרונות מה-API לשתי הקבוצות במקביל
    const [homeForm, awayForm] = await Promise.all([
      fetchTeamRecentMatches(homeTeam, 5).catch(() => []),
      fetchTeamRecentMatches(awayTeam, 5).catch(() => []),
    ])

    const formStr = (matches: Awaited<ReturnType<typeof fetchTeamRecentMatches>>, team: string) =>
      matches.length
        ? matches.map(m => {
            const isHome = m.homeTeam === team
            const gf = isHome ? m.homeScore : m.awayScore
            const ga = isHome ? m.awayScore : m.homeScore
            return `${m.homeTeam} ${m.homeScore ?? '?'}:${m.awayScore ?? '?'} ${m.awayTeam}`
          }).join(', ')
        : 'אין נתונים'

    const oddsStr = oddsHome && oddsDraw && oddsAway
      ? `יחסי הימורים: ${homeTeam} ${oddsHome} / תיקו ${oddsDraw} / ${awayTeam} ${oddsAway}`
      : ''

    const prompt = `אתה מנתח כדורגל. נחש את תוצאת המשחק הבא.
ענה אך ורק במספרים בפורמט: "X:Y" (ללא טקסט נוסף).

משחק: ${translateTeam(homeTeam)} נגד ${translateTeam(awayTeam)}
${oddsStr}
ביצועים אחרונים של ${homeTeam}: ${formStr(homeForm, homeTeam)}
ביצועים אחרונים של ${awayTeam}: ${formStr(awayForm, awayTeam)}

תן תחזית תוצאה בפורמט X:Y בלבד:`

    const { text } = await generateText({
      model: gateway('google/gemini-2.5-flash'),
      prompt,
      maxOutputTokens: 10,
    })

    const match = text.trim().match(/^(\d+):(\d+)$/)
    if (!match) return null

    const home = Math.min(parseInt(match[1]), 15)
    const away = Math.min(parseInt(match[2]), 15)
    return { home, away }
  } catch {
    return null
  }
}

// ── ניחוש AI לשאלת בונוס ─────────────────────────────────────────

async function predictBonus(question: string, options: string[]): Promise<string | null> {
  try {
    const { text } = await generateText({
      model: gateway('google/gemini-2.5-flash'),
      prompt: `אתה מומחה כדורגל. בחר את האפשרות הסבירה ביותר.
ענה אך ורק עם הטקסט המדויק של האפשרות שבחרת — ללא תוספות.

שאלה: ${question}
אפשרויות: ${options.join(' | ')}

תשובה:`,
      maxOutputTokens: 50,
    })

    const picked = text.trim()
    // ודא שהתשובה היא אחת מהאפשרויות (התאמה מקסימלית)
    const exact = options.find(o => o === picked)
    if (exact) return exact
    const partial = options.find(o => picked.includes(o) || o.includes(picked))
    return partial ?? options[0] // fallback לאפשרות ראשונה
  } catch {
    return options[0] ?? null
  }
}

// ── מלא ניחושים לכל המשחקים החסרים בטורניר ──────────────────────

export async function runMonkeyBets(tournamentId: string): Promise<{
  ok: boolean
  placed: number
  skipped: number
  error?: string
}> {
  try {
    const userId = await getMonkeyUserId()
    if (!userId) return { ok: false, placed: 0, skipped: 0, error: 'Monkey not set up' }

    // וודא שהקוף רשום לטורניר
    await joinMonkeyToTournament(tournamentId)

    const now = new Date()
    const cutoff = new Date(now.getTime() + 24 * 60 * 60 * 1000) // לפחות 24 שעות מעכשיו

    // שלוף משחקים עתידיים שעדיין לא ננעלו
    const { data: matches } = await supabaseAdmin
      .from('matches')
      .select('id, home_team_name, away_team_name, match_start_time, odds_home, odds_draw, odds_away')
      .eq('tournament_id', tournamentId)
      .eq('status', 'scheduled')
      .gt('match_start_time', cutoff.toISOString())
      .order('match_start_time', { ascending: true })

    if (!matches?.length) return { ok: true, placed: 0, skipped: 0 }

    // שלוף ניחושים קיימים של הקוף
    const { data: existing } = await supabaseAdmin
      .from('bets')
      .select('match_id')
      .eq('tournament_id', tournamentId)
      .eq('user_id', userId)

    const alreadyBet = new Set((existing ?? []).map((b: { match_id: string }) => b.match_id))

    let placed = 0
    let skipped = 0

    for (const match of matches as {
      id: string
      home_team_name: string
      away_team_name: string
      match_start_time: string
      odds_home: number | null
      odds_draw: number | null
      odds_away: number | null
    }[]) {
      if (alreadyBet.has(match.id)) { skipped++; continue }

      const prediction = await predictScore(
        match.home_team_name,
        match.away_team_name,
        match.odds_home,
        match.odds_draw,
        match.odds_away,
      )

      if (!prediction) { skipped++; continue }

      const { error } = await supabaseAdmin
        .from('bets')
        .upsert({
          user_id: userId,
          match_id: match.id,
          tournament_id: tournamentId,
          predicted_home: prediction.home,
          predicted_away: prediction.away,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id,match_id' })

      if (error) { skipped++; continue }
      placed++
    }

    return { ok: true, placed, skipped }
  } catch (e) {
    return { ok: false, placed: 0, skipped: 0, error: String(e) }
  }
}

// ── מלא ניחושי בונוס חסרים ───────────────────────────────────────

export async function runMonkeyBonusPicks(tournamentId: string): Promise<{
  ok: boolean
  placed: number
  skipped: number
  error?: string
}> {
  try {
    const userId = await getMonkeyUserId()
    if (!userId) return { ok: false, placed: 0, skipped: 0, error: 'Monkey not set up' }

    const now = new Date()

    // שאלות בונוס פתוחות (לא ננעלו עדיין ואין תוצאה)
    const { data: questions } = await supabaseAdmin
      .from('bonus_questions')
      .select('id, question, options, lock_time, correct_options')
      .eq('tournament_id', tournamentId)
      .is('correct_options', null)
      .gt('lock_time', now.toISOString())

    if (!questions?.length) return { ok: true, placed: 0, skipped: 0 }

    // שאלות שהקוף כבר ענה עליהן
    const { data: existingPicks } = await supabaseAdmin
      .from('bonus_picks')
      .select('bonus_question_id')
      .eq('tournament_id', tournamentId)
      .eq('user_id', userId)

    const alreadyPicked = new Set(
      (existingPicks ?? []).map((p: { bonus_question_id: string }) => p.bonus_question_id)
    )

    let placed = 0
    let skipped = 0

    for (const q of questions as { id: string; question: string; options: string[]; lock_time: string; correct_options: string[] | null }[]) {
      if (alreadyPicked.has(q.id)) { skipped++; continue }

      const pick = await predictBonus(q.question, q.options)
      if (!pick) { skipped++; continue }

      const { error } = await supabaseAdmin
        .from('bonus_picks')
        .upsert({
          bonus_question_id: q.id,
          tournament_id: tournamentId,
          user_id: userId,
          pick,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'bonus_question_id,user_id' })

      if (error) { skipped++; continue }
      placed++
    }

    return { ok: true, placed, skipped }
  } catch (e) {
    return { ok: false, placed: 0, skipped: 0, error: String(e) }
  }
}

// ── הרץ הכל לכל הטורנירים האקטיביים ─────────────────────────────

export async function runMonkeyForAllTournaments(): Promise<{
  ok: boolean
  results: { tournamentId: string; bets: number; bonuses: number }[]
}> {
  const { data: tournaments } = await supabaseAdmin
    .from('tournaments')
    .select('id')
    .eq('status', 'active')

  const results = []
  for (const t of (tournaments ?? []) as { id: string }[]) {
    const [bets, bonuses] = await Promise.all([
      runMonkeyBets(t.id),
      runMonkeyBonusPicks(t.id),
    ])
    results.push({ tournamentId: t.id, bets: bets.placed, bonuses: bonuses.placed })
  }

  return { ok: true, results }
}
