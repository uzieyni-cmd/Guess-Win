'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { Loader2, Mail, Lock, User, Phone, Eye, EyeOff, CheckCircle2 } from 'lucide-react'
import Image from 'next/image'
import { useAuth } from '@/context/AuthContext'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

type Tab = 'login' | 'register' | 'forgot'

export function LoginForm() {
  const { login, register, currentUser } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (currentUser) router.push('/competitions')
  }, [currentUser, router])

  const [tab, setTab] = useState<Tab>('login')
  const [email, setEmail]             = useState('')
  const [password, setPassword]       = useState('')
  const [confirmPass, setConfirmPass] = useState('')
  const [firstName, setFirstName]     = useState('')
  const [lastName, setLastName]       = useState('')
  const [phone, setPhone]             = useState('')
  const [error, setError]             = useState('')
  const [success, setSuccess]         = useState('')
  const [isLoading, setIsLoading]     = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm]   = useState(false)
  const [rememberMe, setRememberMe]     = useState(false)

  useEffect(() => {
    const saved = localStorage.getItem('gw_saved_email')
    if (saved) { setEmail(saved); setRememberMe(true) }
  }, [])

  const reset = () => {
    setError(''); setSuccess('')
    setEmail(''); setPassword(''); setConfirmPass('')
    setFirstName(''); setLastName(''); setPhone('')
  }

  const switchTab = (t: Tab) => { setTab(t); reset() }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(''); setIsLoading(true)
    try {
      await login(email, password)
      if (rememberMe) {
        localStorage.setItem('gw_saved_email', email)
      } else {
        localStorage.removeItem('gw_saved_email')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'שגיאה בכניסה')
    } finally {
      setIsLoading(false)
    }
  }

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!firstName.trim()) { setError('נא להזין שם פרטי'); return }
    if (!lastName.trim())  { setError('נא להזין שם משפחה'); return }
    if (password.length < 6)  { setError('הסיסמה חייבת להכיל לפחות 6 תווים'); return }
    if (password !== confirmPass) { setError('הסיסמאות אינן תואמות'); return }
    setIsLoading(true)
    try {
      await register(email, password, firstName.trim(), lastName.trim(), phone.trim() || undefined)
      setSuccess('נרשמת בהצלחה! בדוק את הדוא"ל שלך לאישור.')
      setPassword(''); setConfirmPass('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'שגיאה ברישום')
    } finally {
      setIsLoading(false)
    }
  }

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(''); setIsLoading(true)
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`,
      })
      if (error) throw new Error(error.message)
      setSuccess('נשלח אליך מייל לאיפוס הסיסמה. בדוק את תיבת הדואר שלך.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'שגיאה בשליחת המייל')
    } finally {
      setIsLoading(false)
    }
  }

  const inputCls = "bg-background border-border text-foreground placeholder:text-muted-foreground focus-visible:ring-primary focus-visible:border-primary pr-9"
  const iconCls  = "absolute right-3 top-2.5 h-4 w-4 text-muted-foreground"

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45 }}
      className="w-full max-w-sm px-4"
    >
      {/* Logo */}
      <div className="flex flex-col items-center mb-6">
        <Image src="/logo.svg" alt="Guess&Win" width={110} height={128} priority />
      </div>

      {/* Card */}
      <div className="rounded-2xl bg-card/90 backdrop-blur-md border border-border/50 shadow-2xl overflow-hidden">

        {/* Tabs (login + register only — forgot is inline) */}
        {tab !== 'forgot' && (
          <div className="flex border-b border-border/50">
            {(['login', 'register'] as Tab[]).map(t => (
              <button
                key={t}
                onClick={() => switchTab(t)}
                className={cn(
                  'flex-1 py-3 text-sm font-medium transition-all cursor-pointer',
                  tab === t
                    ? 'text-primary border-b-2 border-primary -mb-px bg-primary/5'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                {t === 'login' ? 'כניסה' : 'הרשמה'}
              </button>
            ))}
          </div>
        )}

        <div className="p-6">
          <AnimatePresence mode="wait">

            {/* ── Login ── */}
            {tab === 'login' && (
              <motion.form
                key="login"
                initial={{ opacity: 0, x: 16 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -16 }}
                transition={{ duration: 0.18 }}
                onSubmit={handleLogin}
                className="space-y-4"
              >
                <div className="space-y-1.5">
                  <Label htmlFor="login-email" className="text-foreground">דוא&quot;ל</Label>
                  <div className="relative">
                    <Mail className={iconCls} />
                    <Input id="login-email" type="email" placeholder="you@example.com"
                      className={inputCls} value={email} onChange={e => setEmail(e.target.value)} required />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="login-password" className="text-foreground">סיסמה</Label>
                  <div className="relative">
                    <Lock className={iconCls} />
                    <Input id="login-password" type={showPassword ? 'text' : 'password'} placeholder="••••••••"
                      className={cn(inputCls, 'pl-9')} value={password} onChange={e => setPassword(e.target.value)} required />
                    <button type="button" onClick={() => setShowPassword(v => !v)}
                      className="absolute left-3 top-2.5 text-muted-foreground hover:text-foreground transition-colors">
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
                <label className="flex items-center gap-2.5 cursor-pointer select-none group w-fit">
                  <div
                    onClick={() => setRememberMe(v => !v)}
                    className={cn(
                      'h-4 w-4 rounded border transition-all shrink-0 flex items-center justify-center',
                      rememberMe
                        ? 'bg-primary border-primary'
                        : 'border-border bg-background group-hover:border-primary/60'
                    )}
                  >
                    {rememberMe && (
                      <svg viewBox="0 0 10 8" className="h-2.5 w-2.5 text-primary-foreground" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M1 4l2.5 2.5L9 1" />
                      </svg>
                    )}
                  </div>
                  <span
                    onClick={() => setRememberMe(v => !v)}
                    className="text-xs text-muted-foreground group-hover:text-foreground transition-colors"
                  >
                    זכור אותי
                  </span>
                </label>
                {error && <p className="text-sm text-red-400 text-center">{error}</p>}
                <Button type="submit" className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-semibold mt-2" disabled={isLoading}>
                  {isLoading && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}
                  כניסה
                </Button>
                <button
                  type="button"
                  onClick={() => switchTab('forgot')}
                  className="w-full text-center text-xs text-muted-foreground hover:text-primary transition-colors pt-1"
                >
                  שכחתי סיסמה
                </button>
              </motion.form>
            )}

            {/* ── Register ── */}
            {tab === 'register' && (
              <motion.form
                key="register"
                initial={{ opacity: 0, x: 16 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -16 }}
                transition={{ duration: 0.18 }}
                onSubmit={handleRegister}
                className="space-y-4"
              >
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="reg-firstname" className="text-foreground">שם פרטי</Label>
                    <div className="relative">
                      <User className={iconCls} />
                      <Input id="reg-firstname" type="text" placeholder="ישראל"
                        className={inputCls} value={firstName} onChange={e => setFirstName(e.target.value)} required />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="reg-lastname" className="text-foreground">שם משפחה</Label>
                    <div className="relative">
                      <User className={iconCls} />
                      <Input id="reg-lastname" type="text" placeholder="ישראלי"
                        className={inputCls} value={lastName} onChange={e => setLastName(e.target.value)} required />
                    </div>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="reg-phone" className="text-foreground">מספר טלפון <span className="text-muted-foreground text-xs">(אופציונלי)</span></Label>
                  <div className="relative">
                    <Phone className={iconCls} />
                    <Input id="reg-phone" type="tel" placeholder="050-0000000" dir="ltr"
                      className={inputCls} value={phone} onChange={e => setPhone(e.target.value)} />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="reg-email" className="text-foreground">דוא&quot;ל</Label>
                  <div className="relative">
                    <Mail className={iconCls} />
                    <Input id="reg-email" type="email" placeholder="you@example.com"
                      className={inputCls} value={email} onChange={e => setEmail(e.target.value)} required />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="reg-password" className="text-foreground">סיסמה</Label>
                  <div className="relative">
                    <Lock className={iconCls} />
                    <Input id="reg-password" type={showPassword ? 'text' : 'password'} placeholder="לפחות 6 תווים"
                      className={cn(inputCls, 'pl-9')} value={password} onChange={e => setPassword(e.target.value)} required />
                    <button type="button" onClick={() => setShowPassword(v => !v)}
                      className="absolute left-3 top-2.5 text-muted-foreground hover:text-foreground transition-colors">
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="reg-confirm" className="text-foreground">אימות סיסמה</Label>
                  <div className="relative">
                    <Lock className={iconCls} />
                    <Input id="reg-confirm" type={showConfirm ? 'text' : 'password'} placeholder="הזן שוב את הסיסמה"
                      className={cn(inputCls, 'pl-9')} value={confirmPass} onChange={e => setConfirmPass(e.target.value)} required />
                    <button type="button" onClick={() => setShowConfirm(v => !v)}
                      className="absolute left-3 top-2.5 text-muted-foreground hover:text-foreground transition-colors">
                      {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
                {error   && <p className="text-sm text-red-400 text-center">{error}</p>}
                {success && <p className="text-sm text-primary text-center">{success}</p>}
                <Button type="submit" className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-semibold mt-2" disabled={isLoading}>
                  {isLoading && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}
                  הרשמה
                </Button>
              </motion.form>
            )}

            {/* ── Forgot password ── */}
            {tab === 'forgot' && (
              <motion.div
                key="forgot"
                initial={{ opacity: 0, x: 16 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -16 }}
                transition={{ duration: 0.18 }}
              >
                <p className="text-foreground text-sm mb-4 text-center">הזן את כתובת הדוא&quot;ל שלך ונשלח לך קישור לאיפוס הסיסמה</p>
                {success ? (
                  <div className="flex flex-col items-center gap-3 py-2">
                    <CheckCircle2 className="h-10 w-10 text-primary" />
                    <p className="text-emerald-600 text-sm text-center">{success}</p>
                    <button
                      type="button"
                      onClick={() => switchTab('login')}
                      className="text-xs text-muted-foreground hover:text-foreground transition-colors mt-2"
                    >
                      חזרה לכניסה
                    </button>
                  </div>
                ) : (
                  <form onSubmit={handleForgotPassword} className="space-y-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="forgot-email" className="text-foreground">דוא&quot;ל</Label>
                      <div className="relative">
                        <Mail className={iconCls} />
                        <Input id="forgot-email" type="email" placeholder="you@example.com"
                          className={inputCls} value={email} onChange={e => setEmail(e.target.value)} required />
                      </div>
                    </div>
                    {error && <p className="text-sm text-red-400 text-center">{error}</p>}
                    <Button type="submit" className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-semibold" disabled={isLoading}>
                      {isLoading && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}
                      שלח קישור לאיפוס
                    </Button>
                    <button
                      type="button"
                      onClick={() => switchTab('login')}
                      className="w-full text-center text-xs text-muted-foreground hover:text-foreground transition-colors pt-1"
                    >
                      חזרה לכניסה
                    </button>
                  </form>
                )}
              </motion.div>
            )}

          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  )
}
