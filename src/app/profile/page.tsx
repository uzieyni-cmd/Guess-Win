'use client'
import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowRight, BarChart3, Camera, CheckCircle2, Loader2, Lock, User } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { AuthGuard } from '@/components/auth/AuthGuard'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { supabase } from '@/lib/supabase'
import { uploadAvatar } from '@/app/actions/profile'

interface Stats {
  totalBets: number
  finishedBets: number
  exact: number
  outcome: number
  miss: number
  totalPoints: number
  tournaments: number
}

function getOutcome(home: number, away: number): 'home' | 'away' | 'draw' {
  if (home > away) return 'home'
  if (away > home) return 'away'
  return 'draw'
}

function StatBox({ label, value, color, sub }: { label: string; value: number | string; color: string; sub?: string }) {
  return (
    <div className="bg-slate-700/40 rounded-lg p-3 text-center">
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
      <p className="text-xs text-slate-400 mt-0.5">{label}</p>
      {sub && <p className="text-xs text-slate-500">{sub}</p>}
    </div>
  )
}

function ProfileContent() {
  const { currentUser, refreshUser } = useAuth()
  const router = useRouter()

  // Edit name
  const [firstName, setFirstName] = useState(currentUser?.firstName ?? '')
  const [lastName, setLastName]   = useState(currentUser?.lastName ?? '')
  const [nameLoading, setNameLoading] = useState(false)
  const [nameError, setNameError] = useState('')
  const [nameSuccess, setNameSuccess] = useState(false)

  // Change password
  const [currentPw, setCurrentPw] = useState('')
  const [newPw, setNewPw] = useState('')
  const [confirmPw, setConfirmPw] = useState('')
  const [pwLoading, setPwLoading] = useState(false)
  const [pwError, setPwError] = useState('')
  const [pwSuccess, setPwSuccess] = useState(false)

  // Avatar
  const [avatarLoading, setAvatarLoading] = useState(false)
  const [avatarError, setAvatarError] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Stats
  const [stats, setStats] = useState<Stats | null>(null)
  const [statsLoading, setStatsLoading] = useState(true)

  useEffect(() => {
    if (currentUser) loadStats()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser?.id])

  async function loadStats() {
    if (!currentUser) return
    setStatsLoading(true)
    try {
      const { data: bets } = await supabase
        .from('bets')
        .select('predicted_home, predicted_away, tournament_id, matches (actual_home_score, actual_away_score)')
        .eq('user_id', currentUser.id)

      if (!bets) { setStats(null); return }

      let exact = 0, outcome = 0, miss = 0, totalPoints = 0, finishedBets = 0
      const tournamentSet = new Set<string>()

      for (const bet of bets) {
        tournamentSet.add(bet.tournament_id)
        type MatchRow = { actual_home_score: number | null; actual_away_score: number | null }
        const raw = bet.matches as MatchRow | MatchRow[] | null
        const match = Array.isArray(raw) ? raw[0] ?? null : raw
        if (!match || match.actual_home_score === null || match.actual_away_score === null) continue

        finishedBets++
        const ah = match.actual_home_score, aa = match.actual_away_score
        const ph = bet.predicted_home, pa = bet.predicted_away

        if (ph === ah && pa === aa) {
          exact++; totalPoints += 10
        } else if (getOutcome(ph, pa) === getOutcome(ah, aa)) {
          outcome++; totalPoints += 5
        } else {
          miss++
        }
      }

      setStats({ totalBets: bets.length, finishedBets, exact, outcome, miss, totalPoints, tournaments: tournamentSet.size })
    } finally {
      setStatsLoading(false)
    }
  }

  async function handleSaveName() {
    if (!currentUser || !firstName.trim() || !lastName.trim()) return
    setNameLoading(true)
    setNameError('')
    setNameSuccess(false)
    try {
      const displayName = `${firstName.trim()} ${lastName.trim()}`
      const { error } = await supabase
        .from('profiles')
        .update({ first_name: firstName.trim(), last_name: lastName.trim(), display_name: displayName })
        .eq('id', currentUser.id)
      if (error) throw error
      await refreshUser()
      setNameSuccess(true)
      setTimeout(() => setNameSuccess(false), 3000)
    } catch {
      setNameError('שגיאה בשמירת השם')
    } finally {
      setNameLoading(false)
    }
  }

  async function handleChangePassword() {
    if (!currentUser) return
    setPwError('')
    setPwSuccess(false)
    if (newPw !== confirmPw) { setPwError('הסיסמאות אינן תואמות'); return }
    if (newPw.length < 6) { setPwError('הסיסמה חייבת להיות לפחות 6 תווים'); return }

    setPwLoading(true)
    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({ email: currentUser.email, password: currentPw })
      if (signInError) { setPwError('הסיסמה הנוכחית שגויה'); return }

      const { error } = await supabase.auth.updateUser({ password: newPw })
      if (error) throw error

      setPwSuccess(true)
      setCurrentPw(''); setNewPw(''); setConfirmPw('')
      setTimeout(() => setPwSuccess(false), 3000)
    } catch {
      setPwError('שגיאה בשינוי הסיסמה')
    } finally {
      setPwLoading(false)
    }
  }

  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !currentUser) return

    setAvatarLoading(true)
    setAvatarError('')
    try {
      const formData = new FormData()
      formData.append('file', file)
      const result = await uploadAvatar(formData)
      if (result.error) { setAvatarError(result.error); return }
      await refreshUser()
    } catch {
      setAvatarError('שגיאה בהעלאת התמונה')
    } finally {
      setAvatarLoading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const initials = currentUser?.displayName?.charAt(0)?.toUpperCase() ?? '?'

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0a0e1a] to-[#0d1b14]">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-[#0a0e1a]/80 backdrop-blur-md border-b border-white/10">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
          <button
            onClick={() => router.back()}
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded hover:bg-white/10 transition-colors text-white"
          >
            <ArrowRight className="h-5 w-5" />
          </button>
          <span className="font-suez text-xl text-white">הפרופיל שלי</span>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">
        <div className="space-y-4 animate-fade-up">

          {/* Profile summary */}
          <Card className="bg-gray-900/60 border-white/10">
            <CardContent className="pt-6">
              <div className="flex flex-col items-center gap-3">
                <div className="relative">
                  <Avatar className="h-20 w-20">
                    <AvatarImage src={currentUser?.avatarUrl} />
                    <AvatarFallback delayMs={0} className="bg-indigo-600 text-white text-2xl font-bold">
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={avatarLoading}
                    className="absolute bottom-0 left-0 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 rounded-full p-1.5 transition-colors"
                  >
                    {avatarLoading
                      ? <Loader2 className="h-3.5 w-3.5 text-white animate-spin" />
                      : <Camera className="h-3.5 w-3.5 text-white" />}
                  </button>
                  <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
                </div>
                {avatarError && <p className="text-red-400 text-xs">{avatarError}</p>}
                <div className="text-center">
                  <p className="font-suez text-xl text-white">{currentUser?.displayName}</p>
                  <p className="text-sm text-emerald-300">{currentUser?.email}</p>
                  {currentUser?.role === 'admin' && (
                    <Badge className="mt-1.5 bg-emerald-600 hover:bg-emerald-600 text-white">מנהל</Badge>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Edit name */}
          <Card className="bg-gray-900/60 border-white/10">
            <CardHeader className="pb-3">
              <CardTitle className="text-white text-base flex items-center gap-2">
                <User className="h-4 w-4 text-emerald-400" />
                עריכת שם
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-emerald-200 text-sm">שם פרטי</Label>
                  <Input
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    className="bg-gray-800/60 border-white/10 text-white placeholder:text-slate-400"
                    placeholder="ישראל"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-emerald-200 text-sm">שם משפחה</Label>
                  <Input
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    className="bg-gray-800/60 border-white/10 text-white placeholder:text-slate-400"
                    placeholder="ישראלי"
                  />
                </div>
              </div>
              {nameError && <p className="text-red-400 text-sm">{nameError}</p>}
              {nameSuccess && (
                <p className="text-green-400 text-sm flex items-center gap-1">
                  <CheckCircle2 className="h-4 w-4" /> השם עודכן בהצלחה
                </p>
              )}
              <Button
                onClick={handleSaveName}
                disabled={nameLoading || !firstName.trim() || !lastName.trim()}
                className="w-full bg-emerald-600 hover:bg-emerald-500 text-white"
              >
                {nameLoading && <Loader2 className="h-4 w-4 animate-spin ml-2" />}
                שמירה
              </Button>
            </CardContent>
          </Card>

          {/* Change password */}
          <Card className="bg-gray-900/60 border-white/10">
            <CardHeader className="pb-3">
              <CardTitle className="text-white text-base flex items-center gap-2">
                <Lock className="h-4 w-4 text-emerald-400" />
                שינוי סיסמה
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-1.5">
                <Label className="text-emerald-200 text-sm">סיסמה נוכחית</Label>
                <Input
                  type="password"
                  value={currentPw}
                  onChange={(e) => setCurrentPw(e.target.value)}
                  className="bg-gray-800/60 border-white/10 text-white placeholder:text-slate-400"
                  placeholder="••••••••"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-emerald-200 text-sm">סיסמה חדשה</Label>
                <Input
                  type="password"
                  value={newPw}
                  onChange={(e) => setNewPw(e.target.value)}
                  className="bg-gray-800/60 border-white/10 text-white placeholder:text-slate-400"
                  placeholder="••••••••"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-emerald-200 text-sm">אישור סיסמה חדשה</Label>
                <Input
                  type="password"
                  value={confirmPw}
                  onChange={(e) => setConfirmPw(e.target.value)}
                  className="bg-gray-800/60 border-white/10 text-white placeholder:text-slate-400"
                  placeholder="••••••••"
                />
              </div>
              {pwError && <p className="text-red-400 text-sm">{pwError}</p>}
              {pwSuccess && (
                <p className="text-green-400 text-sm flex items-center gap-1">
                  <CheckCircle2 className="h-4 w-4" /> הסיסמה עודכנה בהצלחה
                </p>
              )}
              <Button
                onClick={handleChangePassword}
                disabled={pwLoading || !currentPw || !newPw || !confirmPw}
                className="w-full bg-emerald-600 hover:bg-emerald-500 text-white"
              >
                {pwLoading && <Loader2 className="h-4 w-4 animate-spin ml-2" />}
                שינוי סיסמה
              </Button>
            </CardContent>
          </Card>

          {/* Statistics */}
          <Card className="bg-gray-900/60 border-white/10">
            <CardHeader className="pb-3">
              <CardTitle className="text-white text-base flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-emerald-400" />
                סטטיסטיקות אישיות
              </CardTitle>
            </CardHeader>
            <CardContent>
              {statsLoading ? (
                <div className="flex justify-center py-6">
                  <Loader2 className="h-6 w-6 text-emerald-400 animate-spin" />
                </div>
              ) : stats && stats.totalBets > 0 ? (
                <div className="grid grid-cols-2 gap-3">
                  <StatBox label="סה״כ ניחושים" value={stats.totalBets} color="text-white" />
                  <StatBox label="תחרויות" value={stats.tournaments} color="text-white" />
                  <StatBox label="סה״כ נקודות" value={stats.totalPoints} color="text-yellow-400" />
                  <StatBox label="ניחושים שהסתיימו" value={stats.finishedBets} color="text-emerald-300" />
                  <StatBox label="תוצאה מדויקת" value={stats.exact} color="text-green-400" sub="10 נק׳ כל אחד" />
                  <StatBox label="כיוון נכון" value={stats.outcome} color="text-blue-400" sub="5 נק׳ כל אחד" />
                  <StatBox label="החטאה" value={stats.miss} color="text-red-400" sub="0 נק׳" />
                  {stats.finishedBets > 0 && (
                    <StatBox
                      label="אחוז הצלחה"
                      value={`${Math.round(((stats.exact + stats.outcome) / stats.finishedBets) * 100)}%`}
                      color="text-emerald-300"
                    />
                  )}
                </div>
              ) : (
                <p className="text-center text-emerald-300 py-4 text-sm">אין ניחושים עדיין</p>
              )}
            </CardContent>
          </Card>

        </div>
      </div>
    </div>
  )
}

export default function ProfilePage() {
  return (
    <AuthGuard>
      <ProfileContent />
    </AuthGuard>
  )
}
