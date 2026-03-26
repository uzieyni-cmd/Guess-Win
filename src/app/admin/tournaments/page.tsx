'use client'
import { useState, useTransition, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { Plus, Trophy, Pencil, CheckCircle2, Trash2, Eye, EyeOff, Loader2, Upload, Link2, Search, ChevronDown } from 'lucide-react'
import Link from 'next/link'
import { useTournament } from '@/context/TournamentContext'
import { fetchLeagueSeasons, fetchAllLeagues, LeagueItem } from '@/app/actions/leagues'
import { adminUpdateTournament, fetchLogoForTournament, uploadLogo } from '@/app/actions/tournaments'
import { Tournament } from '@/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'

const POPULAR_LEAGUES = [
  { id: 2,   name: 'UEFA Champions League'  },
  { id: 1,   name: 'FIFA World Cup'         },
  { id: 3,   name: 'UEFA Europa League'     },
  { id: 848, name: 'UEFA Conference League' },
  { id: 39,  name: 'Premier League'         },
  { id: 140, name: 'La Liga'                },
  { id: 135, name: 'Serie A'                },
]

// עונות מועדפות — Pro Plan, נתוני 2025 זמינים לכל הליגות
const KNOWN_DATA_SEASONS: Record<number, number> = {
  2: 2025,   // UCL: 2025/2026 ✅ (276 משחקים)
  3: 2025,   // Europa: 2025/2026 ✅ (266 משחקים)
  848: 2025, // Conference: 2025/2026 ✅ (404 משחקים)
  39: 2025,  // Premier League: 2025/2026 ✅ (380 משחקים)
  140: 2025, // La Liga: 2025/2026 ✅ (380 משחקים)
  135: 2025, // Serie A: 2025/2026 ✅ (380 משחקים)
  1: 2026,   // World Cup: 2026 ✅
}

const STATUS_OPTIONS: { value: Tournament['status']; label: string }[] = [
  { value: 'upcoming',  label: 'בקרוב'  },
  { value: 'active',    label: 'פעיל'   },
  { value: 'completed', label: 'הסתיים' },
]

interface SeasonOption { year: number; label: string; current: boolean }

export default function AdminTournamentsPage() {
  const { tournaments, createTournament, deleteTournament, toggleHideTournament, reload } = useTournament()
  const [confirmDelete, setConfirmDelete] = useState<Tournament | null>(null)
  const router = useRouter()
  const [creating, setCreating] = useState(false)

  // ── Create state ─────────────────────────────────────────────────
  const [createOpen, setCreateOpen]         = useState(false)
  const [name, setName]                     = useState('')
  const [description, setDescription]       = useState('')
  const [logoUrl, setLogoUrl]               = useState('')
  const [leagueId, setLeagueId]             = useState('')
  const [season, setSeason]                 = useState('')
  const [seasons, setSeasons]               = useState<SeasonOption[]>([])
  const [isPending, startTransition]        = useTransition()
  const [selectedLeagueName, setSelectedLeagueName] = useState('')

  // ── All leagues browser ───────────────────────────────────────────
  const [leagueBrowserOpen, setLeagueBrowserOpen] = useState(false)
  const [allLeagues, setAllLeagues]               = useState<LeagueItem[]>([])
  const [leaguesLoading, setLeaguesLoading]       = useState(false)
  const [leagueSearch, setLeagueSearch]           = useState('')

  // ── Edit state ───────────────────────────────────────────────────
  const [editTournament, setEditTournament]         = useState<Tournament | null>(null)
  const [editName, setEditName]                     = useState('')
  const [editLogo, setEditLogo]                     = useState('')
  const [editDescription, setEditDescription]       = useState('')
  const [editStatus, setEditStatus]                 = useState<Tournament['status']>('upcoming')
  const [editSaved, setEditSaved]                   = useState(false)
  const [editSaving, setEditSaving]                 = useState(false)
  const [fetchingLogo, setFetchingLogo]             = useState(false)
  const [uploadingLogo, setUploadingLogo]           = useState(false)
  const [uploadingCreateLogo, setUploadingCreateLogo] = useState(false)
  const [uploadError, setUploadError]               = useState('')
  const [editLogoError, setEditLogoError]           = useState(false)
  const editFileRef   = useRef<HTMLInputElement>(null)
  const createFileRef = useRef<HTMLInputElement>(null)

  const openEdit = (t: Tournament) => {
    setEditTournament(t)
    setEditName(t.name)
    setEditLogo(t.logoUrl)
    setEditDescription(t.description)
    setEditStatus(t.status)
    setEditSaved(false)
    setUploadError('')
    setEditLogoError(false)
  }

  // ── Open leagues browser ──────────────────────────────────────────
  const openLeagueBrowser = async () => {
    setLeagueBrowserOpen(true)
    if (allLeagues.length > 0) return
    setLeaguesLoading(true)
    try {
      const leagues = await fetchAllLeagues()
      setAllLeagues(leagues)
    } finally {
      setLeaguesLoading(false)
    }
  }

  // ── Select a popular league → fetch seasons from API ─────────────
  const selectLeague = (league: { id: number; name: string }) => {
    setLeagueId(String(league.id))
    setSelectedLeagueName(league.name)
    setName(league.name)
    setSeason('')
    setSeasons([])
    startTransition(async () => {
      const { seasons: fetchedSeasons, logoUrl: fetchedLogo } = await fetchLeagueSeasons(league.id)
      setSeasons(fetchedSeasons)
      if (fetchedLogo) setLogoUrl(fetchedLogo)
      // עדיפות: עונה שיש לה נתונים ידועים, אחרת העונה הנוכחית
      const knownSeason = KNOWN_DATA_SEASONS[league.id]
      const preferred = (knownSeason ? fetchedSeasons.find((s) => s.year === knownSeason) : null)
        ?? fetchedSeasons.find((s) => s.current)
        ?? fetchedSeasons[0]
      if (preferred) {
        setSeason(String(preferred.year))
        setName(`${league.name} ${preferred.label}`)
      }
    })
  }

  // ── Handlers ─────────────────────────────────────────────────────
  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    setCreating(true)
    const newId = await createTournament({
      name, description, logoUrl,
      apiLeagueId: leagueId ? parseInt(leagueId) : undefined,
      apiSeason:   season   ? parseInt(season)   : undefined,
    })
    setCreating(false)
    setCreateOpen(false)
    setName(''); setDescription(''); setLogoUrl('')
    setLeagueId(''); setSeason(''); setSeasons([])
    setSelectedLeagueName('')
    // נווט ישירות לדף הניהול — שם ה-sync יקרה אוטומטית עם progress bar
    if (newId) router.push(`/admin/tournaments/${newId}`)
  }

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editTournament) return
    setEditSaving(true)
    // קריאה ישירה ל-Server Action עם supabaseAdmin — עוקף RLS
    const result = await adminUpdateTournament(editTournament.id, {
      name: editName, logoUrl: editLogo,
      description: editDescription, status: editStatus,
    })
    setEditSaving(false)
    if (!result.ok) {
      alert('שגיאה בשמירה: ' + result.error)
      return
    }
    setEditSaved(true)
    reload() // רענן את רשימת הטורנירים
    setTimeout(() => { setEditTournament(null); setEditSaved(false) }, 900)
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-suez text-2xl">תחרויות</h1>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 ml-1" />תחרות חדשה</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>יצירת תחרות</DialogTitle></DialogHeader>
            <form onSubmit={handleCreate} className="space-y-4">

              {/* שלב 1: בחירת ליגה */}
              <div>
                <Label className="text-xs text-muted-foreground mb-2 block">① בחר ליגה</Label>
                <div className="flex flex-wrap gap-1.5">
                  {POPULAR_LEAGUES.map((l) => (
                    <button key={l.id} type="button" onClick={() => selectLeague(l)}
                      className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                        leagueId === String(l.id)
                          ? 'bg-emerald-600 text-white border-emerald-600'
                          : 'border-gray-300 text-gray-700 hover:border-emerald-400'
                      }`}>
                      {l.name}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={openLeagueBrowser}
                    className="text-xs px-2.5 py-1 rounded-full border border-dashed border-gray-400 text-gray-500 hover:border-emerald-500 hover:text-emerald-600 transition-colors flex items-center gap-1"
                  >
                    <ChevronDown className="h-3 w-3" />
                    בחירה אחרת
                  </button>
                </div>
              </div>

              {/* League browser dialog */}
              <Dialog open={leagueBrowserOpen} onOpenChange={setLeagueBrowserOpen}>
                <DialogContent className="max-w-md max-h-[80vh] flex flex-col">
                  <DialogHeader><DialogTitle>כל הליגות</DialogTitle></DialogHeader>
                  <div className="relative">
                    <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <input
                      autoFocus
                      type="text"
                      placeholder="חפש ליגה או מדינה..."
                      value={leagueSearch}
                      onChange={(e) => setLeagueSearch(e.target.value)}
                      className="w-full border rounded-md py-2 pr-9 pl-3 text-sm outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                  <div className="flex-1 overflow-y-auto space-y-0.5 min-h-0">
                    {leaguesLoading ? (
                      <div className="flex items-center justify-center py-12 gap-2 text-muted-foreground text-sm">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        טוען ליגות מ-API-Football...
                      </div>
                    ) : (() => {
                        const q = leagueSearch.toLowerCase()
                        const filtered = allLeagues.filter(
                          (l) => l.name.toLowerCase().includes(q) || l.country.toLowerCase().includes(q)
                        )
                        if (filtered.length === 0) return (
                          <p className="text-center py-8 text-sm text-muted-foreground">לא נמצאו ליגות</p>
                        )
                        return filtered.map((l) => (
                          <button
                            key={l.id}
                            type="button"
                            onClick={() => {
                              selectLeague({ id: l.id, name: l.name })
                              setLeagueBrowserOpen(false)
                              setLeagueSearch('')
                            }}
                            className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm hover:bg-muted transition-colors text-right ${
                              leagueId === String(l.id) ? 'bg-emerald-50 text-emerald-700' : ''
                            }`}
                          >
                            {l.logo
                              ? <img src={l.logo} alt="" className="h-6 w-6 object-contain shrink-0" />
                              : <Trophy className="h-5 w-5 text-muted-foreground shrink-0" />
                            }
                            <span className="flex-1 truncate font-medium">{l.name}</span>
                            <span className="text-xs text-muted-foreground shrink-0 flex items-center gap-1">
                              {l.flag && <img src={l.flag} alt="" className="h-3.5 w-5 object-cover rounded-sm" />}
                              {l.country}
                            </span>
                          </button>
                        ))
                      })()
                    }
                  </div>
                </DialogContent>
              </Dialog>

              {/* שלב 2: בחירת עונה (אחרי שנשלפה מה-API) */}
              {(isPending || seasons.length > 0) && (
                <div>
                  <Label className="text-xs text-muted-foreground mb-2 block">② בחר עונה</Label>
                  {isPending ? (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      טוען עונות מ-API-Football...
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-1.5">
                      {seasons.map((s) => (
                        <button key={s.year} type="button"
                          onClick={() => {
                            setSeason(String(s.year))
                            setName(`${selectedLeagueName} ${s.label}`)
                          }}
                          className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                            season === String(s.year)
                              ? 'bg-indigo-600 text-white border-indigo-600'
                              : 'border-gray-300 text-gray-700 hover:border-indigo-300'
                          }`}>
                          {s.label}
                          {s.current && <span className="mr-1 text-green-400">●</span>}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <div className="border-t pt-4 space-y-4">
                {/* שם (מתמלא אוטומטית, ניתן לעריכה) */}
                <div>
                  <Label>שם התחרות</Label>
                  <Input value={name} onChange={(e) => setName(e.target.value)}
                    placeholder="UEFA Champions League 2024/2025" required />
                </div>
                <div>
                  <Label>תיאור</Label>
                  <Input value={description} onChange={(e) => setDescription(e.target.value)}
                    placeholder="שלב הבתים, שלב ה-16, רבע גמר..." />
                </div>

                {/* League ID ועונה ידניים (כגיבוי אם לא בחרו מהרשימה) */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>League ID</Label>
                    <Input value={leagueId} onChange={(e) => setLeagueId(e.target.value)}
                      placeholder="2" type="number" />
                  </div>
                  <div>
                    <Label>עונה (שנת התחלה)</Label>
                    <Input value={season} onChange={(e) => setSeason(e.target.value)}
                      placeholder="2024" type="number" />
                  </div>
                </div>

                <div>
                  <Label>לוגו (אופציונלי)</Label>
                  <div className="flex gap-2">
                    <Input value={logoUrl} onChange={(e) => setLogoUrl(e.target.value)} placeholder="https://..." className="flex-1" />
                    <Button type="button" variant="outline" size="sm" disabled={uploadingCreateLogo}
                      onClick={() => createFileRef.current?.click()}>
                      {uploadingCreateLogo ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Upload className="h-4 w-4 ml-1" />העלה</>}
                    </Button>
                  </div>
                  <input ref={createFileRef} type="file" accept="image/*" className="hidden"
                    onChange={async (e) => {
                      const file = e.target.files?.[0]
                      if (!file) return
                      setUploadingCreateLogo(true)
                      const fd = new FormData(); fd.append('file', file)
                      const res = await uploadLogo(fd)
                      if (res.url) setLogoUrl(res.url)
                      setUploadingCreateLogo(false)
                      e.target.value = ''
                    }} />
                  {logoUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={logoUrl} alt="preview" className="mt-2 h-10 w-10 object-contain rounded border" />
                  )}
                </div>
              </div>

              <Button type="submit" className="w-full" disabled={isPending || creating}>
                {(isPending || creating)
                  ? <><Loader2 className="h-4 w-4 ml-1 animate-spin" />{creating ? 'יוצר...' : 'טוען עונות...'}</>
                  : <><Plus className="h-4 w-4 ml-1" />צור תחרות</>}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Tournament list */}
      <div className="space-y-3">
        {tournaments.map((t, i) => (
          <motion.div key={t.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.05 }}>
            <Card className={t.isHidden ? 'opacity-60' : ''}>
              <CardContent className="p-4 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  {t.logoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={t.logoUrl} alt={t.name}
                      className="h-9 w-9 rounded-full object-contain bg-gray-100 p-0.5 shrink-0"
                      onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }} />
                  ) : (
                    <div className="h-9 w-9 rounded-full bg-indigo-100 flex items-center justify-center shrink-0">
                      <Trophy className="h-4 w-4 text-indigo-500" />
                    </div>
                  )}
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className={`font-medium truncate ${t.isHidden ? 'text-muted-foreground' : ''}`}>{t.name}</p>
                      {t.isHidden && (
                        <span className="text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full shrink-0">מוסתר</span>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {t.matches.length} משחקים · {t.participantIds.length} שחקנים ·{' '}
                      <span className={t.status === 'active' ? 'text-green-600' : t.status === 'completed' ? 'text-gray-400' : 'text-amber-600'}>
                        {t.status === 'active' ? 'פעיל' : t.status === 'upcoming' ? 'בקרוב' : 'הסתיים'}
                      </span>
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button variant="ghost" size="icon"
                    onClick={() => toggleHideTournament(t.id, !t.isHidden)}
                    title={t.isHidden ? 'הצג תחרות' : 'הסתר תחרות'}>
                    {t.isHidden
                      ? <EyeOff className="h-4 w-4 text-amber-500" />
                      : <Eye className="h-4 w-4 text-muted-foreground" />}
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => openEdit(t)} title="עריכה">
                    <Pencil className="h-4 w-4 text-muted-foreground" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => setConfirmDelete(t)} title="מחיקה">
                    <Trash2 className="h-4 w-4 text-red-400" />
                  </Button>
                  <Link href={`/admin/tournaments/${t.id}`}>
                    <Button variant="outline" size="sm">ניהול</Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
        {tournaments.length === 0 && (
          <p className="text-center py-12 text-muted-foreground">אין תחרויות עדיין. צור את הראשונה!</p>
        )}
      </div>

      {/* Delete confirmation dialog */}
      <Dialog open={!!confirmDelete} onOpenChange={(open) => { if (!open) setConfirmDelete(null) }}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle className="text-red-600">מחיקת תחרות</DialogTitle></DialogHeader>
          <div className="py-2">
            <p className="text-sm text-muted-foreground">
              האם אתה בטוח שברצונך למחוק את{' '}
              <strong className="text-foreground">"{confirmDelete?.name}"</strong>?
            </p>
            <p className="text-xs text-red-500 mt-2">פעולה זו תמחק את כל המשחקים והניחושים בתחרות ואינה הפיכה.</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={() => setConfirmDelete(null)}>ביטול</Button>
            <Button variant="destructive" className="flex-1"
              onClick={async () => {
                if (confirmDelete) await deleteTournament(confirmDelete.id)
                setConfirmDelete(null)
              }}>
              <Trash2 className="h-4 w-4 ml-1" />מחק לצמיתות
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit dialog */}
      <Dialog open={!!editTournament} onOpenChange={(open) => { if (!open) setEditTournament(null) }}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>עריכת תחרות</DialogTitle></DialogHeader>
          <form onSubmit={handleEdit} className="space-y-4">
            <div>
              <Label>שם התחרות</Label>
              <Input value={editName} onChange={(e) => setEditName(e.target.value)} required />
            </div>
            <div>
              <Label>תיאור</Label>
              <Input value={editDescription} onChange={(e) => setEditDescription(e.target.value)} />
            </div>
            <div>
              <Label>לוגו</Label>
              <div className="flex gap-2">
                <Input value={editLogo} onChange={(e) => setEditLogo(e.target.value)} placeholder="https://..." className="flex-1" />
                <Button type="button" variant="outline" size="sm" disabled={uploadingLogo}
                  onClick={() => editFileRef.current?.click()}>
                  {uploadingLogo ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Upload className="h-4 w-4 ml-1" />העלה</>}
                </Button>
                <Button type="button" variant="outline" size="sm" disabled={fetchingLogo}
                  onClick={async () => {
                    if (!editTournament) return
                    setFetchingLogo(true)
                    const url = await fetchLogoForTournament(editTournament.id)
                    if (url) setEditLogo(url)
                    setFetchingLogo(false)
                  }}>
                  {fetchingLogo ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Link2 className="h-4 w-4 ml-1" />שלוף</>}
                </Button>
              </div>
              <input ref={editFileRef} type="file" accept="image/*" className="hidden"
                onChange={async (e) => {
                  const file = e.target.files?.[0]
                  if (!file) return
                  setUploadingLogo(true)
                  setUploadError('')
                  setEditLogoError(false)
                  const fd = new FormData(); fd.append('file', file)
                  const res = await uploadLogo(fd)
                  if (res.url) setEditLogo(res.url)
                  else setUploadError(res.error ?? 'שגיאה בהעלאה')
                  setUploadingLogo(false)
                  e.target.value = ''
                }} />
              {uploadError && <p className="mt-1 text-xs text-red-500">{uploadError}</p>}
              {editLogo && (
                <div className="mt-2 flex items-center gap-3">
                  {editLogoError ? (
                    <p className="text-xs text-red-500">לא ניתן לטעון את התמונה — וודא שה-bucket ב-Supabase מוגדר כ-Public</p>
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={editLogo} alt="preview"
                      className="h-12 w-12 object-contain rounded border"
                      onError={() => setEditLogoError(true)} />
                  )}
                  <p className="text-xs text-muted-foreground truncate max-w-[200px]">{editLogo}</p>
                </div>
              )}
            </div>
            <div>
              <Label>סטטוס</Label>
              <div className="flex gap-2 mt-1">
                {STATUS_OPTIONS.map((opt) => (
                  <button key={opt.value} type="button" onClick={() => setEditStatus(opt.value)}
                    className={`flex-1 py-1.5 rounded-lg border text-sm font-medium transition-colors ${
                      editStatus === opt.value
                        ? 'bg-indigo-600 text-white border-indigo-600'
                        : 'border-gray-200 text-gray-600 hover:border-indigo-300'
                    }`}>
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
            <Button type="submit" className="w-full" disabled={editSaving || editSaved}>
              {editSaved
                ? <><CheckCircle2 className="h-4 w-4 ml-1 text-green-400" />נשמר בהצלחה!</>
                : editSaving
                  ? <><Loader2 className="h-4 w-4 ml-1 animate-spin" />שומר...</>
                  : 'שמור שינויים'}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
