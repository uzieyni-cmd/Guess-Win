'use server'

import { supabaseAdmin } from '@/lib/supabase-admin'

const BASE_URL = 'https://v3.football.api-sports.io'

async function apiFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { 'x-apisports-key': process.env.API_FOOTBALL_KEY! },
    next: { revalidate: 3600 },
  })
  if (!res.ok) throw new Error(`API-Football ${res.status}`)
  const data = await res.json()
  return data.response as T
}

// in-memory cache — נשמר כל עוד ה-server instance חי
let allLeaguesCache: LeagueItem[] | null = null

export interface ApiSeason {
  year: number
  start: string  // "2024-09-17"
  end: string    // "2025-06-01"
  current: boolean
  coverage: { fixtures: { events: boolean } }
}

interface ApiLeagueResponse {
  league: { id: number; name: string; logo: string; type: string }
  country: { name: string; flag: string }
  seasons: ApiSeason[]
}

export interface LeagueItem {
  id: number
  name: string
  logo: string
  country: string
  flag: string
  type: 'League' | 'Cup'
}

// מחזיר את כל הליגות והגביעים
// סדר עדיפויות: in-memory → Supabase DB → API Football (fallback ראשוני בלבד)
export async function fetchAllLeagues(): Promise<LeagueItem[]> {
  // 1. in-memory cache (מהיר ביותר)
  if (allLeaguesCache) return allLeaguesCache

  // 2. קרא מה-DB
  const { data } = await supabaseAdmin
    .from('leagues_cache')
    .select('leagues')
    .eq('id', 1)
    .single()

  if (data?.leagues?.length) {
    allLeaguesCache = data.leagues as LeagueItem[]
    return allLeaguesCache
  }

  // 3. Fallback: קרא מה-API ושמור ב-DB (רק בפעם הראשונה)
  allLeaguesCache = await fetchLeaguesFromApi()
  await supabaseAdmin
    .from('leagues_cache')
    .upsert({ id: 1, leagues: allLeaguesCache, updated_at: new Date().toISOString() })

  return allLeaguesCache
}

// פונקציה פנימית — שולפת מה-API ומחזירה רשימה מסודרת
export async function fetchLeaguesFromApi(): Promise<LeagueItem[]> {
  const [leagues, cups] = await Promise.all([
    apiFetch<ApiLeagueResponse[]>('/leagues?type=league'),
    apiFetch<ApiLeagueResponse[]>('/leagues?type=cup'),
  ])
  return [...leagues, ...cups]
    .map((r) => ({
      id: r.league.id,
      name: r.league.name,
      logo: r.league.logo ?? '',
      country: r.country?.name ?? '',
      flag: r.country?.flag ?? '',
      type: r.league.type as 'League' | 'Cup',
    }))
    .sort((a, b) => a.country.localeCompare(b.country) || a.name.localeCompare(b.name))
}

// מחזיר עונות + לוגו הליגה
export async function fetchLeagueSeasons(
  leagueId: number
): Promise<{ seasons: { year: number; label: string; current: boolean }[]; logoUrl: string }> {
  const rows = await apiFetch<ApiLeagueResponse[]>(`/leagues?id=${leagueId}`)
  if (!rows?.length) return { seasons: [], logoUrl: '' }

  return {
    logoUrl: rows[0].league.logo ?? '',
    seasons: rows[0].seasons
      .sort((a, b) => b.year - a.year)
      .map((s) => ({
        year: s.year,
        label: formatSeason(s.year, s.start, s.end),
        current: s.current,
      })),
  }
}

// פורמט: "2024/2025" אם עונה מתפרסת על שתי שנים, "2026" אם שנה אחת
function formatSeason(year: number, start: string, end: string): string {
  const startYear = new Date(start).getFullYear()
  const endYear   = new Date(end).getFullYear()
  if (endYear > startYear) return `${startYear}/${endYear}`
  return `${year}`
}
