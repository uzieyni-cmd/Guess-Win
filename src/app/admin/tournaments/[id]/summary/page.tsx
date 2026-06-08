'use client'
import { useEffect, useState, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { Users, Gift, BarChart2, Calendar, Download, ChevronRight, X, Loader2 } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  getTournamentSummary, getBonusQuestionStats, getBonusPickDetail,
  getMatchStats, getMatchBettingDetail,
  TournamentSummary, BonusQuestionStat, BonusPickDetail,
  MatchStat, MatchBettingDetail,
} from '@/app/actions/summary'
import { translateTeam } from '@/lib/teams-he'

const RESULT_LABEL: Record<string, string> = {
  exact: 'בול ✓✓',
  outcome: 'כיוון ✓',
  miss: 'החטאה ✗',
}

const STATUS_LABEL: Record<string, string> = {
  finished: 'הסתיים',
  live: 'חי',
  scheduled: 'מתוכנן',
}

// ── ייצוא Excel ───────────────────────────────────────────────────
async function exportBonusDetail(question: string, detail: BonusPickDetail) {
  const { utils, writeFile } = await import('xlsx')
  const filledRows = detail.filled.map(r => ({
    'שם': r.name,
    'תשובה': r.pick,
    'נקודות': r.pointsAwarded ?? '',
    'סטטוס': 'מילא',
  }))
  const notFilledRows = detail.notFilled.map(r => ({
    'שם': r.name,
    'תשובה': '',
    'נקודות': '',
    'סטטוס': 'לא מילא',
  }))
  const ws = utils.json_to_sheet([...filledRows, ...notFilledRows])
  const wb = utils.book_new()
  utils.book_append_sheet(wb, ws, 'בונוס')
  writeFile(wb, `bonus_${question.slice(0, 20)}.xlsx`)
}

async function exportMatchDetail(homeTeam: string, awayTeam: string, detail: MatchBettingDetail) {
  const { utils, writeFile } = await import('xlsx')
  const bettorRows = detail.bettors.map(r => ({
    'שם': r.name,
    'ניחוש': `${r.predictedHome}:${r.predictedAway}`,
    'תוצאה': r.result ? (RESULT_LABEL[r.result] ?? r.result) : 'ממתין',
    'נקודות': r.points ?? '',
    'סטטוס': 'ניחש',
  }))
  const notBettorRows = detail.nonBettors.map(r => ({
    'שם': r.name,
    'ניחוש': '',
    'תוצאה': '',
    'נקודות': '',
    'סטטוס': 'לא ניחש',
  }))
  const ws = utils.json_to_sheet([...bettorRows, ...notBettorRows])
  const wb = utils.book_new()
  utils.book_append_sheet(wb, ws, 'משחק')
  writeFile(wb, `match_${homeTeam}_vs_${awayTeam}.xlsx`)
}

// ── Modal ─────────────────────────────────────────────────────────
function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 bg-card border border-border rounded-2xl w-full max-w-lg max-h-[80vh] flex flex-col shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h3 className="font-semibold text-foreground text-sm">{title}</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted transition-colors">
            <X className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>
        <div className="overflow-y-auto flex-1 px-5 py-4">
          {children}
        </div>
      </div>
    </div>
  )
}

// ── גרף עמודות CSS ────────────────────────────────────────────────
function DistributionBar({ distribution, total }: { distribution: Record<string, number>; total: number }) {
  if (!total) return null
  const entries = Object.entries(distribution).sort((a, b) => b[1] - a[1])
  const colors = ['bg-blue-500', 'bg-emerald-500', 'bg-amber-500', 'bg-purple-500', 'bg-rose-500', 'bg-cyan-500']
  return (
    <div className="space-y-1.5 mt-2">
      {entries.map(([opt, cnt], i) => (
        <div key={opt} className="flex items-center gap-2 text-xs">
          <span className="w-28 truncate text-muted-foreground text-right">{opt}</span>
          <div className="flex-1 bg-muted rounded-full h-3 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${colors[i % colors.length]}`}
              style={{ width: `${Math.round((cnt / total) * 100)}%` }}
            />
          </div>
          <span className="w-10 text-left font-medium">{cnt} ({Math.round((cnt / total) * 100)}%)</span>
        </div>
      ))}
    </div>
  )
}

