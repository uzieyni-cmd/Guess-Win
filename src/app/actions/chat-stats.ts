'use server'
import { supabaseAdmin } from '@/lib/supabase-admin'

export interface ChatDayStat {
  date: string        // 'YYYY-MM-DD'
  count: number
  tokens_input: number
  tokens_output: number
}

export interface ChatUserStat {
  user_id:       string
  display_name:  string
  count:         number
  tokens_input:  number
  tokens_output: number
  last_used:     string
}

export interface ChatTournamentStat {
  tournament_id:   string
  tournament_name: string
  count:           number
}

export interface ChatStatsResult {
  totalMessages:   number
  totalTokensIn:   number
  totalTokensOut:  number
  estimatedCostUSD: number
  byDay:           ChatDayStat[]
  byUser:          ChatUserStat[]
  byTournament:    ChatTournamentStat[]
}

// Perplexity sonar-pro pricing (per 1M tokens)
const PRICE_INPUT_PER_M  = 3.0   // USD
const PRICE_OUTPUT_PER_M = 15.0  // USD

export async function getChatStats(days = 30): Promise<ChatStatsResult> {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()

  const { data: rows, error } = await supabaseAdmin
    .from('chat_logs')
    .select('id, user_id, tournament_id, tokens_input, tokens_output, created_at')
    .gte('created_at', since)
    .order('created_at', { ascending: false })

  if (error) throw new Error(error.message)
  const logs = (rows ?? []) as {
    id: string
    user_id: string | null
    tournament_id: string | null
    tokens_input: number | null
    tokens_output: number | null
    created_at: string
  }[]

  // ── Aggregate totals ──────────────────────────────────────────────
  const totalMessages  = logs.length
  const totalTokensIn  = logs.reduce((s, r) => s + (r.tokens_input  ?? 0), 0)
  const totalTokensOut = logs.reduce((s, r) => s + (r.tokens_output ?? 0), 0)
  const estimatedCostUSD =
    (totalTokensIn  / 1_000_000) * PRICE_INPUT_PER_M +
    (totalTokensOut / 1_000_000) * PRICE_OUTPUT_PER_M

  // ── By day ────────────────────────────────────────────────────────
  const dayMap: Record<string, ChatDayStat> = {}
  for (const r of logs) {
    const date = r.created_at.slice(0, 10)
    if (!dayMap[date]) dayMap[date] = { date, count: 0, tokens_input: 0, tokens_output: 0 }
    dayMap[date].count++
    dayMap[date].tokens_input  += r.tokens_input  ?? 0
    dayMap[date].tokens_output += r.tokens_output ?? 0
  }
  const byDay = Object.values(dayMap).sort((a, b) => b.date.localeCompare(a.date))

  // ── Fetch profile names for user breakdown ────────────────────────
  const userIds = [...new Set(logs.map(r => r.user_id).filter(Boolean))] as string[]
  const profilesRes = userIds.length
    ? await supabaseAdmin.from('profiles').select('id, display_name').in('id', userIds)
    : { data: [] }
  const nameById: Record<string, string> = {}
  for (const p of (profilesRes.data ?? []) as { id: string; display_name: string }[]) {
    nameById[p.id] = p.display_name
  }

  // ── By user ───────────────────────────────────────────────────────
  const userMap: Record<string, ChatUserStat> = {}
  for (const r of logs) {
    const uid = r.user_id ?? 'anonymous'
    if (!userMap[uid]) userMap[uid] = {
      user_id:      uid,
      display_name: nameById[uid] ?? (uid === 'anonymous' ? 'אנונימי' : uid),
      count:        0,
      tokens_input:  0,
      tokens_output: 0,
      last_used:    r.created_at,
    }
    userMap[uid].count++
    userMap[uid].tokens_input  += r.tokens_input  ?? 0
    userMap[uid].tokens_output += r.tokens_output ?? 0
    if (r.created_at > userMap[uid].last_used) userMap[uid].last_used = r.created_at
  }
  const byUser = Object.values(userMap).sort((a, b) => b.count - a.count)

  // ── Fetch tournament names ────────────────────────────────────────
  const tIds = [...new Set(logs.map(r => r.tournament_id).filter(Boolean))] as string[]
  const tournamentsRes = tIds.length
    ? await supabaseAdmin.from('tournaments').select('id, name').in('id', tIds)
    : { data: [] }
  const tNameById: Record<string, string> = {}
  for (const t of (tournamentsRes.data ?? []) as { id: string; name: string }[]) {
    tNameById[t.id] = t.name
  }

  // ── By tournament ─────────────────────────────────────────────────
  const tMap: Record<string, ChatTournamentStat> = {}
  for (const r of logs) {
    const tid = r.tournament_id ?? 'none'
    if (!tMap[tid]) tMap[tid] = {
      tournament_id:   tid,
      tournament_name: tNameById[tid] ?? 'לא ידוע',
      count:           0,
    }
    tMap[tid].count++
  }
  const byTournament = Object.values(tMap).sort((a, b) => b.count - a.count)

  return { totalMessages, totalTokensIn, totalTokensOut, estimatedCostUSD, byDay, byUser, byTournament }
}
