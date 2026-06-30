import 'server-only'
import { supabaseAdmin } from './supabase-admin'
import { ENGLISH_TO_HEBREW_TEAM } from './team-names'

/**
 * מחשב ושומר ניקוד מלא למשחק לפי התוצאה הנוכחית: ניקוד בסיס, מכפיל ג'וקר,
 * בונוס ניחוש מדויק יחידני (+5, אחרי הכפלת ג'וקר), ובונוס נבחרת מדורגת.
 * אידמפוטנטית (reset-then-recompute) — נקראת גם במהלך משחק חי (בכל סנכרון)
 * וגם כשהוא מסתיים, כך שאין הבדל בין ניקוד "חי" לניקוד סופי.
 *
 * כל ה-fields (points, result, team_bonus_pick) נכתבים ב-write אחד per bet
 * כדי למנוע אירועי Realtime ביניים שגורמים לרעידת ניקוד בצד הלקוח.
 */
export async function scoreMatch(
  matchId: string,
  actualScore: { home: number; away: number }
): Promise<void> {
  const { home, away } = actualScore

  // משחק מוסתר מוחרג מהניקוד לחלוטין — אם בטעות יש עליו נקודות, אפס אותן.
  // בנוסף קוראים את דגל בונוס המנחש היחיד של הטורניר.
  const { data: matchRow } = await supabaseAdmin
    .from('matches')
    .select('hidden, tournaments(unique_bonus_enabled)')
    .eq('id', matchId)
    .single()
  const mr = matchRow as { hidden: boolean; tournaments: { unique_bonus_enabled: boolean } | { unique_bonus_enabled: boolean }[] | null } | null
  if (mr?.hidden) {
    await zeroMatchScores(matchId)
    return
  }
  const tour = Array.isArray(mr?.tournaments) ? mr?.tournaments[0] : mr?.tournaments
  const uniqueBonusEnabled = tour?.unique_bonus_enabled ?? true

  const { data: bets } = await supabaseAdmin
    .from('bets')
    .select('id, user_id, predicted_home, predicted_away, points, result, team_bonus_pick')
    .eq('match_id', matchId)

  // ── ג'וקר — נדרש גם לבונוס נבחרת מדורגת, גם אם אין bets רגילים ──
  const { data: jokerPicksRaw } = await supabaseAdmin
    .from('joker_picks')
    .select('user_id')
    .eq('match_id', matchId)
  const jokerUserIds = new Set(
    (jokerPicksRaw ?? []).map((j) => (j as { user_id: string }).user_id)
  )

  // ── חשב בונוס נבחרת מדורגת מראש (ללא כתיבה ל-DB) ──────────────
  const teamBonusMap = await computeTeamBonusMap(matchId, actualScore, jokerUserIds)

  if (!bets?.length) {
    // אין ניחושים רגילים — רק בונוס נבחרת (insert/update נפרד)
    await applyTeamBonusOnly(matchId, actualScore, teamBonusMap)
    return
  }

  type BetRow = { id: string; user_id: string; predicted_home: number; predicted_away: number; points: number | null; result: string | null; team_bonus_pick: number | null }
  type ScoredBet = { id: string; userId: string; result: 'exact' | 'outcome' | 'miss'; points: number }

  // ערכים נוכחיים ב-DB — כדי לדלג על כתיבות מיותרות (חוסך אירועי Realtime)
  const currentById = new Map(
    (bets as BetRow[]).map(b => [b.id, { points: b.points, result: b.result, team_bonus_pick: b.team_bonus_pick ?? 0 }])
  )

  // ── Step A: ניקוד בסיס ────────────────────────────────────────
  const scored: ScoredBet[] = (bets as BetRow[]).map(bet => {
    if (bet.predicted_home === home && bet.predicted_away === away) {
      return { id: bet.id, userId: bet.user_id, result: 'exact', points: 4 }
    }
    const predOut = bet.predicted_home > bet.predicted_away ? 'home' : bet.predicted_home < bet.predicted_away ? 'away' : 'draw'
    const actOut  = home > away ? 'home' : home < away ? 'away' : 'draw'
    if (predOut === actOut) return { id: bet.id, userId: bet.user_id, result: 'outcome', points: 1 }
    return { id: bet.id, userId: bet.user_id, result: 'miss', points: 0 }
  })

  // ── Step B: מכפיל ג'וקר (×2 למשתמשים שסימנו ג'וקר על משחק זה) ──
  for (const b of scored) {
    if (jokerUserIds.has(b.userId) && b.points > 0) b.points *= 2
  }

  // ── Step C: בונוס ניחוש מדויק יחידני (+5, לא מוכפל בג'וקר) ──────
  // מושבת אם הטורניר הגדיר unique_bonus_enabled = false
  const exactOnes = scored.filter(b => b.result === 'exact')
  if (uniqueBonusEnabled && exactOnes.length === 1) exactOnes[0].points += 5

  // ── Step D: כתוב ניקוד סופי + team_bonus_pick ב-write אחד ──────
  // מיזוג team_bonus_pick לאותו update מונע שני אירועי Realtime
  // (reset ואז award) שגרמו לרעידת ניקוד בצד הלקוח.
  const betUserIds = new Set(scored.map(b => b.userId))
  for (const b of scored) {
    const desiredTeamBonus = teamBonusMap.get(b.userId) ?? 0
    const cur = currentById.get(b.id)
    // דלג אם הניקוד זהה למה שכבר שמור — מונע UPDATE מיותר ואירוע Realtime
    if (cur && cur.points === b.points && cur.result === b.result && cur.team_bonus_pick === desiredTeamBonus) {
      continue
    }
    await supabaseAdmin
      .from('bets')
      .update({ points: b.points, result: b.result, team_bonus_pick: desiredTeamBonus })
      .eq('id', b.id)
  }

  // ── Step E: בונוס נבחרת למשתמשים ללא ניחוש רגיל ──────────────
  // (למשל מי שבחר נבחרת מדורגת אך לא הגיש ניחוש למשחק זה)
  for (const [userId, bonus] of teamBonusMap) {
    if (betUserIds.has(userId)) continue // כבר טופל ב-Step D
    // insert or update bet with team_bonus_pick only
    const { data: existing } = await supabaseAdmin
      .from('bets')
      .select('id, team_bonus_pick')
      .eq('match_id', matchId)
      .eq('user_id', userId)
      .limit(1)
    const existingRow = (existing as { id: string; team_bonus_pick: number | null }[] | null)?.[0]
    if (existingRow) {
      if ((existingRow.team_bonus_pick ?? 0) !== bonus) {
        await supabaseAdmin.from('bets').update({ team_bonus_pick: bonus }).eq('id', existingRow.id)
      }
    } else {
      const { data: match } = await supabaseAdmin
        .from('matches')
        .select('tournament_id')
        .eq('id', matchId)
        .single()
      if (match) {
        await supabaseAdmin.from('bets').insert({
          user_id: userId,
          match_id: matchId,
          tournament_id: (match as { tournament_id: string }).tournament_id,
          predicted_home: 0,
          predicted_away: 0,
          team_bonus_pick: bonus,
        })
      }
    }
  }
}

