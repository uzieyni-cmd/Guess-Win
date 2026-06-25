'use client'
import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { Plus, Save, CheckCircle2, RefreshCw, Loader2, RotateCcw, EyeOff, Eye, Trash2, Gift, Shield, Pencil, Clock, ArrowUp, BarChart2, Users, CreditCard } from 'lucide-react'
import Link from 'next/link'
import Image from 'next/image'
import { useTournament } from '@/context/TournamentContext'
import { syncFixtures, syncOdds, setMatchScore, refreshMatchResult, setMatchHidden, setRoundHidden } from '@/app/actions/fixtures'
import { rescoreTournamentBets } from '@/app/actions/bets'
import { getBonusQuestions, createBonusQuestion, updateBonusQuestion, deleteBonusQuestion, setBonusResult, syncAllBonusLockTimes } from '@/app/actions/bonus'
import { getTournamentAdmins, assignTournamentAdmin, removeTournamentAdmin } from '@/app/actions/roles'
import { awardAdvancementBonus, getTeamPickTeams } from '@/app/actions/roundBonus'
import { setPaymentStatus } from '@/app/actions/users'
import { setupMonkey, joinMonkeyToTournament, runMonkeyBets, runMonkeyBonusPicks } from '@/app/actions/ai-monkey'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { TeamFlag } from '@/components/shared/TeamFlag'
import { translateRound } from '@/components/tournament/MatchCard'
import { Match, BonusQuestion, UserRole } from '@/types'
import { ApiFixture } from '@/lib/api-football'
import { cn } from '@/lib/utils'
import { translateTeam } from '@/lib/teams-he'

// ── datetime-local helpers (זמן נעילה ידני) ─────────────────────
// ISO (UTC) → ערך datetime-local בזמן מקומי של הדפדפן
function isoToLocalInput(iso: string): string {
  const d = new Date(iso)
  if (isNaN(d.getTime())) return ''
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000)
  return local.toISOString().slice(0, 16)
}
// ערך datetime-local (זמן מקומי) → ISO (UTC)
function localInputToIso(local: string): string {
  return new Date(local).toISOString()
}

// ── MonkeyBetsSection ────────────────────────────────────────────

const MONKEY_EMAIL = 'ai-monkey@guessandwin.internal'

interface MonkeyBetRow {
  matchId: string
  homeTeam: string
  awayTeam: string
  predictedHome: number
  predictedAway: number
  matchTime: string
  status: string
  actualHome: number | null
  actualAway: number | null
  points: number | null
}

