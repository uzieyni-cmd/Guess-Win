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

const ROUND_ORDER = [
  'Round of 32', 'Round Of 32',
  'Round of 16', 'Round Of 16', '1/8-finals',
  'Quarter-finals', '1/4-finals',
  'Semi-finals', '1/2-finals',
  'Final',
]

const ROUND_LABEL: Record<string, string> = {
  'Round of 32': 'שלב 32', 'Round Of 32': 'שלב 32',
  'Round of 16': 'שמינית גמר', 'Round Of 16': 'שמינית גמר', '1/8-finals': 'שמינית גמר',
  'Quarter-finals': 'רבע גמר', '1/4-finals': 'רבע גמר',
  'Semi-finals': 'חצי גמר', '1/2-finals': 'חצי גמר',
  'Final': 'גמר',
}

interface Tie {
  team1: { id: number; name: string; logo: string }
  team2: { id: number; name: string; logo: string }
  goals1: number | null  // aggregate for team1
  goals2: number | null  // aggregate for team2
  winner: 1 | 2 | null  // null = ongoing / penalties not tracked
  isLive: boolean
  nextDate: string | null
}

function buildTies(fixtures: ApiFixture[]): Tie[] {
  // Group fixtures by the (sorted) pair of team IDs
  const map = new Map<string, ApiFixture[]>()
  for (const f of fixtures) {
    const key = [f.teams.home.id, f.teams.away.id].sort((a, b) => a - b).join('-')
    if (!map.has(key)) map.set(key, [])
    map.get(key)!.push(f)
  }

  const FINISHED = new Set(['FT', 'AET', 'PEN', 'AWD', 'WO'])
  const LIVE     = new Set(['1H', '2H', 'ET', 'P', 'LIVE', 'HT', 'BT'])

  return Array.from(map.values()).map(legs => {
    // Use first leg to define team1/team2
    const first = legs[0]
    const team1 = first.teams.home
    const team2 = first.teams.away

    let goals1: number | null = null
    let goals2: number | null = null
    let anyLive = false
    let nextDate: string | null = null

    for (const f of legs) {
      const isFinished = FINISHED.has(f.fixture.status.short)
      const live = LIVE.has(f.fixture.status.short)
      if (live) anyLive = true

      if (isFinished || live) {
        const h = f.goals.home ?? 0
        const a = f.goals.away ?? 0
        if (f.teams.home.id === team1.id) {
          goals1 = (goals1 ?? 0) + h
          goals2 = (goals2 ?? 0) + a
        } else {
          goals1 = (goals1 ?? 0) + a
          goals2 = (goals2 ?? 0) + h
        }
      } else {
        // upcoming leg — track earliest date
        const d = f.fixture.date
        if (!nextDate || d < nextDate) nextDate = d
      }
    }

    const allDone = legs.every(f => FINISHED.has(f.fixture.status.short))
    let winner: 1 | 2 | null = null
    if (allDone && goals1 !== null && goals2 !== null) {
      if (goals1 > goals2) winner = 1
      else if (goals2 > goals1) winner = 2
      else {
        // Aggregate level — check penalty shootout (status PEN)
        const penLeg = legs.find(f => f.fixture.status.short === 'PEN')
        if (penLeg) {
          const ph = penLeg.score.penalty.home ?? 0
          const pa = penLeg.score.penalty.away ?? 0
          if (penLeg.teams.home.id === team1.id) {
            if (ph > pa) winner = 1
            else if (pa > ph) winner = 2
          } else {
            if (pa > ph) winner = 1
            else if (ph > pa) winner = 2
          }
        }
      }
    }

    return { team1, team2, goals1, goals2, winner, isLive: anyLive, nextDate }
  })
}

