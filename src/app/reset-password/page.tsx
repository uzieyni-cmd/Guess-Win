'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Lock, Eye, EyeOff, CheckCircle2, AlertCircle } from 'lucide-react'
import Image from 'next/image'
import { motion } from 'framer-motion'
import { supabaseReset } from '@/lib/supabase-reset'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

function ResetPasswordContent() {
  const router = useRouter()
  const [ready, setReady]           = useState(false)   // session confirmed
  const [invalid, setInvalid]       = useState(false)   // link expired/bad
  const [password, setPassword]     = useState('')
  const [confirm, setConfirm]       = useState('')
  const [showPass, setShowPass]     = useState(false)
  const [showConf, setShowConf]     = useState(false)
  const [error, setError]           = useState('')
  const [isLoading, setIsLoading]   = useState(false)
  const [success, setSuccess]       = useState(false)

  useEffect(() => {
    // Check if session already set (e.g. navigated back)
    supabaseReset.auth.getSession().then(({ data: { session } }) => {
      if (session) setReady(true)
    })

    // supabaseReset (standard createClient) auto-exchanges ?code= from URL
    // and fires PASSWORD_RECOVERY or SIGNED_IN — exactly like mondial-yashir
    const { data: { subscription } } = supabaseReset.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY' || (event === 'SIGNED_IN' && session)) {
        setReady(true)
      }
    })

    // Fallback: if no event after 6s, mark invalid
    const t = setTimeout(() => {
      supabaseReset.auth.getSession().then(({ data: { session } }) => {
        if (!session) setInvalid(true)
      })
    }, 6000)

    return () => { subscription.unsubscribe(); clearTimeout(t) }
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (password.length < 6)         { setError('הסיסמה חייבת להכיל לפחות 6 תווים'); return }
    if (password !== confirm)         { setError('הסיסמאות אינן תואמות'); return }

    setIsLoading(true)
    try {
      const { error: err } = await supabaseReset.auth.updateUser({ password })
      if (err) {
        setError(
          err.message.includes('same') || err.message.includes('different')
            ? 'הסיסמה החדשה זהה לסיסמה הנוכחית. בחר סיסמה שונה.'
            : err.message
        )
      } else {
        // Sign out the recovery session — user logs in fresh with new password
        await supabaseReset.auth.signOut()
        setSuccess(true)
        setTimeout(() => router.push('/login'), 2000)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'שגיאה בעדכון הסיסמה')
    } finally {
      setIsLoading(false)
    }
  }

  const inputCls = "bg-background border-border text-foreground placeholder:text-muted-foreground focus-visible:ring-primary focus-visible:border-primary pr-9"
  const iconCls  = "absolute right-3 top-2.5 h-4 w-4 text-muted-foreground"

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4" dir="rtl">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-sm"
      >
        <div className="flex justify-center mb-6">
          <Image src="/logo.svg" alt="Guess&Win" width={90} height={105} priority />
        </div>

        <div className="rounded-2xl bg-card/90 backdrop-blur-md border border-border/50 shadow-2xl p-6">

          {/* ── Loading ── */}
          {!ready && !invalid && !success && (
            <div className="flex flex-col items-center gap-3 py-6">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">מאמת את הקישור...</p>
            </div>
          )}

          {/* ── Invalid / expired ── */}
          {invalid && (
            <div className="flex flex-col items-center gap-3 py-4 text-center">
              <AlertCircle className="h-10 w-10 text-red-500" />
              <p className="font-semibold text-foreground">הקישור אינו תקין או פג תוקף</p>
              <p className="text-sm text-muted-foreground">בקש קישור חדש מדף ההתחברות</p>
              <Button
                className="mt-2 w-full bg-primary hover:bg-primary/90 text-primary-foreground"
                onClick={() => router.push('/login')}
              >
                חזרה לכניסה
              </Button>
            </div>
          )}

          {/* ── Success ── */}
          {success && (
            <div className="flex flex-col items-center gap-3 py-4 text-center">
              <CheckCircle2 className="h-10 w-10 text-emerald-500" />
              <p className="font-semibold text-foreground">הסיסמה עודכנה בהצלחה!</p>
              <p className="text-sm text-muted-foreground">מועבר לדף הכניסה...</p>
            </div>
          )}

          {/* ── Form ── */}
          {ready && !success && (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="mb-2">
                <p className="text-base font-semibold text-foreground">איפוס סיסמה</p>
                <p className="text-xs text-muted-foreground mt-0.5">הזן סיסמה חדשה לחשבונך</p>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="new-pass" className="text-foreground">סיסמה חדשה</Label>
                <div className="relative">
                  <Lock className={iconCls} />
                  <Input id="new-pass" type={showPass ? 'text' : 'password'} placeholder="לפחות 6 תווים"
                    className={cn(inputCls, 'pl-9')} value={password}
                    onChange={e => setPassword(e.target.value)} required autoFocus />
                  <button type="button" onClick={() => setShowPass(v => !v)}
                    className="absolute left-3 top-2.5 text-muted-foreground hover:text-foreground transition-colors">
                    {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="conf-pass" className="text-foreground">אימות סיסמה</Label>
                <div className="relative">
                  <Lock className={iconCls} />
                  <Input id="conf-pass" type={showConf ? 'text' : 'password'} placeholder="הזן שוב את הסיסמה"
                    className={cn(inputCls, 'pl-9')} value={confirm}
                    onChange={e => setConfirm(e.target.value)} required />
                  <button type="button" onClick={() => setShowConf(v => !v)}
                    className="absolute left-3 top-2.5 text-muted-foreground hover:text-foreground transition-colors">
                    {showConf ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {error && <p className="text-sm text-red-400 text-center">{error}</p>}

              <Button type="submit" className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-semibold" disabled={isLoading}>
                {isLoading && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}
                עדכן סיסמה
              </Button>

              <button type="button" onClick={() => router.push('/login')}
                className="w-full text-center text-xs text-muted-foreground hover:text-foreground transition-colors pt-1">
                חזרה לכניסה
              </button>
            </form>
          )}

        </div>
      </motion.div>
    </div>
  )
}

export default function ResetPasswordPage() {
  return (
    <Suspense>
      <ResetPasswordContent />
    </Suspense>
  )
}
