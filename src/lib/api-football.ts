// Server-side only – API key must never reach the client.

const BASE_URL = 'https://v3.football.api-sports.io'

async function apiFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { 'x-apisports-key': process.env.API_FOOTBALL_KEY! },
    next: { revalidate: 60 }, // cache 60s
  })
  if (!res.ok) throw new Error(`API-Football error: ${res.status} ${path}`)
  const data = await res.json()
  return data.response as T
}

// ── Types ────────────────────────────────────────────────────────

export interface ApiFixture {
  fixture: {
    id: number
    date: string
    status: { long: string; short: string; elapsed: number | null }
  }
  league: {
    id: number
    name: string
    logo: string
    round: string
  }
  teams: {
    home: { id: number; name: string; logo: string }
    away: { id: number; name: string; logo: string }
  }
  goals: { home: number | null; away: number | null }
  score: {
    fulltime: { home: number | null; away: number | null }
  }
}

export interface ApiLeague {
  league: { id: number; name: string; logo: string; type: string }
  country: { name: string; code: string; flag: string }
  seasons: { year: number; current: boolean }[]
}

// ── Fetch Helpers ────────────────────────────────────────────────

export async function fetchFixtures(leagueId: number, season: number): Promise<ApiFixture[]> {
  return apiFetch<ApiFixture[]>(`/fixtures?league=${leagueId}&season=${season}`)
}

export async function fetchFixtureById(fixtureId: number): Promise<ApiFixture | null> {
  const results = await apiFetch<ApiFixture[]>(`/fixtures?id=${fixtureId}`)
  return results[0] ?? null
}

export async function fetchLeagues(): Promise<ApiLeague[]> {
  return apiFetch<ApiLeague[]>('/leagues?type=cup&type=league')
}

// ── Status Mapper ────────────────────────────────────────────────

export function mapFixtureStatus(short: string): string {
  if (['FT', 'AET', 'PEN', 'AWD', 'WO'].includes(short)) return 'finished'
  if (['1H', '2H', 'ET', 'P', 'LIVE', 'HT', 'BT'].includes(short)) return 'live'
  if (['NS', 'TBD'].includes(short)) return 'scheduled'
  return 'scheduled'
}