function TieSlot({ tie }: { tie: Tie | null }) {
  if (!tie) {
    return (
      <div className="bg-slate-800/30 rounded-lg border border-slate-700/20 p-2 flex flex-col gap-1 min-w-[140px]">
        {[0, 1].map(i => (
          <div key={i} className="flex items-center gap-1.5 py-0.5">
            <div className="w-4 h-4 rounded-full bg-slate-700/40 shrink-0" />
            <span className="text-slate-600 text-xs">TBD</span>
          </div>
        ))}
      </div>
    )
  }

  const { team1, team2, goals1, goals2, winner, isLive, nextDate } = tie
  const hasScore = goals1 !== null && goals2 !== null

  const rowClass = (w: 1 | 2) => cn(
    'flex items-center gap-1.5 px-2 py-1.5 transition-colors',
    winner === w ? 'bg-emerald-500/8' : ''
  )
  const nameClass = (w: 1 | 2) => cn(
    'text-xs font-medium truncate flex-1',
    winner === w ? 'text-white font-bold' : 'text-slate-400'
  )
  const scoreClass = (w: 1 | 2) => cn(
    'text-xs font-bold shrink-0',
    winner === w ? 'text-emerald-400' : 'text-slate-500'
  )

  let footer: React.ReactNode = null
  if (isLive) {
    footer = <span className="text-emerald-400">LIVE</span>
  } else if (nextDate) {
    footer = <span>{new Date(nextDate).toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit' })}</span>
  } else if (hasScore) {
    footer = <span>סה״כ</span>
  }

  return (
    <div className="bg-[#0d1420] rounded-lg border border-slate-700/40 overflow-hidden min-w-[150px]">
      <div className={rowClass(1)}>
        <Image src={team1.logo} alt={team1.name} width={16} height={16} className="shrink-0" unoptimized />
        <span className={nameClass(1)}>{translateTeam(team1.name)}</span>
        {hasScore && <span className={scoreClass(1)}>{goals1}</span>}
      </div>
      <div className="h-px bg-slate-800/60" />
      <div className={rowClass(2)}>
        <Image src={team2.logo} alt={team2.name} width={16} height={16} className="shrink-0" unoptimized />
        <span className={nameClass(2)}>{translateTeam(team2.name)}</span>
        {hasScore && <span className={scoreClass(2)}>{goals2}</span>}
      </div>
      {footer && (
        <div className={cn(
          'px-2 py-1 text-[10px] text-center border-t border-slate-800/40',
          isLive ? 'text-emerald-400 bg-emerald-500/5' : 'text-slate-600'
        )}>
          {footer}
        </div>
      )}
    </div>
  )
}

// ── Bracket Tree ─────────────────────────────────────────────────

const CELL_H = 74
const CELL_GAP_0 = 12
const COL_W = 155
const COL_GAP = 40

interface BracketSlot {
  tie: Tie | null
  childIndices: [number, number] | null  // indices in previous round, null = first round or unknown
}

function colX(r: number, totalRounds: number): number {
  return (totalRounds - 1 - r) * (COL_W + COL_GAP)
}

// Build bracket matrix with per-round draw orders and childIndices for SVG connections
function buildBracketMatrix(
  orderedRounds: Array<{ key: string; ties: Tie[] }>,
  roundOrders: Record<string, string[]>
): BracketSlot[][] {
  const tieByKey = new Map<string, Tie>()
  for (const round of orderedRounds) {
    for (const tie of round.ties) {
      const key = [tie.team1.id, tie.team2.id].sort((a, b) => a - b).join('-')
      tieByKey.set(key, tie)
    }
  }

  const matrix: BracketSlot[][] = []

  for (let r = 0; r < orderedRounds.length; r++) {
    const roundKey = orderedRounds[r].key
    const order = roundOrders[roundKey] ?? []
    const ties = order.map(k => tieByKey.get(k) ?? null)

    if (r === 0) {
      matrix.push(ties.map(tie => ({ tie, childIndices: null })))
      continue
    }

    const prevSlots = matrix[r - 1]
    const slots: BracketSlot[] = []

    for (const tie of ties) {
      let c0 = -1, c1 = -1
      if (tie) {
        // Find which two previous slots' winners are this tie's teams
        for (let i = 0; i < prevSlots.length; i++) {
          const prev = prevSlots[i].tie
          if (!prev?.winner) continue
          const winnerId = prev.winner === 1 ? prev.team1.id : prev.team2.id
          if (winnerId === tie.team1.id || winnerId === tie.team2.id) {
            if (c0 === -1) c0 = i
            else { c1 = i; break }
          }
        }
      }
      slots.push({ tie, childIndices: c0 !== -1 && c1 !== -1 ? [c0, c1] : null })
    }

    matrix.push(slots)
  }

  return matrix
}

// Compute vertical centers for all slots bottom-up; uses childIndices when available
function computeCenters(matrix: BracketSlot[][]): number[][] {
  const centers: number[][] = []
  for (let r = 0; r < matrix.length; r++) {
    centers.push([])
    for (let p = 0; p < matrix[r].length; p++) {
      if (r === 0) {
        centers[r][p] = p * (CELL_H + CELL_GAP_0) + CELL_H / 2
      } else {
        const slot = matrix[r][p]
        if (slot.childIndices) {
          const [c0, c1] = slot.childIndices
          centers[r][p] = (centers[r - 1][c0] + centers[r - 1][c1]) / 2
        } else {
          // No known children — evenly space within the round's expected range
          const prevH = matrix[r - 1].length * (CELL_H + CELL_GAP_0) - CELL_GAP_0
          const currSize = matrix[r].length
          const step = prevH / currSize
          centers[r][p] = p * step + step / 2
        }
      }
    }
  }
  return centers
}

function BracketTree({
  matrix,
  roundLabels,
}: {
  matrix: BracketSlot[][]
  roundLabels: string[]
}) {
  const n = matrix.length
  const firstRoundCount = matrix[0].length

  const totalHeight = firstRoundCount * (CELL_H + CELL_GAP_0) - CELL_GAP_0
  const totalWidth = n * COL_W + (n - 1) * COL_GAP
  const centers = computeCenters(matrix)

  const lines: { x1: number; y1: number; x2: number; y2: number }[] = []
  for (let r = 1; r < n; r++) {
    for (let p = 0; p < matrix[r].length; p++) {
      const slot = matrix[r][p]
      if (!slot.childIndices) continue
      const [c0, c1] = slot.childIndices
      const yParent = centers[r][p]
      const yChild0 = centers[r - 1][c0]
      const yChild1 = centers[r - 1][c1]
      const parentRight = colX(r, n) + COL_W
      const childLeft = colX(r - 1, n)
      const midX = parentRight + COL_GAP / 2

      lines.push({ x1: parentRight, y1: yParent, x2: midX, y2: yParent })
      lines.push({ x1: midX, y1: Math.min(yChild0, yChild1), x2: midX, y2: Math.max(yChild0, yChild1) })
      lines.push({ x1: midX, y1: yChild0, x2: childLeft, y2: yChild0 })
      lines.push({ x1: midX, y1: yChild1, x2: childLeft, y2: yChild1 })
    }
  }

  return (
    <div style={{ overflowX: 'auto' }}>
      <div style={{ position: 'relative', width: totalWidth, height: totalHeight + 28, paddingTop: 28 }}>
        {roundLabels.map((label, r) => (
          <div
            key={r}
            style={{ position: 'absolute', left: colX(r, n), top: 0, width: COL_W, textAlign: 'center' }}
            className="text-[11px] font-bold text-slate-400 whitespace-nowrap"
          >
            {label}
          </div>
        ))}

        <svg
          style={{ position: 'absolute', left: 0, top: 28, pointerEvents: 'none' }}
          width={totalWidth}
          height={totalHeight}
        >
          {lines.map((l, i) => (
            <line key={i} x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2} stroke="#334155" strokeWidth={1.5} />
          ))}
        </svg>

        {matrix.map((roundSlots, r) =>
          roundSlots.map((slot, p) => (
            <div
              key={`${r}-${p}`}
              style={{
                position: 'absolute',
                left: colX(r, n),
                top: 28 + centers[r][p] - CELL_H / 2,
                width: COL_W,
              }}
            >
              <TieSlot tie={slot.tie} />
            </div>
          ))
        )}
      </div>
    </div>
  )
}

