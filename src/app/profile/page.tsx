'use client'
import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowRight, BarChart3, Camera, CheckCircle2, Loader2, Lock, Phone, User } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { AuthGuard } from '@/components/auth/AuthGuard'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { supabase } from '@/lib/supabase'
import { uploadAvatar, changePassword } from '@/app/actions/profile'

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
    <div className="bg-muted/60 rounded-lg p-3 text-center">
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
      <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
      {sub && <p className="text-xs text-muted-foreground/60">{sub}</p>}
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

  // Phone
  const [phone, setPhone]           = useState(currentUser?.phone ?? '')
  const [phoneLoading, setPhoneLoading] = useState(false)
  const [phoneError, setPhoneError]     = useState('')
  const [phoneSuccess, setPhoneSuccess] = useState(false)

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

  async function handleSavePhone() {
    if (!currentUser) return
    setPhoneLoading(true); setPhoneError(''); setPhoneSuccess(false)
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ phone: phone.trim() || null })
        .eq('id', currentUser.id)
      if (error) throw error
      await refreshUser()
      setPhoneSuccess(true)
      setTimeout(() => setPhoneSuccess(false), 3000)
    } catch {
      setPhoneError('שגיאה בשמירת מספר הטלפון')
    } finally {
      setPhoneLoading(false)
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
      const res = await changePassword(currentPw, newPw)
      if (!res.ok) {
        setPwError(res.error ?? 'שגיאה בשינוי הסיסמה')
        return
      }
      setPwSuccess(true)
      setCurrentPw(''); setNewPw(''); setConfirmPw('')
      setTimeout(() => setPwSuccess(false), 3000)
    } catch {
      setPwError('שגיאה בשינוי הסיסמה')
    } finally {
      setPwLoading(false)
    }
  }

  async function resizeImage(file: File, maxSize = 256): Promise<Blob> {
    return new Promise((resolve, reject) => {
      const img = new Image()
      const url = URL.createObjectURL(file)
      img.onload = () => {
        URL.revokeObjectURL(url)
        const scale = Math.min(maxSize / img.width, maxSize / img.height, 1)
        const w = Math.round(img.width * scale)
        const h = Math.round(img.height * scale)
        const canvas = document.createElement('canvas')
        canvas.width = w
        canvas.height = h
        canvas.getContext('2d')!.drawImage(img, 0, 0, w, h)
        canvas.toBlob(
          (blob) => blob ? resolve(blob) : reject(new Error('canvas toBlob failed')),
          'image/jpeg', 0.88
        )
      }
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('load failed')) }
      img.src = url
    })
  }

  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !currentUser) return

    setAvatarLoading(true)
    setAvatarError('')
    try {
      const resized = await resizeImage(file)
      const formData = new FormData()
      formData.append('file', new File([resized], 'avatar.jpg', { type: 'image/jpeg' }))
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
    <div className="min-h-screen bg-base">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-card/80 backdrop-blur-md border-b border-border">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
          <button
            onClick={() => router.back()}
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded hover:bg-foreground/8 transition-colors text-foreground"
          >
            <ArrowRight className="h-5 w-5" />
          </button>
          <span className="font-suez text-xl text-foreground">הפרופיל שלי</span>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">
        <div className="space-y-4 animate-fade-up">

          {/* Profile summary */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex flex-col items-center gap-3">
                <div className="relative">
                  <Avatar className="h-20 w-20">
                    <AvatarImage src={currentUser?.avatarUrl} />
                    <AvatarFallback delayMs={0} className="bg-primary text-primary-foreground text-2xl font-bold">
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={avatarLoading}
                    className="absolute bottom-0 left-0 bg-primary hover:bg-primary/90 disabled:opacity-60 rounded-full p-1.5 transition-colors"
                  >
                    {avatarLoading
                      ? <Loader2 className="h-3.5 w-3.5 text-primary-foreground animate-spin" />
                      : <Camera className="h-3.5 w-3.5 text-primary-foreground" />}
                  </button>
                  <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
                </div>
                {avatarError && <p className="text-red-600 text-xs">{avatarError}</p>}
                <div className="text-center">
                  <p className="font-suez text-xl text-foreground">{currentUser?.displayName}</p>
                  <p className="text-sm text-primary">{currentUser?.email}</p>
                  {currentUser?.role === 'admin' && (
                    <Badge className="mt-1.5 bg-primary hover:bg-primary text-primary-foreground">מנהל</Badge>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Edit name */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-foreground text-base flex items-center gap-2">
                <User className="h-4 w-4 text-primary" />
                עריכת שם
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-foreground text-sm">שם פרטי</Label>
                  <Input
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    className="bg-background border-border text-foreground placeholder:text-muted-foreground"
                    placeholder="ישראל"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-foreground text-sm">שם משפחה</Label>
                  <Input
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    className="bg-background border-border text-foreground placeholder:text-muted-foreground"
                    placeholder="ישראלי"
                  />
                </div>
              </div>
              {nameError && <p className="text-red-600 text-sm">{nameError}</p>}
              {nameSuccess && (
                <p className="text-emerald-600 text-sm flex items-center gap-1">
                  <CheckCircle2 className="h-4 w-4" /> השם עודכן בהצלחה
                </p>
              )}
              <Button
                onClick={handleSaveName}
                disabled={nameLoading || !firstName.trim() || !lastName.trim()}
                className="w-full bg-primary hover:bg-primary/90 text-primary-foreground"
              >
                {nameLoading && <Loader2 className="h-4 w-4 animate-spin ml-2" />}
                שמירה
              </Button>
            </CardContent>
          </Card>

          {/* Phone */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-foreground text-base flex items-center gap-2">
                <Phone className="h-4 w-4 text-primary" />
                מספר טלפון
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-1.5">
                <Label className="text-foreground text-sm">טלפון נייד</Label>
                <Input
                  type="tel"
                  dir="ltr"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="bg-background border-border text-foreground placeholder:text-muted-foreground"
                  placeholder="050-0000000"
                />
              </div>
              {phoneError && <p className="text-red-600 text-sm">{phoneError}</p>}
              {phoneSuccess && (
                <p className="text-emerald-600 text-sm flex items-center gap-1">
                  <CheckCircle2 className="h-4 w-4" /> הטלפון עודכן בהצלחה
                </p>
              )}
              <Button
                onClick={handleSavePhone}
                disabled={phoneLoading}
                className="w-full bg-primary hover:bg-primary/90 text-primary-foreground"
              >
                {phoneLoading && <Loader2 className="h-4 w-4 animate-spin ml-2" />}
                שמירה
              </Button>
            </CardContent>
          </Card>

          {/* Change password */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-foreground text-base flex items-center gap-2">
                <Lock className="h-4 w-4 text-primary" />
                שינוי סיסמה
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-1.5">
                <Label className="text-foreground text-sm">סיסמה נוכחית</Label>
                <Input
                  type="password"
                  value={currentPw}
                  onChange={(e) => setCurrentPw(e.target.value)}
                  className="bg-background border-border text-foreground placeholder:text-muted-foreground"
                  placeholder="••••••••"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-foreground text-sm">סיסמה חדשה</Label>
                <Input
                  type="password"
                  value={newPw}
                  onChange={(e) => setNewPw(e.target.value)}
                  className="bg-background border-border text-foreground placeholder:text-muted-foreground"
                  placeholder="••••••••"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-foreground text-sm">אישור סיסמה חדשה</Label>
                <Input
                  type="password"
                  value={confirmPw}
                  onChange={(e) => setConfirmPw(e.target.value)}
                  className="bg-background border-border text-foreground placeholder:text-muted-foreground"
                  placeholder="••••••••"
                />
              </div>
              {pwError && <p className="text-red-600 text-sm">{pwError}</p>}
              {pwSuccess && (
                <p className="text-emerald-600 text-sm flex items-center gap-1">
                  <CheckCircle2 className="h-4 w-4" /> הסיסמה עודכנה בהצלחה
                </p>
              )}
              <Button
                onClick={handleChangePassword}
                disabled={pwLoading || !currentPw || !newPw || !confirmPw}
                className="w-full bg-primary hover:bg-primary/90 text-primary-foreground"
              >
                {pwLoading && <Loader2 className="h-4 w-4 animate-spin ml-2" />}
                שינוי סיסמה
              </Button>
            </CardContent>
          </Card>

          {/* Statistics */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-foreground text-base flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-primary" />
                סטטיסטיקות אישיות
              </CardTitle>
            </CardHeader>
            <CardContent>
              {statsLoading ? (
                <div className="flex justify-center py-6">
                  <Loader2 className="h-6 w-6 text-primary animate-spin" />
                </div>
              ) : stats && stats.totalBets > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <StatBox label="סה״כ ניחושים" value={stats.totalBets} color="text-foreground" />
                  <StatBox label="תחרויות" value={stats.tournaments} color="text-foreground" />
                  <StatBox label="סה״כ נקודות" value={stats.totalPoints} color="text-primary" />
                  <StatBox label="ניחושים שהסתיימו" value={stats.finishedBets} color="text-foreground" />
                  <StatBox label="תוצאה מדויקת" value={stats.exact} color="text-emerald-600" sub="4 נק׳ כל אחד" />
                  <StatBox label="כיוון נכון" value={stats.outcome} color="text-blue-600" sub="1 נק׳ כל אחד" />
                  <StatBox label="החטאה" value={stats.miss} color="text-red-500" sub="0 נק׳" />
                  {stats.finishedBets > 0 && (
                    <StatBox
                      label="אחוז הצלחה"
                      value={`${Math.round(((stats.exact + stats.outcome) / stats.finishedBets) * 100)}%`}
                      color="text-emerald-600"
                    />
                  )}
                </div>
              ) : (
                <p className="text-center text-muted-foreground py-4 text-sm">אין ניחושים עדיין</p>
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
