'use client'
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import Image from 'next/image'
import { cn } from '@/lib/utils'
import { ApiStandingEntry } from '@/lib/api-football'

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
                    <span className="text-slate-200 font-medium truncate max-w-[100px] sm:max-w-none">{row.team.name}</span>
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

export default function StandingsPage() {
  const { id } = useParams() as { id: string }
  const [standings, setStandings] = useState<ApiStandingEntry[][] | null>(null)
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState('')

  useEffect(() => {
    fetch(`/api/standings/${id}`)
      .then(r => r.ok ? r.json() : Promise.reject(r.statusText))
      .then(d => setStandings(d.standings))
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

  if (!standings?.length) return (
    <p className="text-center py-16 text-slate-500">אין נתוני טבלה לתחרות זו</p>
  )

  // בת אחת = ליגה רגילה, כמה בתים = שלב בתים
  const isGroups = standings.length > 1

  return (
    <div className="space-y-4 max-w-2xl mx-auto">
      {standings.map((group, i) => (
        <StandingsTable
          key={i}
          group={isGroups ? (group[0]?.group ?? `בית ${i + 1}`) : null}
          rows={group}
        />
      ))}
      <p className="text-center text-[10px] text-slate-600 pb-2">מ׳=משחקים · נ׳=נצחון · ת׳=תיקו · ה׳=הפסד · שע׳=שערים · נק׳=נקודות</p>
    </div>
  )
}