/**
 * מחשב את סכום בונוס הנבחרת המדורגת לכל משתמש — ללא כתיבה ל-DB.
 * מחזיר Map<userId, bonusAmount> רק עבור מי שזכאי לבונוס חיובי.
 * תיקו → Map ריקה.
 */
async function computeTeamBonusMap(
  matchId: string,
  actualScore: { home: number; away: number },
  jokerUserIds: Set<string>
): Promise<Map<string, number>> {
  const result = new Map<string, number>()

  if (actualScore.home === actualScore.away) return result // תיקו — אין מנצח

  const { data: match } = await supabaseAdmin
    .from('matches')
    .select('tournament_id, home_team_name, away_team_name')
    .eq('id', matchId)
    .single()
  if (!match) return result

  const m = match as { tournament_id: string; home_team_name: string; away_team_name: string }
  const winnerEn = actualScore.home > actualScore.away ? m.home_team_name : m.away_team_name
  const winnerHe = ENGLISH_TO_HEBREW_TEAM[winnerEn]
  if (!winnerHe) return result

  const { data: questions } = await supabaseAdmin
    .from('bonus_questions')
    .select('id')
    .eq('tournament_id', m.tournament_id)
    .eq('type', 'team_pick')
  if (!questions?.length) return result

  const { data: picks } = await supabaseAdmin
    .from('bonus_picks')
    .select('user_id')
    .in('bonus_question_id', (questions as { id: string }[]).map(q => q.id))
    .eq('pick', winnerHe)
  if (!picks?.length) return result

  for (const p of picks as { user_id: string }[]) {
    result.set(p.user_id, jokerUserIds.has(p.user_id) ? 4 : 2)
  }
  return result
}

