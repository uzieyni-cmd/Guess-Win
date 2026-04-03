'use client'
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import Image from 'next/image'
import { cn } from '@/lib/utils'
import { ApiStandingEntry, ApiFixture } from '@/lib/api-football'
import { translateTeam } from '@/lib/teams-he'

function FormBadge({ char }: { char: string }) {
  const cls =
    char === 'W' ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' :
    char === 'D' ? 'bg-slate-500/20 text-slate-400 border-slate-500/30' :
                   'bg-red-500/20 text-red-400 border-red-500/30'
  return (
    <span className={cn('inline-flex items-center justify-center h-4 w-4 rounded-sm text-[10px] font-bold border', cls)}>
      {char === 'W' ? 'נ' : char === 'D' ? 'ת' : 'ה'}
    </span>
  )
}

function StandingsTable({ group, rows }: { group: string | null; rows: ApiStandingEntry[] }) {
  return (
    <div className="bg-[#0d1420] rounded-2xl border border-slate-700/40 overflow-hidden">
      {group && (
        <div className="px-4 py-2.5 border-b border-slate-700/40 bg-slate-800/40">
          <h3 className="text-xs font-bold text-emerald-400 tracking-wide uppercase">{group}</h3>
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-slate-800/60 text-slate-500">
              <th className="text-right px-3 py-2 font-medium w-6">#</th>
              <th className="text-right px-3 py-2 font-medium">קבוצה</th>
              <th className="px-2 py-2 font-medium text-center">מ׳</th>
              <th className="px-2 py-2 font-medium text-center">נ׳</th>
              <th className="px-2 py-2 font-medium text-center">ת׳</th>
              <th className="px-2 py-2 font-medium text-center">ה׳</th>
              <th className="px-2 py-2 font-medium text-center">שע׳</th>
              <th className="px-2 py-2 font-medium text-center">+/-</th>
              <th className="px-2 py-2 font-medium text-center text-emerald-400">נק׳</th>
              <th className="px-2 py-2 font-medium text-center hidden sm:table-cell">צורה</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/40">
            {rows.map((row) => (
              <tr key={row.team.id} className="hover:bg-white/3 transition-colors">
                <td className="px-3 py-2.5 text-center">
                  <span className={cn(
                    'inline-flex items-center justify-center h-5 w-5 rounded-full text-[10px] font-bold',
                    row.rank === 1 ? 'bg-yellow-500/20 text-yellow-400' :
                    row.rank === 2 ? 'bg-slate-400/20 text-slate-300' :
                    row.rank === 3 ? 'bg-amber-600/20 text-amber-500' :
                    'text-slate-500'
                  )}>
                    {row.rank}
                  </span>
                </td>
                <td className="px-3 py-2.5">
                  <div className="flex items-center gap-2">
                    <Image src={row.team.logo} alt={row.team.name} width={18} height={18} className="rounded-full shrink-0" unoptimized />
                    <span className="text-slate-200 font-medium truncate max-w-[100px] sm:max-w-none">
                      {translateTeam(row.team.name)}
                    </span>
                  </div>
                </td>
                <td className="px-2 py-2.5 text-center text-slate-400">{row.all.played}</td>
                <td className="px-2 py-2.5 text-center text-emerald-400">{row.all.win}</td>
                <td className="px-2 py-2.5 text-center text-slate-400">{row.all.draw}</td>
                <td className="px-2 py-2.5 text-center text-red-400">{row.all.lose}</td>
                <td className="px-2 py-2.5 text-center text-slate-400">{row.all.goals.for}:{row.all.goals.against}</td>
                <td className={cn('px-2 py-2.5 text-center font-medium', row.goalsDiff > 0 ? 'text-emerald-400' : row.goalsDiff < 0 ? 'text-red-400' : 'text-slate-400')}>
                  {row.goalsDiff > 0 ? `+${row.goalsDiff}` : row.goalsDiff}
                </td>
                <td className="px-2 py-2.5 text-center font-bold text-white">{row.points}</td>
                <td className="px-2 py-2.5 hidden sm:table-cell">
                  <div className="flex items-center gap-0.5 justify-center">
                    {(row.form ?? '').split('').slice(-5).map((c, i) => (
                      <FormBadge key={i} char={c} />
                    ))}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── Knockout Bracket ─────────────────────────────────────────────

// Order of rounds from earliest to latest (RTL: latest = leftmost)
const ROUND_ORDER = [
  'Round of 32',
  'Round Of 32',
  'Round of 16',
  'Round Of 16',
  '1/8-finals',
  'Quarter-finals',
  '1/4-finals',
  'Semi-finals',
  '1/2-finals',
  'Final',
]

const ROUND_LABEL: Record<string, string> = {
  'Round of 32': 'שלב 32',
  'Round Of 32': 'שלב 32',
  'Round of 16': 'שמינית גמר',
  'Round Of 16': 'שמינית גמר',
  '1/8-finals': 'שמינית גמר',
  'Quarter-finals': 'רבע גמר',
  '1/4-finals': 'רבע גמר',
  'Semi-finals': 'חצי גמר',
  '1/2-finals': 'חצי גמר',
  'Final': 'גמר',
}

function scoreDisplay(f: ApiFixture) {
  const h = f.goals.home
  const a = f.goals.away
  if (h === null || a === null) return null
  return `${h} - ${a}`
}

function matchDate(f: ApiFixture) {
  const d = new Date(f.fixture.date)
  return d.toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit' })
}

function MatchSlot({ fixture }: { fixture: ApiFixture | null }) {
  if (!fixture) {
    return (
      <div className="bg-slate-800/40 rounded-lg border border-slate-700/30 p-2 flex flex-col gap-1 min-w-[130px]">
        <div className="flex items-center gap-1.5 py-0.5">
          <div className="w-4 h-4 rounded-full bg-slate-700/50 shrink-0" />
          <span className="text-slate-600 text-xs">TBD</span>
        </div>
        <div className="h-px bg-slate-700/40" />
        <div className="flex items-center gap-1.5 py-0.5">
          <div className="w-4 h-4 rounded-full bg-slate-700/50 shrink-0" />
          <span className="text-slate-600 text-xs">TBD</span>
        </div>
      </div>
    )
  }

  const score = scoreDisplay(fixture)
  const isFinished = ['FT', 'AET', 'PEN', 'AWD', 'WO'].includes(fixture.fixture.status.short)
  const isLive = ['1H', '2H', 'ET', 'P', 'LIVE', 'HT', 'BT'].includes(fixture.fixture.status.short)

  const homeScore = fixture.goals.home
  const awayScore = fixture.goals.away
  const homeWon = isFinished && homeScore !== null && awayScore !== null && homeScore > awayScore
  const awayWon = isFinished && homeScore !== null && awayScore !== null && awayScore > homeScore

  return (
    <div className="bg-[#0d1420] rounded-lg border border-slate-700/40 overflow-hidden min-w-[140px]">
      {/* Home team */}
      <div className={cn('flex items-center gap-1.5 px-2 py-1.5', homeWon && 'bg-emerald-500/5')}>
        <Image src={fixture.teams.home.logo} alt={fixture.teams.home.name} width={16} height={16} className="shrink-0" unoptimized />
        <span className={cn('text-xs font-medium truncate flex-1', homeWon ? 'text-white' : 'text-slate-400')}>
          {translateTeam(fixture.teams.home.name)}
        </span>
        {score && (
          <span className={cn('text-xs font-bold ml-1 shrink-0', homeWon ? 'text-emerald-400' : 'text-slate-500')}>
            {homeScore}
          </span>
        )}
      </div>
      <div className="h-px bg-slate-800/60" />
      {/* Away team */}
      <div className={cn('flex items-center gap-1.5 px-2 py-1.5', awayWon && 'bg-emerald-500/5')}>
        <Image src={fixture.teams.away.logo} alt={fixture.teams.away.name} width={16} height={16} className="shrink-0" unoptimized />
        <span className={cn('text-xs font-medium truncate flex-1', awayWon ? 'text-white' : 'text-slate-400')}>
          {translateTeam(fixture.teams.away.name)}
        </span>
        {score && (
          <span className={cn('text-xs font-bold ml-1 shrink-0', awayWon ? 'text-emerald-400' : 'text-slate-500')}>
            {awayScore}
          </span>
        )}
      </div>
      {/* Date / live indicator */}
      <div className={cn(
        'px-2 py-1 text-[10px] text-center border-t border-slate-800/40',
        isLive ? 'text-emerald-400 bg-emerald-500/5' : 'text-slate-600'
      )}>
        {isLive ? `${fixture.fixture.status.elapsed}′ LIVE` : matchDate(fixture)}
      </div>
    </div>
  )
}

function KnockoutBracket({ rounds }: { rounds: Record<string, ApiFixture[]> }) {
  // Sort rounds in logical order
  const sortedRoundKeys = Object.keys(rounds).sort((a, b) => {
    const ai = ROUND_ORDER.findIndex(r => r.toLowerCase() === a.toLowerCase())
    const bi = ROUND_ORDER.findIndex(r => r.toLowerCase() === b.toLowerCase())
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi)
  })

  if (sortedRoundKeys.length === 0) return null

  // RTL: reverse so final is leftmost
  const displayRounds = [...sortedRoundKeys].reverse()

  return (
    <div className="bg-[#0d1420] rounded-2xl border border-slate-700/40 overflow-hidden">
      <div className="px-4 py-2.5 border-b border-slate-700/40 bg-slate-800/40">
        <h3 className="text-xs font-bold text-emerald-400 tracking-wide">שלבי נוק-אאוט</h3>
      </div>
      <div className="overflow-x-auto p-4">
        <div className="flex gap-4" style={{ direction: 'rtl' }}>
          {displayRounds.map((roundKey) => {
            const label = ROUND_LABEL[roundKey] ?? roundKey
            const fixtures = rounds[roundKey]
            return (
              <div key={roundKey} className="flex flex-col gap-1 min-w-[150px]">
                <div className="text-[11px] font-bold text-slate-400 text-center mb-2 whitespace-nowrap">
                  {label}
                </div>
                <div className="flex flex-col gap-3">
                  {fixtures.map((f) => (
                    <MatchSlot key={f.fixture.id} fixture={f} />
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ── Page ─────────────────────────────────────────────────────────

function isThirdPlaceGroup(groupName: string | undefined | null): boolean {
  if (!groupName) return false
  const lower = groupName.toLowerCase()
  return lower.includes('3rd place') || lower.includes('third place') || lower.includes('ranking of third')
}

export default function StandingsPage() {
  const { id } = useParams() as { id: string }
  const [standings, setStandings]   = useState<ApiStandingEntry[][] | null>(null)
  const [knockoutRounds, setKnockoutRounds] = useState<Record<string, ApiFixture[]> | null>(null)
  const [loading, setLoading]       = useState(true)
  const [error, setError]           = useState('')

  useEffect(() => {
    Promise.all([
      fetch(`/api/standings/${id}`).then(r => r.ok ? r.json() : Promise.reject(r.statusText)),
      fetch(`/api/knockout/${id}`).then(r => r.ok ? r.json() : null).catch(() => null),
    ])
      .then(([standingsData, knockoutData]) => {
        setStandings(standingsData.standings ?? null)
        if (knockoutData?.rounds && Object.keys(knockoutData.rounds).length > 0) {
          setKnockoutRounds(knockoutData.rounds)
        }
      })
      .catch(() => setError('לא ניתן לטעון את הטבלה'))
      .finally(() => setLoading(false))
  }, [id])

  if (loading) return (
    <div className="flex justify-center py-20">
      <Loader2 className="h-7 w-7 animate-spin text-emerald-500" />
    </div>
  )

  if (error) return (
    <p className="text-center py-16 text-slate-500">{error}</p>
  )

  if (!standings?.length && !knockoutRounds) return (
    <p className="text-center py-16 text-slate-500">אין נתוני טבלה לתחרות זו</p>
  )

  const isGroups = (standings?.length ?? 0) > 1

  // Filter out "3rd place ranking" group (World Cup)
  const filteredStandings = standings?.filter(group =>
    !isThirdPlaceGroup(group[0]?.group)
  ) ?? []

  return (
    <div className="space-y-4 max-w-4xl mx-auto">
      {knockoutRounds && <KnockoutBracket rounds={knockoutRounds} />}

      {filteredStandings.map((group, i) => (
        <StandingsTable
          key={i}
          group={isGroups ? (group[0]?.group ?? `בית ${i + 1}`) : null}
          rows={group}
        />
      ))}

      {filteredStandings.length > 0 && (
        <p className="text-center text-[10px] text-slate-600 pb-2">מ׳=משחקים · נ׳=נצחון · ת׳=תיקו · ה׳=הפסד · שע׳=שערים · נק׳=נקודות</p>
      )}
    </div>
  )
}
