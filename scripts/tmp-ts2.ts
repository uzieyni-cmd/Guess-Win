import { config } from 'dotenv'
config({ path: '.env.local' })
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

async function main() {
  const apiKey = process.env.API_FOOTBALL_KEY
  const res = await fetch(
    `https://v3.football.api-sports.io/players/topscorers?league=1&season=2026`,
    { headers: { 'x-apisports-key': apiKey! }, cache: 'no-store' }
  )
  const json = await res.json()
  console.log('paging:', json.paging)
  console.log('results:', json.results)
  const all = (json.response ?? []).map((p: any) => ({
    name: p.player.name,
    team: p.statistics[0]?.team.name,
    goals: p.statistics[0]?.goals.total,
    assists: p.statistics[0]?.goals.assists,
    apps: p.statistics[0]?.games.appearences,
  }))
  console.log('\nfull list as returned by API (order):')
  console.log(all)

  console.log('\nsorted by goals desc:')
  console.log([...all].sort((a,b) => (b.goals ?? 0) - (a.goals ?? 0)).slice(0, 5))
}
main()