export default function SummaryPage() {
  const { id } = useParams<{ id: string }>()

  const [summary, setSummary] = useState<TournamentSummary | null>(null)
  const [bonusStats, setBonusStats] = useState<BonusQuestionStat[]>([])
  const [matchStats, setMatchStats] = useState<MatchStat[]>([])
  const [loading, setLoading] = useState(true)

  const [bonusModal, setBonusModal] = useState<{ stat: BonusQuestionStat; detail: BonusPickDetail } | null>(null)
  const [bonusModalLoading, setBonusModalLoading] = useState(false)
  const [matchModal, setMatchModal] = useState<{ stat: MatchStat; detail: MatchBettingDetail } | null>(null)
  const [matchModalLoading, setMatchModalLoading] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [s, b, m] = await Promise.all([
        getTournamentSummary(id),
        getBonusQuestionStats(id),
        getMatchStats(id),
      ])
      setSummary(s)
      setBonusStats(b)
      setMatchStats(m)
    } catch (e) {
      console.error('[summary] load error:', e)
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => { load() }, [load])

  const openBonusModal = async (stat: BonusQuestionStat) => {
    setBonusModalLoading(true)
    try {
      const detail = await getBonusPickDetail(stat.id, id)
      setBonusModal({ stat, detail })
    } finally {
      setBonusModalLoading(false)
    }
  }

  const openMatchModal = async (stat: MatchStat) => {
    setMatchModalLoading(true)
    try {
      const detail = await getMatchBettingDetail(stat.matchId, id)
      setMatchModal({ stat, detail })
    } finally {
      setMatchModalLoading(false)
    }
  }

  if (loading) return (
    <div className="flex items-center justify-center h-60">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
    </div>
  )

  return (
    <div className="p-6 max-w-3xl space-y-8">
      <h1 className="font-suez text-2xl">סיכום טורניר</h1>

      {/* ── 1. כרטיסי סיכום ────────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-3">
        <Card>
          <CardContent className="pt-5 pb-4 text-center">
            <Users className="h-5 w-5 mx-auto mb-1 text-primary" />
            <p className="text-2xl font-bold">{summary?.participantCount ?? 0}</p>
            <p className="text-xs text-muted-foreground mt-0.5">משתתפים</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5 pb-4 text-center">
            <Calendar className="h-5 w-5 mx-auto mb-1 text-primary" />
            <p className="text-2xl font-bold">{summary?.bettorsCount ?? 0}</p>
            <p className="text-xs text-muted-foreground mt-0.5">ניחשו משחק</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5 pb-4 text-center">
            <Gift className="h-5 w-5 mx-auto mb-1 text-primary" />
            <p className="text-2xl font-bold">{summary?.bonusFilledCount ?? 0}</p>
            <p className="text-xs text-muted-foreground mt-0.5">מילאו בונוס</p>
          </CardContent>
        </Card>
      </div>

      {/* ── 2+3. בונוסים ───────────────────────────────────────── */}
      {bonusStats.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Gift className="h-4 w-4" /> שאלות בונוס
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            {bonusStats.map(stat => {
              const total = stat.filledCount + stat.notFilledCount
              const pct = total ? Math.round((stat.filledCount / total) * 100) : 0
              return (
                <div key={stat.id} className="border border-border rounded-xl p-4 space-y-2">
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-sm font-medium">{stat.question}</p>
                    <Badge variant="outline" className="shrink-0">{stat.points} נק׳</Badge>
                  </div>
                  {/* Progress bar */}
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-emerald-600 font-medium">{stat.filledCount} מילאו</span>
                    <div className="flex-1 bg-muted rounded-full h-2">
                      <div className="bg-emerald-500 h-full rounded-full" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="text-muted-foreground">{stat.notFilledCount} לא מילאו ({pct}%)</span>
                  </div>
                  {/* Distribution */}
                  {Object.keys(stat.distribution).length > 0 && (
                    <DistributionBar distribution={stat.distribution} total={stat.filledCount} />
                  )}
                  <Button
                    size="sm" variant="outline"
                    className="mt-1 h-7 text-xs"
                    onClick={() => openBonusModal(stat)}
                    disabled={bonusModalLoading}
                  >
                    {bonusModalLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <><ChevronRight className="h-3 w-3" />פירוט</>}
                  </Button>
                </div>
              )
            })}
          </CardContent>
        </Card>
      )}

      {/* ── 4. משחקים ──────────────────────────────────────────── */}
      {matchStats.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <BarChart2 className="h-4 w-4" /> פירוט ניחושים למשחק
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1">
              {matchStats.map(stat => {
                const home = translateTeam(stat.homeTeam)
                const away = translateTeam(stat.awayTeam)
                const total = stat.bettorsCount + stat.nonBettorsCount
                const pct = total ? Math.round((stat.bettorsCount / total) * 100) : 0
                const dateStr = stat.matchStartTime
                  ? new Date(stat.matchStartTime).toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit' })
                  : ''
                return (
                  <div key={stat.matchId}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-muted/50 transition-colors">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{home} נגד {away}</p>
                      <p className="text-xs text-muted-foreground">
                        {dateStr}{stat.round ? ` · ${stat.round}` : ''} ·{' '}
                        <span className={stat.status === 'finished' ? 'text-muted-foreground' : stat.status === 'live' ? 'text-emerald-600' : 'text-amber-600'}>
                          {STATUS_LABEL[stat.status] ?? stat.status}
                        </span>
                      </p>
                    </div>
                    <div className="text-xs text-right shrink-0">
                      <span className="text-emerald-600 font-medium">{stat.bettorsCount}</span>
                      <span className="text-muted-foreground"> / {total} ({pct}%)</span>
                    </div>
                    <Button
                      size="sm" variant="outline"
                      className="h-7 text-xs shrink-0"
                      onClick={() => openMatchModal(stat)}
                      disabled={matchModalLoading}
                    >
                      {matchModalLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : 'פירוט'}
                    </Button>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Modal: פירוט בונוס ─────────────────────────────────── */}
      {bonusModal && (
        <Modal
          title={bonusModal.stat.question}
          onClose={() => setBonusModal(null)}
        >
          <div className="space-y-4">
            <Button size="sm" variant="outline" className="h-7 text-xs"
              onClick={() => exportBonusDetail(bonusModal.stat.question, bonusModal.detail)}>
              <Download className="h-3 w-3 ml-1" /> ייצוא Excel
            </Button>

            {bonusModal.detail.filled.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-emerald-600 mb-2">מילאו ({bonusModal.detail.filled.length})</p>
                <div className="space-y-1">
                  {bonusModal.detail.filled.map(r => (
                    <div key={r.userId} className="flex items-center justify-between text-sm py-1.5 border-b border-border/40 last:border-0">
                      <span>{r.name}</span>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span className="bg-muted px-2 py-0.5 rounded">{r.pick}</span>
                        {r.pointsAwarded !== null && (
                          <span className={r.pointsAwarded > 0 ? 'text-emerald-600 font-medium' : 'text-muted-foreground'}>
                            {r.pointsAwarded} נק׳
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {bonusModal.detail.notFilled.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-red-500 mb-2">לא מילאו ({bonusModal.detail.notFilled.length})</p>
                <div className="space-y-1">
                  {bonusModal.detail.notFilled.map(r => (
                    <div key={r.userId} className="text-sm py-1.5 border-b border-border/40 last:border-0 text-muted-foreground">
                      {r.name}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </Modal>
      )}

      {/* ── Modal: פירוט משחק ──────────────────────────────────── */}
      {matchModal && (
        <Modal
          title={`${translateTeam(matchModal.detail.homeTeam)} נגד ${translateTeam(matchModal.detail.awayTeam)}`}
          onClose={() => setMatchModal(null)}
        >
          <div className="space-y-4">
            {matchModal.detail.actualHome !== null && (
              <p className="text-sm text-center font-semibold">
                תוצאה: <span dir="ltr" className="font-mono tabular-nums">{matchModal.detail.actualAway}:{matchModal.detail.actualHome}</span>
              </p>
            )}

            <Button size="sm" variant="outline" className="h-7 text-xs"
              onClick={() => exportMatchDetail(matchModal.detail.homeTeam, matchModal.detail.awayTeam, matchModal.detail)}>
              <Download className="h-3 w-3 ml-1" /> ייצוא Excel
            </Button>

            {matchModal.detail.bettors.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-emerald-600 mb-2">ניחשו ({matchModal.detail.bettors.length})</p>
                <div className="space-y-1">
                  {matchModal.detail.bettors.map(r => (
                    <div key={r.userId} className="flex items-center justify-between text-sm py-1.5 border-b border-border/40 last:border-0">
                      <span>{r.name}</span>
                      <div className="flex items-center gap-3 text-xs">
                        <span dir="ltr" className="bg-muted px-2 py-0.5 rounded font-mono tabular-nums">{r.predictedAway}:{r.predictedHome}</span>
                        {r.result && (
                          <span className={
                            r.result === 'exact' ? 'text-emerald-600 font-medium' :
                            r.result === 'outcome' ? 'text-amber-600' : 'text-muted-foreground'
                          }>
                            {RESULT_LABEL[r.result]}
                          </span>
                        )}
                        {r.points !== null && (
                          <span className={r.points > 0 ? 'text-emerald-600 font-medium' : 'text-muted-foreground'}>
                            {r.points} נק׳
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {matchModal.detail.nonBettors.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-red-500 mb-2">לא ניחשו ({matchModal.detail.nonBettors.length})</p>
                <div className="space-y-1">
                  {matchModal.detail.nonBettors.map(r => (
                    <div key={r.userId} className="text-sm py-1.5 border-b border-border/40 last:border-0 text-muted-foreground">
                      {r.name}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </Modal>
      )}
    </div>
  )
}