function KnockoutBracket({
  rounds,
  bracketConfig,
}: {
  rounds: Record<string, ApiFixture[]>
  bracketConfig: { roundOrders?: Record<string, string[]>; firstRound?: string; tieOrder?: string[] } | null
}) {
  const sortedRoundKeys = Object.keys(rounds).sort((a, b) => {
    const ai = ROUND_ORDER.findIndex(r => r.toLowerCase() === a.toLowerCase())
    const bi = ROUND_ORDER.findIndex(r => r.toLowerCase() === b.toLowerCase())
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi)
  })

  if (sortedRoundKeys.length === 0) return null

  const orderedRounds = sortedRoundKeys.map(key => ({
    key,
    label: ROUND_LABEL[key] ?? key,
    ties: buildTies(rounds[key]),
  }))

  // Normalise config: support new { roundOrders } and old { firstRound, tieOrder }
  const roundOrders: Record<string, string[]> =
    bracketConfig?.roundOrders ??
    (bracketConfig?.firstRound && bracketConfig?.tieOrder
      ? { [bracketConfig.firstRound]: bracketConfig.tieOrder }
      : {})

  const configuredRoundKeys = sortedRoundKeys.filter(k => roundOrders[k]?.length > 0)

  if (configuredRoundKeys.length > 0) {
    // Start the bracket from the earliest configured round
    const firstIdx = sortedRoundKeys.indexOf(configuredRoundKeys[0])
    const bracketRounds = orderedRounds.slice(firstIdx)
    const matrix = buildBracketMatrix(bracketRounds, roundOrders)
    const roundLabels = bracketRounds.map(r => r.label)

    return (
      <div className="bg-[#0d1420] rounded-2xl border border-slate-700/40 overflow-hidden">
        <div className="px-4 py-2.5 border-b border-slate-700/40 bg-slate-800/40">
          <h3 className="text-xs font-bold text-emerald-400 tracking-wide">שלבי נוק-אאוט</h3>
        </div>
        <div className="p-4">
          <BracketTree matrix={matrix} roundLabels={roundLabels} />
        </div>
      </div>
    )
  }

  // Fallback: column view (RTL reversed)
  const displayRounds = [...sortedRoundKeys].reverse()
  return (
    <div className="bg-[#0d1420] rounded-2xl border border-slate-700/40 overflow-hidden">
      <div className="px-4 py-2.5 border-b border-slate-700/40 bg-slate-800/40">
        <h3 className="text-xs font-bold text-emerald-400 tracking-wide">שלבי נוק-אאוט</h3>
      </div>
      <div className="overflow-x-auto p-4">
        <div className="flex gap-4" style={{ direction: 'rtl' }}>
          {displayRounds.map((roundKey) => {
            const ties = buildTies(rounds[roundKey])
            const label = ROUND_LABEL[roundKey] ?? roundKey
            return (
              <div key={roundKey} className="flex flex-col gap-1 min-w-[155px]">
                <div className="text-[11px] font-bold text-slate-400 text-center mb-2 whitespace-nowrap">
                  {label}
                </div>
                <div className="flex flex-col gap-3">
                  {ties.map((tie, i) => (
                    <TieSlot key={i} tie={tie} />
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
  const [bracketConfig, setBracketConfig] = useState<{ roundOrders?: Record<string, string[]>; firstRound?: string; tieOrder?: string[] } | null>(null)
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
        if (knockoutData?.bracketConfig) {
          setBracketConfig(knockoutData.bracketConfig)
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
      {knockoutRounds && <KnockoutBracket rounds={knockoutRounds} bracketConfig={bracketConfig} />}

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
