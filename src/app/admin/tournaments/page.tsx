'use client'
import { useState } from 'react'
import { motion } from 'framer-motion'
import { Plus, Trophy } from 'lucide-react'
import Link from 'next/link'
import { useTournament } from '@/context/TournamentContext'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'

// ליגות נפוצות מ-API-Football
const POPULAR_LEAGUES = [
  { id: 2, name: 'UEFA Champions League', season: 2024 },
  { id: 1, name: 'FIFA World Cup', season: 2026 },
  { id: 3, name: 'UEFA Europa League', season: 2024 },
  { id: 848, name: 'UEFA Conference League', season: 2024 },
  { id: 39, name: 'Premier League', season: 2024 },
  { id: 140, name: 'La Liga', season: 2024 },
  { id: 135, name: 'Serie A', season: 2024 },
]

export default function AdminTournamentsPage() {
  const { tournaments, createTournament } = useTournament()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [logoUrl, setLogoUrl] = useState('')
  const [leagueId, setLeagueId] = useState('')
  const [season, setSeason] = useState(new Date().getFullYear().toString())

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    await createTournament({
      name,
      description,
      logoUrl,
      apiLeagueId: leagueId ? parseInt(leagueId) : undefined,
      apiSeason: season ? parseInt(season) : undefined,
    })
    setOpen(false)
    setName('')
    setDescription('')
    setLogoUrl('')
    setLeagueId('')
  }

  const fillLeague = (league: typeof POPULAR_LEAGUES[0]) => {
    setName(league.name)
    setLeagueId(String(league.id))
    setSeason(String(league.season))
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-suez text-2xl">תחרויות</h1>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 ml-1" />תחרות חדשה</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>יצירת תחרות</DialogTitle></DialogHeader>
            <form onSubmit={handleCreate} className="space-y-4">
              {/* ליגות מהירות */}
              <div>
                <Label className="text-xs text-muted-foreground mb-2 block">ליגות נפוצות מ-API-Football</Label>
                <div className="flex flex-wrap gap-1.5">
                  {POPULAR_LEAGUES.map((l) => (
                    <button key={l.id} type="button" onClick={() => fillLeague(l)}
                      className="text-xs px-2 py-1 rounded-full border border-indigo-300 text-indigo-700 hover:bg-indigo-50 transition-colors">
                      {l.name}
                    </button>
                  ))}
                </div>
              </div>
              <div className="border-t pt-4 space-y-4">
                <div>
                  <Label>שם התחרות</Label>
                  <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="ליגת האלופות" required />
                </div>
                <div>
                  <Label>תיאור</Label>
                  <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="שלב רבע גמר" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>League ID (API-Football)</Label>
                    <Input value={leagueId} onChange={(e) => setLeagueId(e.target.value)} placeholder="2" type="number" />
                  </div>
                  <div>
                    <Label>עונה</Label>
                    <Input value={season} onChange={(e) => setSeason(e.target.value)} placeholder="2024" type="number" />
                  </div>
                </div>
                <div>
                  <Label>קישור לוגו (אופציונלי)</Label>
                  <Input value={logoUrl} onChange={(e) => setLogoUrl(e.target.value)} placeholder="https://..." />
                </div>
              </div>
              <Button type="submit" className="w-full">צור תחרות</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="space-y-3">
        {tournaments.map((t, i) => (
          <motion.div key={t.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.05 }}>
            <Card>
              <CardContent className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Trophy className="h-5 w-5 text-indigo-500" />
                  <div>
                    <p className="font-medium">{t.name}</p>
                    <p className="text-sm text-muted-foreground">{t.matches.length} משחקים · {t.participantIds.length} שחקנים</p>
                  </div>
                </div>
                <Link href={`/admin/tournaments/${t.id}`}>
                  <Button variant="outline" size="sm">ניהול</Button>
                </Link>
              </CardContent>
            </Card>
          </motion.div>
        ))}
        {tournaments.length === 0 && (
          <p className="text-center py-12 text-muted-foreground">אין תחרויות עדיין. צור את הראשונה!</p>
        )}
      </div>
    </div>
  )
}
