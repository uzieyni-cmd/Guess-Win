'use server'

const BASE_URL = 'https://v3.football.api-sports.io'

async function apiFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { 'x-apisports-key': process.env.API_FOOTBALL_KEY! },
    next: { revalidate: 3600 }, // cache 1hr
  })
  if (!res.ok) throw new Error(`API-Football ${res.status}`)
  const data = await res.json()
  return data.response as T
}

export interface ApiSeason {
  year: number
  start: string  // "2024-09-17"
  end: string    // "2025-06-01"
  current: boolean
  coverage: { fixtures: { events: boolean } }
}

interface ApiLeagueResponse {
  league: { id: number; name: string; logo: string }
  country: { name: string; flag: string }
  seasons: ApiSeason[]
}

export interface LeagueItem {
  id: number
  name: string
  logo: string
  country: string
  flag: string
}

// מחזיר את כל הליגות (type=league בלבד, ללא גביעים)
export async function fetchAllLeagues(): Promise<LeagueItem[]> {
  const rows = await apiFetch<ApiLeagueResponse[]>('/leagues?type=league')
  return rows
    .map((r) => ({
      id: r.league.id,
      name: r.league.name,
      logo: r.league.logo ?? '',
      country: r.country?.name ?? '',
      flag: r.country?.flag ?? '',
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
