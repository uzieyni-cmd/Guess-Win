'use server'

import { supabaseAdmin } from '@/lib/supabase-admin'
import { requireAdmin } from '@/lib/auth-server'
import { fetchLeaguesFromApi, fetchLeagueSeasonsFromApi } from '@/lib/leagues-api'

export type { LeagueItem } from '@/lib/leagues-api'

// in-memory cache — נשמר כל עוד ה-server instance חי
let allLeaguesCache: Awaited<ReturnType<typeof fetchLeaguesFromApi>> | null = null

// מחזיר את כל הליגות והגביעים
// סדר עדיפויות: in-memory → Supabase DB → API Football (fallback ראשוני בלבד)
export async function fetchAllLeagues() {
  await requireAdmin()
  // 1. in-memory cache (מהיר ביותר)
  if (allLeaguesCache) return allLeaguesCache

  // 2. קרא מה-DB
  const { data } = await supabaseAdmin
    .from('leagues_cache')
    .select('leagues')
    .eq('id', 1)
    .single()

  if (data?.leagues?.length) {
    allLeaguesCache = data.leagues
    return allLeaguesCache!
  }

  // 3. Fallback: קרא מה-API ושמור ב-DB (רק בפעם הראשונה)
  allLeaguesCache = await fetchLeaguesFromApi()
  await supabaseAdmin
    .from('leagues_cache')
    .upsert({ id: 1, leagues: allLeaguesCache, updated_at: new Date().toISOString() })

  return allLeaguesCache!
}

// מחזיר עונות + לוגו הליגה
export async function fetchLeagueSeasons(leagueId: number) {
  await requireAdmin()
  return fetchLeagueSeasonsFromApi(leagueId)
}
