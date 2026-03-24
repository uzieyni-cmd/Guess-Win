'use client'
import { useState, useEffect, useRef } from 'react'
import { useParams } from 'next/navigation'
import { motion } from 'framer-motion'
import { Plus, Save, CheckCircle2, RefreshCw, Loader2, RotateCcw, EyeOff, Eye } from 'lucide-react'
import { useTournament } from '@/context/TournamentContext'
import { syncFixtures, setMatchScore, refreshMatchResult } from '@/app/actions/fixtures'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { TeamFlag } from '@/components/shared/TeamFlag'
import { Match } from '@/types'

export default function AdminTournamentDetailPage() {
  const params = useParams()
  const id = params.id as string
  const { tournaments, addMatch, reload, reloadMatches } = useTournament()
  const tournament = tournaments.find((t) => t.id === id)

  const [scores, setScores] = useState<Record<string, { home: string; away: string }>>({})
  const [saved, setSaved] = useState<string[]>([])
  const [syncing, setSyncing] = useState(false)
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
  const autoSynced = useRef(false)

  useEffect(() => {
    if (!id) return
    // תמיד טען משחקים מלאים (לא stubs) בכניסה לדף
    reloadMatches(id)
    setMatchesLoaded(true)
  }, [id]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Auto-sync: אחרי טעינה, אם אין משחקים ויש League ID ────────
  useEffect(() => {
    if (!matchesLoaded || !tournament || autoSynced.current) return
    // בדוק האם המשחקים הם stubs (חסרי homeTeam)
    const hasRealMatches = tournament.matches.length > 0 && tournament.matches[0].homeTeam
    if (hasRealMatches) return
    if (tournament.matches.length > 0 && !tournament.matches[0].homeTeam) {
      // עדיין stubs — נחכה לריענון
      return
    }
    supabase
      .from('tournaments')
      .select('api_league_id, api_season')
      .eq('id', id)
      .single()
      .then(async ({ data: row }) => {
        if (row?.api_league_id && row?.api_season) {
          autoSynced.current = true
          setSyncing(true)
          setSyncMsg(`⏳ מסנכרן משחקים מ-API-Football...`)
          const result = await syncFixtures(id, row.api_league_id, row.api_season)
          setSyncing(false)
          if (result.error) {
            setSyncMsg(`שגיאה: ${result.error}`)
          } else {
            setSyncMsg(`✓ ${result.synced} משחקים נטענו בהצלחה!`)
            reloadMatches(id)
          }
        }
      })
  }, [matchesLoaded, tournament, id]) // eslint-disable-line react-hooks/exhaustive-deps

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
      reload()
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

      <div className="space-y-4">
        {!isLoadingMatches && visibleMatches.map((match: Match, i: number) => (
          <motion.div key={match.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}>
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
          </motion.div>
        ))}

        {!isLoadingMatches && visibleMatches.length === 0 && realMatches.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            <p className="mb-2">אין משחקים עדיין.</p>
            <p className="text-sm">לחץ <strong>סנכרן מ-API</strong> כדי לייבא משחקים אמיתיים,<br />או הוסף משחק ידנית.</p>
          </div>
        )}
      </div>
    </div>
  )
}
