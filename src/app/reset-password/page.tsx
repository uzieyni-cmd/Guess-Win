'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Loader2, Lock, Eye, EyeOff, CheckCircle2, AlertCircle } from 'lucide-react'
import Image from 'next/image'
import { motion } from 'framer-motion'
import { supabase } from '@/lib/supabase'   // createBrowserClient — holds the PKCE verifier in cookies
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

function ResetPasswordContent() {
  const router       = useRouter()
  const searchParams = useSearchParams()
  const [ready, setReady]         = useState(false)
  const [invalid, setInvalid]     = useState(false)
  const [invalidMsg, setInvalidMsg] = useState('')
  const [password, setPassword]   = useState('')
  const [confirm, setConfirm]     = useState('')
  const [showPass, setShowPass]   = useState(false)
  const [showConf, setShowConf]   = useState(false)
  const [error, setError]         = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [success, setSuccess]     = useState(false)

  useEffect(() => {
    const code       = searchParams.get('code')
    const token_hash = searchParams.get('token_hash')
    const type       = searchParams.get('type')

    // ── PKCE code: must use the SAME client that generated the verifier ──
    // The verifier was stored in cookies by supabase (createBrowserClient)
    // when resetPasswordForEmail() was called. Using a different client
    // (e.g. one with localStorage) would fail with "verifier not found".
    if (code) {
      supabase.auth.exchangeCodeForSession(code).then(({ data, error }) => {
        if (error) {
          setInvalidMsg(error.message)
          setInvalid(true)
        } else if (!data.session) {
          setInvalidMsg('session empty after exchange')
          setInvalid(true)
        } else {
          setReady(true)
        }
      })
      return
    }

    if (token_hash && type) {
      supabase.auth.verifyOtp({ token_hash, type: type as 'recovery' | 'email' })
        .then(({ error }) => {
          if (error) { setInvalidMsg(error.message); setInvalid(true) }
          else setReady(true)
        })
      return
    }

    // No params — check existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) { setReady(true); return }
      const { data: { subscription } } = supabase.auth.onAuthStateChange((event, s) => {
        if ((event === 'PASSWORD_RECOVERY' || event === 'SIGNED_IN') && s) setReady(true)
      })
      const t = setTimeout(() => setInvalid(true), 6000)
      return () => { subscription.unsubscribe(); clearTimeout(t) }
    })
  }, [searchParams])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (password.length < 6)   { setError('הסיסמה חייבת להכיל לפחות 6 תווים'); return }
    if (password !== confirm)   { setError('הסיסמאות אינן תואמות'); return }

    setIsLoading(true)
    try {
      // Get access token from the current session
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) {
        setError('פג תוקף הסשן. שלח קישור איפוס חדש.')
        return
      }

      // Bypass supabase.auth.updateUser (hangs in @supabase/ssr) — call REST API directly
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/user`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
            'apikey': process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
          },
          body: JSON.stringify({ password }),
        }
      )

      const json = await res.json()

      if (!res.ok) {
        setError(json.message || json.error_description || JSON.stringify(json))
      } else {
        await supabase.auth.signOut()
        setSuccess(true)
        setTimeout(() => router.push('/login'), 2000)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
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

          {!ready && !invalid && !success && (
            <div className="flex flex-col items-center gap-3 py-6">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">מאמת את הקישור...</p>
            </div>
          )}

          {invalid && (
            <div className="flex flex-col items-center gap-3 py-4 text-center">
              <AlertCircle className="h-10 w-10 text-red-500" />
              <p className="font-semibold text-foreground">הקישור אינו תקין או פג תוקף</p>
              {invalidMsg && <p className="text-xs text-red-400 font-mono">{invalidMsg}</p>}
              <p className="text-sm text-muted-foreground">בקש קישור חדש מדף ההתחברות</p>
              <Button className="mt-2 w-full bg-primary hover:bg-primary/90 text-primary-foreground"
                onClick={() => router.push('/login')}>
                חזרה לכניסה
              </Button>
            </div>
          )}

          {success && (
            <div className="flex flex-col items-center gap-3 py-4 text-center">
              <CheckCircle2 className="h-10 w-10 text-emerald-500" />
              <p className="font-semibold text-foreground">הסיסמה עודכנה בהצלחה!</p>
              <p className="text-sm text-muted-foreground">מועבר לדף הכניסה...</p>
            </div>
          )}

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

              {error && <p className="text-sm text-red-400 text-center font-mono text-xs">{error}</p>}

              <Button type="submit" disabled={isLoading}
                className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-semibold">
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
