// Server-side only – API key must never reach the client.

const BASE_URL = 'https://v3.football.api-sports.io'

interface ApiResponse<T> {
  results: number
  paging: { current: number; total: number }
  response: T[]
}

async function apiFetchRaw<T>(path: string, noCache = false): Promise<ApiResponse<T>> {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { 'x-apisports-key': process.env.API_FOOTBALL_KEY! },
    ...(noCache ? { cache: 'no-store' } : { next: { revalidate: 60 } }),
  })
  if (!res.ok) throw new Error(`API-Football error: ${res.status} ${path}`)
  return res.json() as Promise<ApiResponse<T>>
}

async function apiFetch<T>(path: string): Promise<T[]> {
  const data = await apiFetchRaw<T>(path)
  return data.response
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
    penalty: { home: number | null; away: number | null }
  }
}

export interface ApiLeague {
  league: { id: number; name: string; logo: string; type: string }
  country: { name: string; code: string; flag: string }
  seasons: { year: number; current: boolean }[]
}

// ── Fetch Helpers ────────────────────────────────────────────────

export async function fetchFixtures(
  leagueId: number,
  season: number,
  fromDate?: string, // YYYY-MM-DD — לסינון API, מייעל את הCRON היומי
  noCache = false,
): Promise<ApiFixture[]> {
  const dateParam = fromDate ? `&from=${fromDate}` : ''
  const data = await apiFetchRaw<ApiFixture>(
    `/fixtures?league=${leagueId}&season=${season}${dateParam}`,
    noCache,
  )
  return data.response
}

export async function fetchFixtureById(fixtureId: number): Promise<ApiFixture | null> {
  const results = await apiFetch<ApiFixture>(`/fixtures?id=${fixtureId}`)
  return results[0] ?? null
}

export interface ApiStandingEntry {
  rank: number
  team: { id: number; name: string; logo: string }
  points: number
  goalsDiff: number
  group?: string
  form?: string
  all: { played: number; win: number; draw: number; lose: number; goals: { for: number; against: number } }
}

export async function fetchStandings(
  leagueId: number,
  season: number,
): Promise<ApiStandingEntry[][]> {
  const data = await apiFetchRaw<{
    league: { standings: ApiStandingEntry[][] }
  }>(`/standings?league=${leagueId}&season=${season}`)
  return data.response[0]?.league.standings ?? []
}

export async function fetchLeagues(): Promise<ApiLeague[]> {
  return apiFetch<ApiLeague>('/leagues?type=cup&type=league')
}

// Bet365 bookmaker ID = 8 | Match Winner bet ID = 1
const BET365_ID = 8

export interface ApiOddsResult {
  home: number
  draw: number
  away: number
}

export async function fetchOdds(fixtureId: number): Promise<ApiOddsResult | null> {
  try {
    const data = await apiFetchRaw<{
      bookmakers: {
        id: number
        bets: { id: number; values: { value: string; odd: string }[] }[]
      }[]
    }>(`/odds?fixture=${fixtureId}&bet=1&bookmaker=${BET365_ID}`, true)

    // נסה Bet365 קודם, fallback לכל בוקמייקר אחר
    let bets = data.response[0]?.bookmakers
      .find(b => b.id === BET365_ID)
      ?.bets.find(b => b.id === 1)
      ?.values

    if (!bets) {
      bets = data.response[0]?.bookmakers[0]
        ?.bets.find(b => b.id === 1)
        ?.values
    }

    if (!bets) return null

    const home = parseFloat(bets.find(v => v.value === 'Home')?.odd ?? '0')
    const draw = parseFloat(bets.find(v => v.value === 'Draw')?.odd ?? '0')
    const away = parseFloat(bets.find(v => v.value === 'Away')?.odd ?? '0')

    if (!home || !draw || !away) return null
    return { home, draw, away }
  } catch {
    return null
  }
}

// ── Status Mapper ────────────────────────────────────────────────

export function mapFixtureStatus(short: string): string {
  if (['FT', 'AET', 'PEN', 'AWD', 'WO'].includes(short)) return 'finished'
  if (['1H', '2H', 'ET', 'P', 'LIVE', 'HT', 'BT'].includes(short)) return 'live'
  if (['NS', 'TBD'].includes(short)) return 'scheduled'
  return 'scheduled'
}
