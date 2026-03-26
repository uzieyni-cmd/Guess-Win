'use server'

const BASE_URL = 'https://v3.football.api-sports.io'

async function apiFetch<T>(path: string, revalidate = 3600): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { 'x-apisports-key': process.env.API_FOOTBALL_KEY! },
    next: { revalidate },
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

// מחזיר את כל הליגות והגביעים (Nations League מסווג כ-Cup ב-API)
// cache 24h ב-Next.js + in-memory cache בין קריאות באותו server instance
export async function fetchAllLeagues(): Promise<LeagueItem[]> {
  if (allLeaguesCache) return allLeaguesCache

  const [leagues, cups] = await Promise.all([
    apiFetch<ApiLeagueResponse[]>('/leagues?type=league', 86400),
    apiFetch<ApiLeagueResponse[]>('/leagues?type=cup', 86400),
  ])

  allLeaguesCache = [...leagues, ...cups]
    .map((r) => ({
      id: r.league.id,
      name: r.league.name,
      logo: r.league.logo ?? '',
      country: r.country?.name ?? '',
      flag: r.country?.flag ?? '',
      type: r.league.type as 'League' | 'Cup',
    }))
    .sort((a, b) => a.country.localeCompare(b.country) || a.name.localeCompare(b.name))

  return allLeaguesCache
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
