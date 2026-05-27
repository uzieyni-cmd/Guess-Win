'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Loader2, Lock, Eye, EyeOff, CheckCircle2, AlertCircle } from 'lucide-react'
import Image from 'next/image'
import { motion } from 'framer-motion'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

type Stage = 'loading' | 'form' | 'success' | 'invalid'

function ResetPasswordContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [stage, setStage]           = useState<Stage>('loading')
  const [password, setPassword]     = useState('')
  const [confirm, setConfirm]       = useState('')
  const [showPass, setShowPass]     = useState(false)
  const [showConf, setShowConf]     = useState(false)
  const [error, setError]           = useState('')
  const [isLoading, setIsLoading]   = useState(false)

  useEffect(() => {
    const code       = searchParams.get('code')
    const token_hash = searchParams.get('token_hash')
    const type       = searchParams.get('type')

    // ── Option A: PKCE code in URL — exchange client-side ────────────
    if (code) {
      supabase.auth.exchangeCodeForSession(code)
        .then(({ error }) => {
          if (error) { setError('קישור לא תקין: ' + error.message); setStage('invalid') }
          else setStage('form')
        })
      return
    }

    // ── Option B: token_hash in URL (older flow) ──────────────────────
    if (token_hash && type) {
      supabase.auth.verifyOtp({ token_hash, type: type as 'recovery' | 'email' })
        .then(({ error }) => {
          if (error) { setError('קישור לא תקין: ' + error.message); setStage('invalid') }
          else setStage('form')
        })
      return
    }

    // ── Option C: session already set (e.g. navigated back) ──────────
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) { setStage('form'); return }
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session && (event === 'PASSWORD_RECOVERY' || event === 'SIGNED_IN' || event === 'INITIAL_SESSION')) {
        setStage('form')
      }
      if (event === 'SIGNED_OUT') setStage('invalid')
    })

    const t = setTimeout(() => setStage(s => s === 'loading' ? 'invalid' : s), 5000)
    return () => { subscription.unsubscribe(); clearTimeout(t) }
  }, [searchParams])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (password.length < 6) { setError('הסיסמה חייבת להכיל לפחות 6 תווים'); return }
    if (password !== confirm) { setError('הסיסמאות אינן תואמות'); return }

    setIsLoading(true)

    // Timeout of 10s so the spinner never hangs forever
    const timeoutId = setTimeout(() => {
      setError('הבקשה לא הגיבה. נסה שנית.')
      setIsLoading(false)
    }, 10_000)

    try {
      // Verify session exists before attempting update
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        clearTimeout(timeoutId)
        setError('פג תוקף הסשן. שלח קישור איפוס חדש.')
        setIsLoading(false)
        return
      }

      const { error } = await supabase.auth.updateUser({ password })
      clearTimeout(timeoutId)

      if (error) {
        setError(
          error.message.includes('same password') || error.message.includes('different')
            ? 'הסיסמה החדשה זהה לסיסמה הנוכחית. בחר סיסמה שונה.'
            : error.message
        )
      } else {
        // Sign out the recovery session so the user must log in fresh
        await supabase.auth.signOut()
        setStage('success')
        setTimeout(() => router.push('/login'), 2000)
      }
    } catch (err) {
      clearTimeout(timeoutId)
      setError(err instanceof Error ? err.message : 'שגיאה בעדכון הסיסמה. נסה שנית.')
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
        {/* Logo */}
        <div className="flex justify-center mb-6">
          <Image src="/logo.svg" alt="Guess&Win" width={90} height={105} priority />
        </div>

        <div className="rounded-2xl bg-card/90 backdrop-blur-md border border-border/50 shadow-2xl p-6">

          {/* ── Loading ── */}
          {stage === 'loading' && (
            <div className="flex flex-col items-center gap-3 py-6">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">מאמת את הקישור...</p>
            </div>
          )}

          {/* ── Invalid / expired ── */}
          {stage === 'invalid' && (
            <div className="flex flex-col items-center gap-3 py-4 text-center">
              <AlertCircle className="h-10 w-10 text-red-500" />
              <p className="font-semibold text-foreground">הקישור אינו תקין או פג תוקף</p>
              {error && <p className="text-sm text-red-400">{error}</p>}
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
          {stage === 'success' && (
            <div className="flex flex-col items-center gap-3 py-4 text-center">
              <CheckCircle2 className="h-10 w-10 text-emerald-500" />
              <p className="font-semibold text-foreground">הסיסמה עודכנה בהצלחה!</p>
              <p className="text-sm text-muted-foreground">מועבר לדף הכניסה...</p>
            </div>
          )}

          {/* ── Form ── */}
          {stage === 'form' && (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="mb-2">
                <p className="text-base font-semibold text-foreground">איפוס סיסמה</p>
                <p className="text-xs text-muted-foreground mt-0.5">הזן סיסמה חדשה לחשבונך</p>
              </div>

              {/* New password */}
              <div className="space-y-1.5">
                <Label htmlFor="new-pass" className="text-foreground">סיסמה חדשה</Label>
                <div className="relative">
                  <Lock className={iconCls} />
                  <Input
                    id="new-pass"
                    type={showPass ? 'text' : 'password'}
                    placeholder="לפחות 6 תווים"
                    className={cn(inputCls, 'pl-9')}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    required
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass(v => !v)}
                    className="absolute left-3 top-2.5 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {/* Confirm password */}
              <div className="space-y-1.5">
                <Label htmlFor="conf-pass" className="text-foreground">אימות סיסמה</Label>
                <div className="relative">
                  <Lock className={iconCls} />
                  <Input
                    id="conf-pass"
                    type={showConf ? 'text' : 'password'}
                    placeholder="הזן שוב את הסיסמה"
                    className={cn(inputCls, 'pl-9')}
                    value={confirm}
                    onChange={e => setConfirm(e.target.value)}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowConf(v => !v)}
                    className="absolute left-3 top-2.5 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {showConf ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {error && <p className="text-sm text-red-400 text-center">{error}</p>}

              <Button
                type="submit"
                className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-semibold"
                disabled={isLoading}
              >
                {isLoading && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}
                עדכן סיסמה
              </Button>

              <button
                type="button"
                onClick={() => router.push('/login')}
                className="w-full text-center text-xs text-muted-foreground hover:text-foreground transition-colors pt-1"
              >
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