function MonkeyBetsSection({ tournamentId }: { tournamentId: string }) {
  const [bets, setBets] = useState<MonkeyBetRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      // שלוף את ה-userId של הקוף
      const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .eq('email', MONKEY_EMAIL)
        .single()

      if (!profile) { setLoading(false); return }

      const { data: rawBets } = await supabase
        .from('bets')
        .select('match_id, predicted_home, predicted_away, points')
        .eq('tournament_id', tournamentId)
        .eq('user_id', profile.id)

      if (!rawBets?.length) { setLoading(false); return }

      const matchIds = rawBets.map((b: { match_id: string }) => b.match_id)
      const { data: matches } = await supabase
        .from('matches')
        .select('id, home_team_name, away_team_name, match_start_time, status, actual_home_score, actual_away_score')
        .in('id', matchIds)
        .order('match_start_time', { ascending: true })

      const matchMap: Record<string, { home_team_name: string; away_team_name: string; match_start_time: string; status: string; actual_home_score: number | null; actual_away_score: number | null }> = {}
      for (const m of (matches ?? []) as { id: string; home_team_name: string; away_team_name: string; match_start_time: string; status: string; actual_home_score: number | null; actual_away_score: number | null }[]) {
        matchMap[m.id] = m
      }

      setBets(rawBets.map((b: { match_id: string; predicted_home: number; predicted_away: number; points: number | null }) => {
        const m = matchMap[b.match_id]
        return {
          matchId: b.match_id,
          homeTeam: m?.home_team_name ?? '',
          awayTeam: m?.away_team_name ?? '',
          predictedHome: b.predicted_home,
          predictedAway: b.predicted_away,
          matchTime: m?.match_start_time ?? '',
          status: m?.status ?? '',
          actualHome: m?.actual_home_score ?? null,
          actualAway: m?.actual_away_score ?? null,
          points: b.points,
        }
      }))
      setLoading(false)
    }
    load()
  }, [tournamentId])

  const totalPoints = bets.reduce((s, b) => s + (b.points ?? 0), 0)

  return (
    <Card className="mt-4">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            🐒 ניחושי הקוף
          </CardTitle>
          {bets.length > 0 && (
            <span className="text-sm font-medium text-emerald-600">{totalPoints} נקודות</span>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center gap-2 text-muted-foreground py-2">
            <Loader2 className="h-4 w-4 animate-spin" /><span className="text-sm">טוען...</span>
          </div>
        ) : bets.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">הקוף לא ניחש עדיין</p>
        ) : (
          <div className="space-y-1.5">
            {bets.map(b => {
              const isFinished = b.status === 'finished'
              const correct = isFinished && b.actualHome !== null
              return (
                <div key={b.matchId} className="flex items-center justify-between text-sm px-3 py-2 rounded-lg bg-muted/40 border border-border gap-2">
                  <div className="flex-1 min-w-0">
                    <span className="font-medium truncate">{b.homeTeam} נ&apos; {b.awayTeam}</span>
                    <span className="text-xs text-muted-foreground mr-2">
                      {new Date(b.matchTime).toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="font-bold tabular-nums">{b.predictedHome}:{b.predictedAway}</span>
                    {correct && (
                      <span className="text-xs text-muted-foreground">({b.actualHome}:{b.actualAway})</span>
                    )}
                    {b.points !== null && (
                      <Badge variant="outline" className={b.points > 0 ? 'text-emerald-600 border-emerald-300' : 'text-muted-foreground'}>
                        {b.points} נק&apos;
                      </Badge>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// ── MonkeySection ─────────────────────────────────────────────────

function MonkeySection({ tournamentId }: { tournamentId: string }) {
  const [msg, setMsg] = useState('')
  const [loading, setLoading] = useState(false)

  const run = async (action: () => Promise<{ ok: boolean; placed?: number; skipped?: number; error?: string }>, label: string) => {
    setLoading(true)
    setMsg('')
    const res = await action()
    setLoading(false)
    if (res.ok) {
      setMsg(`✓ ${label}: ${res.placed ?? 0} הונחו, ${res.skipped ?? 0} דולגו`)
    } else {
      setMsg(`שגיאה: ${res.error}`)
    }
    setTimeout(() => setMsg(''), 5000)
  }

  const handleSetup = async () => {
    setLoading(true)
    setMsg('')
    const s = await setupMonkey()
    if (!s.ok) { setMsg(`שגיאה: ${s.error}`); setLoading(false); return }
    const j = await joinMonkeyToTournament(tournamentId)
    setLoading(false)
    setMsg(j.ok ? '✓ הקוף הוגדר ונרשם לטורניר' : `שגיאה: ${j.error}`)
    setTimeout(() => setMsg(''), 4000)
  }

  return (
    <Card className="mt-6">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          🐒 קוף — מתחרה AI
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          מתחרה AI שמנחש משחקים ובונוסים אוטומטית לפני נעילה. הCRON רץ כל שעה.
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        {msg && (
          <p className={`text-sm px-3 py-2 rounded-lg ${msg.startsWith('✓') ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700'}`}>
            {msg}
          </p>
        )}
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={handleSetup} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 ml-1 animate-spin" /> : '🐒'}
            הגדר קוף לטורניר
          </Button>
          <Button size="sm" variant="outline" onClick={() => run(() => runMonkeyBets(tournamentId), 'ניחושי משחקים')} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 ml-1 animate-spin" /> : '⚽'}
            הרץ ניחושי משחקים עכשיו
          </Button>
          <Button size="sm" variant="outline" onClick={() => run(() => runMonkeyBonusPicks(tournamentId), 'ניחושי בונוס')} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 ml-1 animate-spin" /> : '🎁'}
            הרץ ניחושי בונוס עכשיו
          </Button>
        </div>
        <MonkeyBetsSection tournamentId={tournamentId} />
      </CardContent>
    </Card>
  )
}

// ── ParticipantsPaymentSection ────────────────────────────────────

interface ParticipantRow {
  userId: string
  displayName: string
  email: string
  paid: boolean
}

function ParticipantsPaymentSection({ tournamentId }: { tournamentId: string }) {
  const [rows, setRows] = useState<ParticipantRow[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('tournament_participants')
      .select('user_id, paid, profiles(display_name, email)')
      .eq('tournament_id', tournamentId)

    if (!data) { setLoading(false); return }
    setRows(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      data.map((r: any) => {
        const profile = Array.isArray(r.profiles) ? r.profiles[0] : r.profiles
        return {
          userId: r.user_id as string,
          displayName: (profile?.display_name ?? r.user_id) as string,
          email: (profile?.email ?? '') as string,
          paid: (r.paid ?? false) as boolean,
        }
      })
    )
    setLoading(false)
  }, [tournamentId])

  useEffect(() => { load() }, [load])

  const toggle = async (userId: string, current: boolean) => {
    setRows(prev => prev.map(r => r.userId === userId ? { ...r, paid: !current } : r))
    await setPaymentStatus(userId, tournamentId, !current)
  }

  const paidCount = rows.filter(r => r.paid).length

  return (
    <Card className="mt-6">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <CreditCard className="h-4 w-4 text-emerald-500" />
            תשלומי משתתפים
          </CardTitle>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="text-emerald-600 font-medium">{paidCount} שילמו</span>
            <span>·</span>
            <span className="text-red-500 font-medium">{rows.length - paidCount} לא שילמו</span>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center gap-2 text-muted-foreground py-4">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-sm">טוען...</span>
          </div>
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">אין משתתפים רשומים</p>
        ) : (
          <div className="space-y-2">
            {rows.map(r => (
              <div key={r.userId} className="flex items-center justify-between px-3 py-2 rounded-lg bg-muted/40 border border-border">
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{r.displayName}</p>
                  <p className="text-xs text-muted-foreground truncate">{r.email}</p>
                </div>
                <button
                  onClick={() => toggle(r.userId, r.paid)}
                  className={cn(
                    'flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border font-medium transition-colors min-w-[72px] justify-center shrink-0',
                    r.paid
                      ? 'bg-emerald-600 text-white border-emerald-600 hover:bg-emerald-700'
                      : 'bg-background text-muted-foreground border-border hover:border-emerald-500 hover:text-emerald-600'
                  )}
                >
                  {r.paid ? <><CheckCircle2 className="h-3.5 w-3.5" />שולם</> : 'שולם?'}
                </button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// ── BracketConfigSection ─────────────────────────────────────────

interface TieInfo {
  key: string
  team1: { id: number; name: string; logo: string }
  team2: { id: number; name: string; logo: string }
}

function buildTieInfos(fixtures: ApiFixture[]): TieInfo[] {
  const map = new Map<string, TieInfo>()
  for (const f of fixtures) {
    const ids = [f.teams.home.id, f.teams.away.id].sort((a, b) => a - b)
    const key = ids.join('-')
    if (!map.has(key)) {
      const team1 = f.teams.home.id === ids[0] ? f.teams.home : f.teams.away
      const team2 = f.teams.home.id === ids[1] ? f.teams.home : f.teams.away
      map.set(key, { key, team1, team2 })
    }
  }
  return Array.from(map.values())
}

const ROUND_ORDER_ADMIN = [
  'Round of 32', 'Round Of 32',
  'Round of 16', 'Round Of 16', '1/8-finals',
  'Quarter-finals', '1/4-finals',
  'Semi-finals', '1/2-finals',
  'Final',
]

const ROUND_LABEL_ADMIN: Record<string, string> = {
  'Round of 32': 'שלב 32', 'Round Of 32': 'שלב 32',
  'Round of 16': 'שמינית גמר', 'Round Of 16': 'שמינית גמר', '1/8-finals': 'שמינית גמר',
  'Quarter-finals': 'רבע גמר', '1/4-finals': 'רבע גמר',
  'Semi-finals': 'חצי גמר', '1/2-finals': 'חצי גמר',
  'Final': 'גמר',
}

function applyOrder(allTies: TieInfo[], savedOrder: string[]): TieInfo[] {
  const tieMap = new Map(allTies.map(t => [t.key, t]))
  const result: TieInfo[] = []
  for (const k of savedOrder) {
    const t = tieMap.get(k)
    if (t) result.push(t)
  }
  for (const t of allTies) {
    if (!savedOrder.includes(t.key)) result.push(t)
  }
  return result
}

function BracketConfigSection({ tournamentId }: { tournamentId: string }) {
  const [loading, setLoading] = useState(true)
  const [roundKeys, setRoundKeys] = useState<string[]>([])
  const [roundTies, setRoundTies] = useState<Record<string, TieInfo[]>>({})
  const [isWC2026, setIsWC2026] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveMsg, setSaveMsg] = useState('')

  useEffect(() => {
    // Fetch knockout fixtures (cached API) + bracket_config (direct Supabase, always fresh)
    Promise.all([
      fetch(`/api/knockout/${tournamentId}`).then(r => r.ok ? r.json() : null).catch(() => null),
      supabase.from('tournaments').select('bracket_config').eq('id', tournamentId).single(),
    ]).then(([knockoutData, { data: configRow }]) => {
      const savedConfig = configRow?.bracket_config as { roundOrders?: Record<string, string[]>; firstRound?: string; tieOrder?: string[]; wc2026?: boolean } | null
      setIsWC2026(savedConfig?.wc2026 ?? false)

      if (!knockoutData?.rounds || Object.keys(knockoutData.rounds).length === 0) {
        setLoading(false)
        return
      }

      const sortedKeys = Object.keys(knockoutData.rounds).sort((a: string, b: string) => {
        const ai = ROUND_ORDER_ADMIN.findIndex(r => r.toLowerCase() === a.toLowerCase())
        const bi = ROUND_ORDER_ADMIN.findIndex(r => r.toLowerCase() === b.toLowerCase())
        return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi)
      })

      // bracket_config from Supabase is always fresh (not cached)
      const savedOrders: Record<string, string[]> =
        savedConfig?.roundOrders ??
        (savedConfig?.firstRound
          ? { [savedConfig.firstRound]: savedConfig.tieOrder ?? [] }
          : {})

      const ties: Record<string, TieInfo[]> = {}
      for (const key of sortedKeys) {
        const allTies = buildTieInfos(knockoutData.rounds[key] as ApiFixture[])
        ties[key] = savedOrders[key] ? applyOrder(allTies, savedOrders[key]) : allTies
      }

      setRoundKeys(sortedKeys)
      setRoundTies(ties)
      setLoading(false)
    })
  }, [tournamentId])

  const move = (roundKey: string, index: number, dir: -1 | 1) => {
    setRoundTies(prev => {
      const arr = [...(prev[roundKey] ?? [])]
      const target = index + dir
      if (target < 0 || target >= arr.length) return prev
      ;[arr[index], arr[target]] = [arr[target], arr[index]]
      return { ...prev, [roundKey]: arr }
    })
  }

  const handleSave = async () => {
    setSaving(true)
    setSaveMsg('')
    const roundOrders: Record<string, string[]> = {}
    for (const key of roundKeys) {
      roundOrders[key] = (roundTies[key] ?? []).map(t => t.key)
    }
    const bracketConfig: Record<string, unknown> = { roundOrders }
    if (isWC2026) bracketConfig.wc2026 = true
    const { error } = await supabase
      .from('tournaments')
      .update({ bracket_config: bracketConfig })
      .eq('id', tournamentId)
    setSaving(false)
    if (error) {
      setSaveMsg(`שגיאה: ${error.message}`)
    } else {
      setSaveMsg('✓ נשמר בהצלחה')
      setTimeout(() => setSaveMsg(''), 3000)
    }
  }

  return (
    <Card className="mt-6">
      <CardHeader>
        <CardTitle className="text-base">הגדרת עץ נוק-אאוט</CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center gap-2 text-muted-foreground py-4">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>טוען...</span>
          </div>
        ) : roundKeys.length === 0 ? (
          <p className="text-muted-foreground text-sm py-4">אין נתוני נוק-אאוט</p>
        ) : (
          <div className="space-y-6">
            {roundKeys.map(roundKey => {
              const ties = roundTies[roundKey] ?? []
              const label = ROUND_LABEL_ADMIN[roundKey] ?? roundKey
              return (
                <div key={roundKey}>
                  <Label className="text-xs text-muted-foreground mb-2 block">{label}</Label>
                  {ties.length <= 1 ? (
                    /* Final or single tie — just display, no reorder */
                    ties.map(tie => (
                      <div key={tie.key} className="flex items-center gap-1.5 p-2 rounded-lg border bg-card text-xs">
                        <Image src={tie.team1.logo} alt={tie.team1.name} width={14} height={14} unoptimized />
                        <span className="font-medium">{translateTeam(tie.team1.name)}</span>
                        <span className="text-muted-foreground mx-1">נגד</span>
                        <Image src={tie.team2.logo} alt={tie.team2.name} width={14} height={14} unoptimized />
                        <span className="font-medium">{translateTeam(tie.team2.name)}</span>
                      </div>
                    ))
                  ) : (
                    <div className="space-y-1.5">
                      {ties.map((tie, i) => (
                        <div key={tie.key} className="flex items-center gap-3 p-2 rounded-lg border bg-card">
                          <span className="text-xs text-muted-foreground w-5 text-center font-bold">{i + 1}</span>
                          <div className="flex items-center gap-1.5 flex-1 min-w-0">
                            <Image src={tie.team1.logo} alt={tie.team1.name} width={14} height={14} unoptimized />
                            <span className="text-xs font-medium truncate">{translateTeam(tie.team1.name)}</span>
                            <span className="text-xs text-muted-foreground mx-0.5 shrink-0">נגד</span>
                            <Image src={tie.team2.logo} alt={tie.team2.name} width={14} height={14} unoptimized />
                            <span className="text-xs font-medium truncate">{translateTeam(tie.team2.name)}</span>
                          </div>
                          <div className="flex gap-1 shrink-0">
                            <Button variant="outline" size="sm" className="h-6 w-6 p-0"
                              onClick={() => move(roundKey, i, -1)} disabled={i === 0}>↑</Button>
                            <Button variant="outline" size="sm" className="h-6 w-6 p-0"
                              onClick={() => move(roundKey, i, 1)} disabled={i === ties.length - 1}>↓</Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={isWC2026}
                onChange={e => setIsWC2026(e.target.checked)}
                className="h-4 w-4 rounded border-border accent-primary"
              />
              <span className="text-sm text-muted-foreground">תצוגת עץ גביע העולם 2026 (32 קבוצות)</span>
            </label>

            <div className="flex items-center gap-3">
              <Button onClick={handleSave} disabled={saving} size="sm">
                {saving
                  ? <Loader2 className="h-4 w-4 ml-1 animate-spin" />
                  : <Save className="h-4 w-4 ml-1" />}
                שמור סדר
              </Button>
              {saveMsg && (
                <span className={`text-sm ${saveMsg.startsWith('✓') ? 'text-green-600' : 'text-red-600'}`}>
                  {saveMsg}
                </span>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// ── Advancement bonus section (+5 per team that advanced a round) ─
function AdvancementBonusSection({ tournamentId }: { tournamentId: string }) {
  const [teams,      setTeams]      = useState<string[]>([])
  const [selected,   setSelected]   = useState<Set<string>>(new Set())
  const [loading,    setLoading]    = useState(true)
  const [awarding,   setAwarding]   = useState(false)
  const [msg,        setMsg]        = useState('')

  useEffect(() => {
    getTeamPickTeams(tournamentId).then(t => { setTeams(t); setLoading(false) })
  }, [tournamentId])

  const toggleTeam = (team: string) => {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(team) ? next.delete(team) : next.add(team)
      return next
    })
  }

  const handleAward = async () => {
    if (!selected.size) return
    setAwarding(true)
    setMsg('')
    const res = await awardAdvancementBonus(tournamentId, Array.from(selected))
    setAwarding(false)
    if (res.ok) {
      setMsg(`✓ הוענקו 5 נק' ל-${res.awarded} בחירות`)
      setSelected(new Set())
    } else {
      setMsg(`שגיאה: ${res.error}`)
    }
    setTimeout(() => setMsg(''), 4000)
  }

  return (
    <Card className="mt-6">
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <ArrowUp className="h-4 w-4 text-emerald-500" />
            עליה לשלב הבא — +5 נק' לכל מי שבחר
          </CardTitle>
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          סמן את הנבחרות שעלו לשלב הבא ולחץ &quot;הענק 5 נק'&quot;. ניתן להפעיל מספר פעמים לפי שלב.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {msg && (
          <p className={`text-sm px-3 py-2 rounded-lg ${msg.startsWith('✓') ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700'}`}>
            {msg}
          </p>
        )}

        {loading ? (
          <div className="flex items-center gap-2 text-muted-foreground py-4">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-sm">טוען נבחרות...</span>
          </div>
        ) : teams.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            אין עדיין בחירות נבחרת מדורגת בטורניר הזה
          </p>
        ) : (
          <>
            <div className="flex flex-wrap gap-2">
              {teams.map(team => {
                const checked = selected.has(team)
                return (
                  <label key={team}
                    className={cn(
                      'flex items-center gap-2 cursor-pointer rounded-xl border px-3 py-2 text-sm transition-colors select-none',
                      checked
                        ? 'border-emerald-500 bg-emerald-50 text-emerald-800 font-medium'
                        : 'border-border bg-background text-foreground hover:border-emerald-300'
                    )}>
                    <input
                      type="checkbox"
                      className="accent-emerald-500 h-3.5 w-3.5"
                      checked={checked}
                      onChange={() => toggleTeam(team)}
                    />
                    {team}
                  </label>
                )
              })}
            </div>

            <div className="flex items-center gap-3 pt-1">
              <Button
                size="sm"
                onClick={handleAward}
                disabled={awarding || !selected.size}
                className="bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                {awarding
                  ? <Loader2 className="h-4 w-4 ml-1 animate-spin" />
                  : <ArrowUp className="h-4 w-4 ml-1" />}
                הענק 5 נק' ({selected.size} נבחרות)
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}

export default function AdminTournamentDetailPage() {
  const params = useParams()
  const id = params.id as string
  const { tournaments, addMatch, reload, reloadMatches, participants } = useTournament()
  const tournament = tournaments.find((t) => t.id === id)

  const [scores, setScores] = useState<Record<string, { home: string; away: string }>>({})
  const [saved, setSaved] = useState<string[]>([])
  const [syncing, setSyncing] = useState(false)
  const [syncingOdds, setSyncingOdds] = useState(false)
  const [rescoring, setRescoring] = useState(false)
  const [syncMsg, setSyncMsg] = useState('')
  const [hideFinished, setHideFinished] = useState(false)
  const [addOpen, setAddOpen] = useState(false)
  const [newMatch, setNewMatch] = useState({
    homeName: '',
    homeFlag: '',
    awayName: '',
    awayFlag: '',
    kickoff: '',
  })

  // ── Bonus questions state ──────────────────────────────────────
  const [bonusQuestions, setBonusQuestions] = useState<BonusQuestion[]>([])
  const [bonusMsg, setBonusMsg] = useState('')
  const [bonusResultPicks, setBonusResultPicks] = useState<Record<string, string[]>>({})
  const [syncingLocks, setSyncingLocks] = useState(false)
  const [syncLockInfo, setSyncLockInfo] = useState('')
  const [addBonusOpen, setAddBonusOpen] = useState(false)
  const [newBonus, setNewBonus] = useState({
    type: 'custom' as BonusQuestion['type'],
    question: '',
    optionsRaw: '',   // comma-separated
    points: '10',
    lockTime: '',     // datetime-local — ריק = אוטומטי
  })
  const [editBonusOpen, setEditBonusOpen] = useState(false)
  const [editingBonus, setEditingBonus] = useState<BonusQuestion | null>(null)
  const [editBonus, setEditBonus] = useState({
    type: 'custom' as BonusQuestion['type'],
    question: '',
    optionsRaw: '',
    points: '10',
    lockTime: '',   // datetime-local value (זמן מקומי)
  })
  const [editBonusError, setEditBonusError] = useState('')

  const loadBonusQuestions = useCallback(async () => {
    const qs = await getBonusQuestions(id)
    setBonusQuestions(qs)
  }, [id])

  useEffect(() => { loadBonusQuestions() }, [loadBonusQuestions])

  const handleSyncLockTimes = async () => {
    setSyncingLocks(true)
    setSyncLockInfo('')
    const res = await syncAllBonusLockTimes(id)
    setSyncingLocks(false)
    if (res.ok) {
      const lockISO = res.lockTime!
      const lockIsrael = new Date(lockISO).toLocaleString('he-IL', { timeZone: 'Asia/Jerusalem', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
      setSyncLockInfo(`✓ נועל: ${lockIsrael} | משחק: ${res.firstMatch}`)
      loadBonusQuestions()
    } else {
      setSyncLockInfo(`שגיאה: ${res.error}`)
    }
    setTimeout(() => setSyncLockInfo(''), 8000)
  }

  const handleAddBonus = async (e: React.FormEvent) => {
    e.preventDefault()
    const options = newBonus.optionsRaw.split(',').map(s => s.trim()).filter(Boolean)
    if (!newBonus.question || options.length < 2) return
    const res = await createBonusQuestion({
      tournamentId: id,
      type: newBonus.type,
      question: newBonus.question,
      options,
      points: parseInt(newBonus.points) || 10,
      lockTime: newBonus.lockTime ? localInputToIso(newBonus.lockTime) : undefined,
    })
    if (res.ok) {
      setAddBonusOpen(false)
      setNewBonus({ type: 'custom', question: '', optionsRaw: '', points: '10', lockTime: '' })
      loadBonusQuestions()
    } else {
      setBonusMsg(res.error ?? 'שגיאה')
    }
  }

  const openEditBonus = (q: BonusQuestion) => {
    setEditingBonus(q)
    setEditBonus({
      type: q.type,
      question: q.question,
      optionsRaw: q.options.join(', '),
      points: String(q.points),
      lockTime: q.lockTime ? isoToLocalInput(q.lockTime) : '',
    })
    setEditBonusOpen(true)
  }

  const handleEditBonus = async (e: React.FormEvent) => {
    e.preventDefault()
    setEditBonusError('')
    if (!editingBonus) return
    const options = editBonus.optionsRaw.split(',').map(s => s.trim()).filter(Boolean)
    if (!editBonus.question) { setEditBonusError('חסרה כותרת שאלה'); return }
    if (options.length < 2) { setEditBonusError('נדרשות לפחות 2 אפשרויות'); return }
    try {
      const res = await updateBonusQuestion(editingBonus.id, {
        type: editBonus.type,
        question: editBonus.question,
        options,
        points: parseInt(editBonus.points) || 10,
        lockTime: editBonus.lockTime ? localInputToIso(editBonus.lockTime) : undefined,
      })
      if (res.ok) {
        setEditBonusOpen(false)
        setEditingBonus(null)
        setEditBonusError('')
        loadBonusQuestions()
      } else {
        setEditBonusError(res.error ?? 'שגיאה בשמירה')
      }
    } catch (err) {
      setEditBonusError(err instanceof Error ? err.message : 'שגיאה בלתי צפויה')
    }
  }

  const handleDeleteBonus = async (qId: string) => {
    await deleteBonusQuestion(qId)
    loadBonusQuestions()
  }

  // ── Tournament admins state ────────────────────────────────────
  const [tournamentAdmins, setTournamentAdmins] = useState<{ userId: string; displayName: string; email: string }[]>([])
  const [assignEmail, setAssignEmail] = useState('')
  const [adminMsg, setAdminMsg] = useState('')

  const loadTournamentAdmins = useCallback(async () => {
    const list = await getTournamentAdmins(id)
    setTournamentAdmins(list)
  }, [id])

  useEffect(() => { loadTournamentAdmins() }, [loadTournamentAdmins])

  const handleAssignAdmin = async (e: React.FormEvent) => {
    e.preventDefault()
    // Find user by email from participants (or all profiles via supabase)
    const { supabase: sb } = await import('@/lib/supabase')
    const { data: profile } = await sb.from('profiles').select('id, display_name, role').eq('email', assignEmail.trim()).single()
    if (!profile) { setAdminMsg('משתמש לא נמצא'); return }
    if ((profile.role as UserRole) === 'admin') { setAdminMsg('מנהל כבר בעל גישה מלאה'); return }
    const res = await assignTournamentAdmin(id, profile.id)
    if (res.ok) {
      setAssignEmail('')
      loadTournamentAdmins()
      setAdminMsg(`✓ ${profile.display_name} הוגדר כמנהל הטורניר`)
    } else {
      setAdminMsg(res.error ?? 'שגיאה')
    }
    setTimeout(() => setAdminMsg(''), 3000)
  }

  const handleRemoveAdmin = async (userId: string) => {
    await removeTournamentAdmin(id, userId)
    loadTournamentAdmins()
  }

  const handleSetBonusResult = async (qId: string) => {
    const corrects = bonusResultPicks[qId] ?? []
    if (!corrects.length) return
    const res = await setBonusResult(qId, corrects)
    if (res.ok) {
      setBonusMsg(`✓ ${res.awarded} משתתפים קיבלו נקודות`)
      loadBonusQuestions()
    } else {
      setBonusMsg(res.error ?? 'שגיאה')
    }
    setTimeout(() => setBonusMsg(''), 3000)
  }

  const toggleBonusResultPick = (qId: string, opt: string) => {
    setBonusResultPicks(prev => {
      const current = prev[qId] ?? []
      return {
        ...prev,
        [qId]: current.includes(opt)
          ? current.filter(o => o !== opt)
          : [...current, opt],
      }
    })
  }

  // ── טעינת משחקים אמיתיים תמיד בכניסה לדף ─────────────────────
  const [matchesLoaded, setMatchesLoaded] = useState(false)

  useEffect(() => {
    if (!id) return
    reloadMatches(id, { all: true, includeHidden: true }).then(() => setMatchesLoaded(true))
  }, [id]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!tournament) return <div className="p-6 text-muted-foreground">התחרות לא נמצאה.</div>

  // stubs = matches ממתינות לטעינה אמיתית
  const realMatches = tournament.matches.filter((m) => !!m.homeTeam)
  const isLoadingMatches = !matchesLoaded || (tournament.matches.length > 0 && realMatches.length === 0)
  const visibleMatches = hideFinished ? realMatches.filter((m) => m.status !== 'finished') : realMatches
  const finishedCount = realMatches.filter((m) => m.status === 'finished').length

  // ── קיבוץ לפי שלב (round) לטובת הסתרה קבוצתית ────────────────────
  const roundGroups: { round: string; label: string; matches: Match[] }[] = []
  const roundIndex = new Map<string, number>()
  for (const m of visibleMatches) {
    const round = m.round ?? '—'
    let idx = roundIndex.get(round)
    if (idx === undefined) {
      idx = roundGroups.length
      roundIndex.set(round, idx)
      roundGroups.push({ round, label: round === '—' ? 'ללא שלב' : translateRound(round), matches: [] })
    }
    roundGroups[idx].matches.push(m)
  }

  // ── Sync from API-Football ─────────────────────────────────────
  const handleSync = async () => {
    const { data: row } = await supabase
      .from('tournaments')
      .select('api_league_id, api_season')
      .eq('id', id)
      .single()

    if (!row?.api_league_id || !row?.api_season) {
      setSyncMsg('לא הוגדר League ID או עונה לתחרות הזו')
      return
    }
    setSyncing(true)
    setSyncMsg('')
    const result = await syncFixtures(id, row.api_league_id, row.api_season)
    setSyncing(false)
    if (result.error) {
      setSyncMsg(`שגיאה: ${result.error}`)
    } else {
      setSyncMsg(`✓ סונכרנו ${result.synced} משחקים מ-API-Football`)
      await reloadMatches(id, { all: true, includeHidden: true })
    }
  }

  // ── Rescore all finished matches ──────────────────────────────
  const handleRescore = async () => {
    setRescoring(true)
    setSyncMsg('')
    const result = await rescoreTournamentBets(id)
    setRescoring(false)
    if (result.ok) {
      setSyncMsg(`✓ חושב ניקוד ל-${result.scored} משחקים`)
    } else {
      setSyncMsg(`שגיאה: ${result.error}`)
    }
  }

  // ── Sync Odds ─────────────────────────────────────────────────
  const handleSyncOdds = async () => {
    setSyncingOdds(true)
    setSyncMsg('')
    const result = await syncOdds(id)
    setSyncingOdds(false)
    if (result.error) {
      setSyncMsg(`שגיאה: ${result.error}`)
    } else {
      setSyncMsg(`✓ עודכנו יחסי הימורים ל-${result.synced} משחקים`)
      await reloadMatches(id, { all: true, includeHidden: true })
    }
  }

  // ── Refresh single match result ────────────────────────────────
  const handleRefreshMatch = async (match: Match) => {
    if (!match.apiFixtureId) return
    const result = await refreshMatchResult(match.apiFixtureId)
    if (result.error) alert(`שגיאה: ${result.error}`)
    reloadMatches(id, { all: true, includeHidden: true })
  }

  // ── Manual score save ──────────────────────────────────────────
  const handleSaveScore = async (matchId: string) => {
    const s = scores[matchId]
    if (!s) return
    const home = parseInt(s.home)
    const away = parseInt(s.away)
    if (isNaN(home) || isNaN(away)) return
    await setMatchScore(matchId, home, away)
    setSaved((prev) => [...prev, matchId])
    setTimeout(() => setSaved((prev) => prev.filter((x) => x !== matchId)), 2000)
    reloadMatches(id, { all: true, includeHidden: true })
  }

  // ── הסתרה/הצגה של משחק בודד ─────────────────────────────────────
  const handleToggleMatchHidden = async (match: Match) => {
    const next = !match.hidden
    const res = await setMatchHidden(match.id, id, next)
    if (!res.ok) { setSyncMsg(`שגיאה: ${res.error}`); return }
    await reloadMatches(id, { all: true, includeHidden: true })
  }

  // ── הסתרה/הצגה של שלב שלם (round) ───────────────────────────────
  const handleToggleRoundHidden = async (round: string, hidden: boolean) => {
    const res = await setRoundHidden(id, round, hidden)
    if (!res.ok) { setSyncMsg(`שגיאה: ${res.error}`); return }
    setSyncMsg(`✓ ${hidden ? 'הוסתרו' : 'הוצגו'} ${res.updated ?? 0} משחקים בשלב`)
    setTimeout(() => setSyncMsg(''), 3000)
    await reloadMatches(id, { all: true, includeHidden: true })
  }

  // ── Add match manually ─────────────────────────────────────────
  const handleAddMatch = async (e: React.FormEvent) => {
    e.preventDefault()
    await addMatch(id, {
      homeTeam: {
        id: `team-${Date.now()}`,
        name: newMatch.homeName,
        shortCode: newMatch.homeName.slice(0, 3).toUpperCase(),
        flagUrl: newMatch.homeFlag,
      },
      awayTeam: {
        id: `team-${Date.now() + 1}`,
        name: newMatch.awayName,
        shortCode: newMatch.awayName.slice(0, 3).toUpperCase(),
        flagUrl: newMatch.awayFlag,
      },
      matchStartTime: new Date(newMatch.kickoff).toISOString(),
      status: 'scheduled',
      actualScore: null,
    })
    setAddOpen(false)
    setNewMatch({ homeName: '', homeFlag: '', awayName: '', awayFlag: '', kickoff: '' })
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="font-suez text-2xl">{tournament.name}</h1>
          <p className="text-muted-foreground text-sm">{tournament.description}</p>
        </div>
        <Link href={`/admin/tournaments/${id}/summary`}>
          <Button variant="outline" size="sm" className="flex items-center gap-1.5">
            <BarChart2 className="h-4 w-4" />
            סיכום
          </Button>
        </Link>
        <div className="flex items-center gap-2">
          {/* כפתור הסתרת משחקים שהסתיימו */}
          {finishedCount > 0 && (
            <Button
              variant={hideFinished ? 'default' : 'outline'}
              size="sm"
              onClick={() => setHideFinished((v) => !v)}
              title={hideFinished ? 'הצג משחקים שהסתיימו' : 'הסתר משחקים שהסתיימו'}
            >
              {hideFinished
                ? <><Eye className="h-4 w-4 ml-1" />הצג הכל ({finishedCount})</>
                : <><EyeOff className="h-4 w-4 ml-1" />הסתר שהסתיימו ({finishedCount})</>}
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={handleRescore} disabled={rescoring} title="חשב מחדש נקודות לכל המשחקים שנגמרו בטורניר">
            {rescoring
              ? <Loader2 className="h-4 w-4 ml-1 animate-spin" />
              : <RotateCcw className="h-4 w-4 ml-1" />}
            חשב נקודות
          </Button>
          <Button variant="outline" size="sm" onClick={handleSyncOdds} disabled={syncingOdds}>
            {syncingOdds
              ? <Loader2 className="h-4 w-4 ml-1 animate-spin" />
              : <RefreshCw className="h-4 w-4 ml-1" />}
            סנכרן Odds
          </Button>
          <Button variant="outline" size="sm" onClick={handleSync} disabled={syncing}>
            {syncing
              ? <Loader2 className="h-4 w-4 ml-1 animate-spin" />
              : <RefreshCw className="h-4 w-4 ml-1" />}
            סנכרן מ-API
          </Button>
          <Dialog open={addOpen} onOpenChange={setAddOpen}>
            <DialogTrigger asChild>
              <Button size="sm"><Plus className="h-4 w-4 ml-1" />הוסף ידנית</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>הוספת משחק</DialogTitle></DialogHeader>
              <form onSubmit={handleAddMatch} className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>קבוצה ביתית</Label>
                    <Input required value={newMatch.homeName}
                      onChange={(e) => setNewMatch((p) => ({ ...p, homeName: e.target.value }))} />
                  </div>
                  <div>
                    <Label>לוגו קבוצה ביתית</Label>
                    <Input placeholder="https://..." value={newMatch.homeFlag}
                      onChange={(e) => setNewMatch((p) => ({ ...p, homeFlag: e.target.value }))} />
                  </div>
                  <div>
                    <Label>קבוצה אורחת</Label>
                    <Input required value={newMatch.awayName}
                      onChange={(e) => setNewMatch((p) => ({ ...p, awayName: e.target.value }))} />
                  </div>
                  <div>
                    <Label>לוגו קבוצה אורחת</Label>
                    <Input placeholder="https://..." value={newMatch.awayFlag}
                      onChange={(e) => setNewMatch((p) => ({ ...p, awayFlag: e.target.value }))} />
                  </div>
                </div>
                <div>
                  <Label>תאריך ושעת קיקוף</Label>
                  <Input type="datetime-local" required value={newMatch.kickoff}
                    onChange={(e) => setNewMatch((p) => ({ ...p, kickoff: e.target.value }))} />
                </div>
                <Button type="submit" className="w-full">הוסף משחק</Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {syncMsg && (
        <div className={`mb-4 p-3 rounded-lg text-sm ${syncMsg.startsWith('✓') ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
          {syncMsg}
        </div>
      )}

      {/* ── ספינר טעינה ── */}
      {isLoadingMatches && (
        <div className="flex items-center justify-center py-16 gap-3 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
          <span>טוען משחקים...</span>
        </div>
      )}

      <div className="space-y-6 stagger">
        {!isLoadingMatches && roundGroups.map((group) => {
          const allHidden = group.matches.every((m) => m.hidden)
          const hiddenCount = group.matches.filter((m) => m.hidden).length
          return (
            <div key={group.round} className="space-y-3">
              {/* ── כותרת שלב + הסתרה קבוצתית ── */}
              <div className="flex items-center justify-between gap-2 sticky top-0 bg-background/80 backdrop-blur py-1 z-10">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-semibold text-foreground">{group.label}</h3>
                  {hiddenCount > 0 && (
                    <Badge variant="outline" className="text-amber-600 border-amber-300 text-xs">
                      {hiddenCount} מוסתרים
                    </Badge>
                  )}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleToggleRoundHidden(group.round, !allHidden)}
                  title={allHidden ? 'הצג את כל המשחקים בשלב' : 'הסתר את כל המשחקים בשלב'}
                >
                  {allHidden
                    ? <><Eye className="h-4 w-4 ml-1" />הצג שלב</>
                    : <><EyeOff className="h-4 w-4 ml-1" />הסתר שלב</>}
                </Button>
              </div>

              {group.matches.map((match: Match) => (
                <div key={match.id} className="animate-fade-up">
                  <Card className={cn(match.hidden && 'opacity-60 border-dashed')}>
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                          {new Date(match.matchStartTime).toLocaleDateString('he-IL', {
                            weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
                          })}
                          {match.hidden && (
                            <Badge variant="outline" className="text-amber-600 border-amber-300 text-xs">מוסתר</Badge>
                          )}
                        </CardTitle>
                        <div className="flex items-center gap-2">
                          {match.actualScore !== null && (
                            <Badge variant="outline" className="text-green-700 border-green-300">
                              תוצאה: {match.actualScore.home}–{match.actualScore.away}
                            </Badge>
                          )}
                          <button
                            onClick={() => handleToggleMatchHidden(match)}
                            className="p-1 rounded hover:bg-muted transition-colors"
                            title={match.hidden ? 'הצג משחק למשתתפים' : 'הסתר משחק מהמשתתפים'}
                          >
                            {match.hidden
                              ? <EyeOff className="h-3.5 w-3.5 text-amber-600" />
                              : <Eye className="h-3.5 w-3.5 text-muted-foreground" />}
                          </button>
                          <button
                            onClick={() => handleRefreshMatch(match)}
                            className="p-1 rounded hover:bg-muted transition-colors"
                            title="רענן תוצאה מ-API"
                          >
                            <RotateCcw className="h-3.5 w-3.5 text-muted-foreground" />
                          </button>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center gap-4 mb-4">
                        <div className="flex items-center gap-2">
                          <TeamFlag team={match.homeTeam} size="sm" />
                          <span className="font-semibold">{match.homeTeam.name}</span>
                        </div>
                        <span className="text-muted-foreground font-bold">נגד</span>
                        <div className="flex items-center gap-2">
                          <TeamFlag team={match.awayTeam} size="sm" />
                          <span className="font-semibold">{match.awayTeam.name}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <Label className="text-xs shrink-0">קביעת תוצאה:</Label>
                        <Input
                          type="number" min={0} max={20} placeholder="בית" className="w-20"
                          value={scores[match.id]?.home ?? ''}
                          onChange={(e) => setScores((p) => ({ ...p, [match.id]: { home: e.target.value, away: p[match.id]?.away ?? '' } }))}
                        />
                        <span className="font-bold">–</span>
                        <Input
                          type="number" min={0} max={20} placeholder="אורח" className="w-20"
                          value={scores[match.id]?.away ?? ''}
                          onChange={(e) => setScores((p) => ({ ...p, [match.id]: { home: p[match.id]?.home ?? '', away: e.target.value } }))}
                        />
                        <Button
                          size="sm"
                          onClick={() => handleSaveScore(match.id)}
                          disabled={!scores[match.id]?.home && !scores[match.id]?.away}
                        >
                          {saved.includes(match.id)
                            ? <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                            : <Save className="h-4 w-4" />}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              ))}
            </div>
          )
        })}

        {!isLoadingMatches && visibleMatches.length === 0 && realMatches.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            <p className="mb-2">אין משחקים עדיין.</p>
            <p className="text-sm">לחץ <strong>סנכרן מ-API</strong> כדי לייבא משחקים אמיתיים,<br />או הוסף משחק ידנית.</p>
          </div>
        )}
      </div>

      <BracketConfigSection tournamentId={id} />

      {/* ── עליה לשלב הבא — +5 נק' ───────────────────────────────── */}
      <AdvancementBonusSection tournamentId={id} />

      {/* ── מנהלי טורניר ─────────────────────────────────────────── */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Shield className="h-4 w-4 text-blue-600" />
            מנהלי טורניר
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {adminMsg && (
            <p className={`text-sm px-3 py-2 rounded-lg ${adminMsg.startsWith('✓') ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
              {adminMsg}
            </p>
          )}
          {/* Assigned admins */}
          {tournamentAdmins.length > 0 && (
            <div className="space-y-2">
              {tournamentAdmins.map(ta => (
                <div key={ta.userId} className="flex items-center justify-between px-3 py-2 rounded-lg bg-muted/60 border border-border">
                  <div>
                    <p className="text-sm font-medium text-foreground">{ta.displayName}</p>
                    <p className="text-xs text-muted-foreground">{ta.email}</p>
                  </div>
                  <button onClick={() => handleRemoveAdmin(ta.userId)}
                    className="p-1.5 rounded-lg text-muted-foreground hover:text-red-600 hover:bg-red-50 transition-colors">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
          {/* Assign new admin by email */}
          <form onSubmit={handleAssignAdmin} className="flex gap-2">
            <Input
              placeholder="אימייל של משתמש..."
              value={assignEmail}
              onChange={e => setAssignEmail(e.target.value)}
              className="flex-1"
            />
            <Button type="submit" size="sm" disabled={!assignEmail.trim()}>
              <Plus className="h-4 w-4 ml-1" />הגדר
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* ── הימורי בונוס ──────────────────────────────────────────── */}
      <Card className="mt-6">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              <Gift className="h-4 w-4 text-emerald-500" />
              הימורי בונוס
            </CardTitle>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" onClick={handleSyncLockTimes} disabled={syncingLocks} title="חשב מחדש זמן נעילה לכל הבונוסים (60 דק' לפני המשחק הראשון)">
                {syncingLocks ? <Loader2 className="h-4 w-4 ml-1 animate-spin" /> : <Clock className="h-4 w-4 ml-1" />}
                סנכרן נעילות
              </Button>
              <Dialog open={addBonusOpen} onOpenChange={setAddBonusOpen}>
              <DialogTrigger asChild>
                <Button size="sm" variant="outline"><Plus className="h-4 w-4 ml-1" />הוסף שאלה</Button>
              </DialogTrigger>
              <DialogContent dir="rtl">
                <DialogHeader>
                  <DialogTitle>הוספת הימור בונוס</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleAddBonus} className="space-y-4 mt-2">
                  <div>
                    <Label>סוג</Label>
                    <select
                      className="w-full mt-1 border border-border rounded-md px-3 py-2 text-sm bg-background text-foreground"
                      value={newBonus.type}
                      onChange={e => setNewBonus(p => ({ ...p, type: e.target.value as BonusQuestion['type'] }))}
                    >
                      <option value="winner">מנצחת הטורניר</option>
                      <option value="top_scorer">מלך השערים</option>
                      <option value="custom">מותאם אישית</option>
                      <option value="team_pick">בחירת נבחרת (מדורגת)</option>
                    </select>
                  </div>
                  <div>
                    <Label>שאלה</Label>
                    <Input className="mt-1" placeholder='למשל: "מי תנצח בטורניר?"'
                      value={newBonus.question}
                      onChange={e => setNewBonus(p => ({ ...p, question: e.target.value }))} />
                  </div>
                  <div>
                    <Label>אפשרויות (מופרדות בפסיק)</Label>
                    <Input className="mt-1" placeholder="ישראל, גרמניה, צרפת, ..."
                      value={newBonus.optionsRaw}
                      onChange={e => setNewBonus(p => ({ ...p, optionsRaw: e.target.value }))} />
                  </div>
                  <div>
                    <Label>נקודות לניצחון</Label>
                    <Input className="mt-1 w-24" type="number" min={1} max={100}
                      value={newBonus.points}
                      onChange={e => setNewBonus(p => ({ ...p, points: e.target.value }))} />
                  </div>
                  <div>
                    <Label>זמן נעילה</Label>
                    <Input className="mt-1" type="datetime-local"
                      value={newBonus.lockTime}
                      onChange={e => setNewBonus(p => ({ ...p, lockTime: e.target.value }))} />
                    <p className="text-xs text-muted-foreground mt-1">
                      השאר ריק לחישוב אוטומטי (60 דק&apos; לפני המשחק הראשון).
                    </p>
                  </div>
                  <Button type="submit" className="w-full">הוסף</Button>
                </form>
              </DialogContent>
            </Dialog>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {syncLockInfo && (
            <p className={`text-sm px-3 py-2 rounded-lg ${syncLockInfo.startsWith('✓') ? 'bg-blue-50 text-blue-700 border border-blue-200' : 'bg-red-50 text-red-700'}`}>
              {syncLockInfo}
            </p>
          )}
          {bonusMsg && (
            <p className={`text-sm px-3 py-2 rounded-lg ${bonusMsg.startsWith('✓') ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
              {bonusMsg}
            </p>
          )}
          {bonusQuestions.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">אין הימורי בונוס עדיין</p>
          )}
          {bonusQuestions.map(q => (
            <div key={q.id} className="border rounded-lg p-3 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm">{q.question}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {q.points} נק' | נועל: {new Date(q.lockTime).toLocaleString('he-IL')}
                  </p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button onClick={() => openEditBonus(q)}
                    className="p-1.5 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
                    title="ערוך שאלה">
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button onClick={() => handleDeleteBonus(q.id)}
                    className="p-1.5 rounded-lg text-muted-foreground hover:text-red-500 hover:bg-red-50 transition-colors"
                    title="מחק שאלה">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {q.options.map(opt => {
                  const isCorrect = q.correctOptions?.includes(opt)
                  return (
                    <Badge key={opt} variant={isCorrect ? 'default' : 'outline'}
                      className={isCorrect ? 'bg-primary text-primary-foreground' : ''}>
                      {opt}
                    </Badge>
                  )
                })}
              </div>
              {!q.correctOptions && (
                <div className="pt-1 space-y-2">
                  <p className="text-xs text-muted-foreground font-medium">סמן תשובה/ות נכונות:</p>
                  <div className="flex flex-wrap gap-2">
                    {q.options.map(opt => {
                      const checked = (bonusResultPicks[q.id] ?? []).includes(opt)
                      return (
                        <label key={opt}
                          className={`flex items-center gap-1.5 cursor-pointer rounded-lg border px-3 py-1.5 text-sm transition-colors select-none
                            ${checked
                              ? 'border-primary bg-primary/10 text-primary font-medium'
                              : 'border-border bg-background text-foreground hover:border-primary/40'}`}>
                          <input
                            type="checkbox"
                            className="accent-primary h-3.5 w-3.5"
                            checked={checked}
                            onChange={() => toggleBonusResultPick(q.id, opt)}
                          />
                          {opt}
                        </label>
                      )
                    })}
                  </div>
                  <Button size="sm" disabled={!(bonusResultPicks[q.id]?.length)} onClick={() => handleSetBonusResult(q.id)}>
                    <CheckCircle2 className="h-4 w-4 ml-1" />אשר תוצאה
                  </Button>
                </div>
              )}
              {q.correctOptions && (
                <p className="text-xs text-emerald-600 font-medium">
                  ✓ תוצאה סופית: {q.correctOptions.join(' / ')}
                </p>
              )}
            </div>
          ))}
        </CardContent>
      </Card>

      {/* ── קוף 🐒 — מתחרה AI ────────────────────────────────────── */}
      <MonkeySection tournamentId={id} />

      {/* ── תשלומי משתתפים ───────────────────────────────────────── */}
      <ParticipantsPaymentSection tournamentId={id} />

      {/* ── דיאלוג עריכת בונוס ────────────────────────────────────── */}
      <Dialog open={editBonusOpen} onOpenChange={setEditBonusOpen}>
        <DialogContent dir="rtl">
          <DialogHeader>
            <DialogTitle>עריכת הימור בונוס</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleEditBonus} className="space-y-4 mt-2">
            <div>
              <Label>סוג</Label>
              <select
                className="w-full mt-1 border border-border rounded-md px-3 py-2 text-sm bg-background text-foreground"
                value={editBonus.type}
                onChange={e => setEditBonus(p => ({ ...p, type: e.target.value as BonusQuestion['type'] }))}
              >
                <option value="winner">מנצחת הטורניר</option>
                <option value="top_scorer">מלך השערים</option>
                <option value="custom">מותאם אישית</option>
                <option value="team_pick">בחירת נבחרת (מדורגת)</option>
              </select>
            </div>
            <div>
              <Label>שאלה</Label>
              <Input className="mt-1"
                value={editBonus.question}
                onChange={e => setEditBonus(p => ({ ...p, question: e.target.value }))} />
            </div>
            <div>
              <Label>אפשרויות (מופרדות בפסיק)</Label>
              <Input className="mt-1"
                value={editBonus.optionsRaw}
                onChange={e => setEditBonus(p => ({ ...p, optionsRaw: e.target.value }))} />
            </div>
            <div>
              <Label>נקודות לניצחון</Label>
              <Input className="mt-1 w-24" type="number" min={1} max={100}
                value={editBonus.points}
                onChange={e => setEditBonus(p => ({ ...p, points: e.target.value }))} />
            </div>
            <div>
              <Label>זמן נעילה</Label>
              <Input className="mt-1" type="datetime-local"
                value={editBonus.lockTime}
                onChange={e => setEditBonus(p => ({ ...p, lockTime: e.target.value }))} />
              <p className="text-xs text-muted-foreground mt-1">
                ניתן לערוך ידנית. ברירת המחדל היא 60 דקות לפני המשחק הראשון. כפתור &quot;סנכרן נעילות&quot; ידרוס ערך ידני.
              </p>
            </div>
            {editBonusError && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                {editBonusError}
              </p>
            )}
            <div className="flex gap-2">
              <Button type="submit" className="flex-1">
                <Save className="h-4 w-4 ml-1" />שמור שינויים
              </Button>
              <Button type="button" variant="outline" onClick={() => { setEditBonusOpen(false); setEditBonusError('') }}>
                ביטול
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
