'use client'
import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { Plus, Save, CheckCircle2, RefreshCw, Loader2, RotateCcw, EyeOff, Eye } from 'lucide-react'
import Image from 'next/image'
import { useTournament } from '@/context/TournamentContext'
import { syncFixtures, syncOdds, setMatchScore, refreshMatchResult } from '@/app/actions/fixtures'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { TeamFlag } from '@/components/shared/TeamFlag'
import { Match } from '@/types'
import { ApiFixture } from '@/lib/api-football'
import { translateTeam } from '@/lib/teams-he'

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
                className="h-4 w-4 rounded border-slate-600 accent-emerald-500"
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

export default function AdminTournamentDetailPage() {
  const params = useParams()
  const id = params.id as string
  const { tournaments, addMatch, reload, reloadMatches } = useTournament()
  const tournament = tournaments.find((t) => t.id === id)

  const [scores, setScores] = useState<Record<string, { home: string; away: string }>>({})
  const [saved, setSaved] = useState<string[]>([])
  const [syncing, setSyncing] = useState(false)
  const [syncingOdds, setSyncingOdds] = useState(false)
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

  // ── טעינת משחקים אמיתיים תמיד בכניסה לדף ─────────────────────
  const [matchesLoaded, setMatchesLoaded] = useState(false)

  useEffect(() => {
    if (!id) return
    reloadMatches(id, { all: true }).then(() => setMatchesLoaded(true))
  }, [id]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!tournament) return <div className="p-6 text-muted-foreground">התחרות לא נמצאה.</div>

  // stubs = matches ממתינות לטעינה אמיתית
  const realMatches = tournament.matches.filter((m) => !!m.homeTeam)
  const isLoadingMatches = !matchesLoaded || (tournament.matches.length > 0 && realMatches.length === 0)
  const visibleMatches = hideFinished ? realMatches.filter((m) => m.status !== 'finished') : realMatches
  const finishedCount = realMatches.filter((m) => m.status === 'finished').length

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
      await reloadMatches(id, { all: true })
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
      await reloadMatches(id, { all: true })
    }
  }

  // ── Refresh single match result ────────────────────────────────
  const handleRefreshMatch = async (match: Match) => {
    const { data } = await supabase
      .from('matches')
      .select('api_fixture_id')
      .eq('id', match.id)
      .single()
    if (!data?.api_fixture_id) return
    await refreshMatchResult(data.api_fixture_id)
    reloadMatches(id)
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
    reloadMatches(id)
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
          <Loader2 className="h-6 w-6 animate-spin text-indigo-500" />
          <span>טוען משחקים...</span>
        </div>
      )}

      <div className="space-y-4 stagger">
        {!isLoadingMatches && visibleMatches.map((match: Match) => (
          <div key={match.id} className="animate-fade-up">
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    {new Date(match.matchStartTime).toLocaleDateString('he-IL', {
                      weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
                    })}
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    {match.actualScore !== null && (
                      <Badge variant="outline" className="text-green-700 border-green-300">
                        תוצאה: {match.actualScore.home}–{match.actualScore.away}
                      </Badge>
                    )}
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
                      ? <CheckCircle2 className="h-4 w-4 text-green-500" />
                      : <Save className="h-4 w-4" />}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        ))}

        {!isLoadingMatches && visibleMatches.length === 0 && realMatches.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            <p className="mb-2">אין משחקים עדיין.</p>
            <p className="text-sm">לחץ <strong>סנכרן מ-API</strong> כדי לייבא משחקים אמיתיים,<br />או הוסף משחק ידנית.</p>
          </div>
        )}
      </div>

      <BracketConfigSection tournamentId={id} />
    </div>
  )
}
