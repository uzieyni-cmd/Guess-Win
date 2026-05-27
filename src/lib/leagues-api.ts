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

interface ApiLeagueResponse {
  league: { id: number; name: string; logo: string; type: string }
  country: { name: string; flag: string }
  seasons: { year: number; start: string; end: string; current: boolean }[]
}

export interface LeagueItem {
  id: number
  name: string
  logo: string
  country: string
  flag: string
  type: 'League' | 'Cup'
}

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

export async function fetchLeagueSeasonsFromApi(
  leagueId: number
): Promise<{ seasons: { year: number; label: string; current: boolean }[]; logoUrl: string }> {
  const rows = await apiFetch<ApiLeagueResponse[]>(`/leagues?id=${leagueId}`)
  if (!rows?.length) return { seasons: [], logoUrl: '' }

  return {
    logoUrl: rows[0].league.logo ?? '',
    seasons: rows[0].seasons
      .sort((a, b) => b.year - a.year)
      .map((s) => {
        const startYear = new Date(s.start).getFullYear()
        const endYear   = new Date(s.end).getFullYear()
        const label = endYear > startYear ? `${startYear}/${endYear}` : `${s.year}`
        return { year: s.year, label, current: s.current }
      }),
  }
}