/**
 * מחיל בונוס נבחרת מדורגת למשתמשים שאין להם ניחוש רגיל על המשחק.
 * נקרא רק כשאין bets כלל (מקרה קצה נדיר).
 */
async function applyTeamBonusOnly(
  matchId: string,
  actualScore: { home: number; away: number },
  teamBonusMap: Map<string, number>
): Promise<void> {
  if (!teamBonusMap.size) {
    // תיקו או אין זוכים — אפס את כל הבונוסים הקיימים
    await supabaseAdmin.from('bets').update({ team_bonus_pick: 0 }).eq('match_id', matchId)
    return
  }

  const { data: match } = await supabaseAdmin
    .from('matches')
    .select('tournament_id')
    .eq('id', matchId)
    .single()
  if (!match) return
  const tournamentId = (match as { tournament_id: string }).tournament_id

  // אפס קודם — פעולה אחת, ואחריה award
  await supabaseAdmin.from('bets').update({ team_bonus_pick: 0 }).eq('match_id', matchId)

  for (const [userId, bonus] of teamBonusMap) {
    const { data: existing } = await supabaseAdmin
      .from('bets')
      .select('id')
      .eq('match_id', matchId)
      .eq('user_id', userId)
      .limit(1)
    const existingId = (existing as { id: string }[] | null)?.[0]?.id
    if (existingId) {
      await supabaseAdmin.from('bets').update({ team_bonus_pick: bonus }).eq('id', existingId)
    } else {
      await supabaseAdmin.from('bets').insert({
        user_id: userId,
        match_id: matchId,
        tournament_id: tournamentId,
        predicted_home: 0,
        predicted_away: 0,
        team_bonus_pick: bonus,
      })
    }
  }
}

/**
 * מאפס ניקוד לכל ה-bets של משחק (points=null, result=null, team_bonus_pick=0)
 * כך שהמשחק לא נספר בדירוג ולא מוצג. כותב רק שורות שהשתנו (חוסך אירועי Realtime).
 * משמש למשחקים מוסתרים — מוחרגים מהניקוד לחלוטין.
 */
export async function zeroMatchScores(matchId: string): Promise<void> {
  const { data: bets } = await supabaseAdmin
    .from('bets')
    .select('id, points, result, team_bonus_pick')
    .eq('match_id', matchId)

  for (const b of (bets ?? []) as { id: string; points: number | null; result: string | null; team_bonus_pick: number | null }[]) {
    if (b.points === null && b.result === null && (b.team_bonus_pick ?? 0) === 0) continue // כבר מאופס
    await supabaseAdmin
      .from('bets')
      .update({ points: null, result: null, team_bonus_pick: 0 })
      .eq('id', b.id)
  }
}
