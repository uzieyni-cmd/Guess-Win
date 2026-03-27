'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { Loader2, Mail, Lock, User, Eye, EyeOff } from 'lucide-react'
import Image from 'next/image'
import { useAuth } from '@/context/AuthContext'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

type Tab = 'login' | 'register'

export function LoginForm() {
  const { login, register, currentUser } = useAuth()
  const router = useRouter()

  // נווט אחרי שה-currentUser אכן נטען — לא מיד אחרי signIn
  useEffect(() => {
    if (currentUser) router.push('/competitions')
  }, [currentUser, router])

  const [tab, setTab] = useState<Tab>('login')
  const [email, setEmail]           = useState('')
  const [password, setPassword]     = useState('')
  const [confirmPass, setConfirmPass] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [error, setError]           = useState('')
  const [success, setSuccess]       = useState('')
  const [isLoading, setIsLoading]   = useState(false)
  const [showPassword, setShowPassword]   = useState(false)
  const [showConfirm, setShowConfirm]     = useState(false)

  const reset = () => {
    setError(''); setSuccess('')
    setEmail(''); setPassword(''); setConfirmPass(''); setDisplayName('')
  }

  const switchTab = (t: Tab) => { setTab(t); reset() }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(''); setIsLoading(true)
    try {
      await login(email, password)
      // ניווט דרך useEffect לעיל — ממתינים ש-currentUser יתעדכן
    } catch (err) {
      setError(err instanceof Error ? err.message : 'שגיאה בכניסה')
    } finally {
      setIsLoading(false)
    }
  }

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!displayName.trim()) { setError('נא להזין שם תצוגה'); return }
    if (password.length < 6)  { setError('הסיסמה חייבת להכיל לפחות 6 תווים'); return }
    if (password !== confirmPass) { setError('הסיסמאות אינן תואמות'); return }
    setIsLoading(true)
    try {
      await register(email, password, displayName.trim())
      setSuccess('נרשמת בהצלחה! בדוק את הדוא"ל שלך לאישור.')
      setPassword(''); setConfirmPass('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'שגיאה ברישום')
    } finally {
      setIsLoading(false)
    }
  }

  const inputCls = "bg-slate-800/60 border-slate-700 text-slate-100 placeholder:text-slate-500 focus-visible:ring-emerald-500 focus-visible:border-emerald-500 pr-9"
  const iconCls  = "absolute right-3 top-2.5 h-4 w-4 text-slate-500"

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
      <div className="rounded-2xl bg-slate-900/80 backdrop-blur-md border border-slate-700/50 shadow-2xl overflow-hidden">

        {/* Tabs */}
        <div className="flex border-b border-slate-700/50">
          {(['login', 'register'] as Tab[]).map(t => (
            <button
              key={t}
              onClick={() => switchTab(t)}
              className={cn(
                'flex-1 py-3 text-sm font-medium transition-all cursor-pointer',
                tab === t
                  ? 'text-emerald-400 border-b-2 border-emerald-400 -mb-px bg-emerald-500/5'
                  : 'text-slate-500 hover:text-slate-300'
              )}
            >
              {t === 'login' ? 'כניסה' : 'הרשמה'}
            </button>
          ))}
        </div>

        <div className="p-6">
          <AnimatePresence mode="wait">
            {tab === 'login' ? (
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
                  <Label htmlFor="login-email" className="text-slate-300">דוא&quot;ל</Label>
                  <div className="relative">
                    <Mail className={iconCls} />
                    <Input id="login-email" type="email" placeholder="you@example.com"
                      className={inputCls} value={email} onChange={e => setEmail(e.target.value)} required />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="login-password" className="text-slate-300">סיסמה</Label>
                  <div className="relative">
                    <Lock className={iconCls} />
                    <Input id="login-password" type={showPassword ? 'text' : 'password'} placeholder="••••••••"
                      className={cn(inputCls, 'pl-9')} value={password} onChange={e => setPassword(e.target.value)} required />
                    <button type="button" onClick={() => setShowPassword(v => !v)}
                      className="absolute left-3 top-2.5 text-slate-500 hover:text-slate-300 transition-colors">
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
                {error && <p className="text-sm text-red-400 text-center">{error}</p>}
                <Button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-semibold mt-2" disabled={isLoading}>
                  {isLoading && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}
                  כניסה
                </Button>
              </motion.form>
            ) : (
              <motion.form
                key="register"
                initial={{ opacity: 0, x: 16 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -16 }}
                transition={{ duration: 0.18 }}
                onSubmit={handleRegister}
                className="space-y-4"
              >
                <div className="space-y-1.5">
                  <Label htmlFor="reg-name" className="text-slate-300">שם תצוגה</Label>
                  <div className="relative">
                    <User className={iconCls} />
                    <Input id="reg-name" type="text" placeholder="השם שיופיע בלוח התוצאות"
                      className={inputCls} value={displayName} onChange={e => setDisplayName(e.target.value)} required />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="reg-email" className="text-slate-300">דוא&quot;ל</Label>
                  <div className="relative">
                    <Mail className={iconCls} />
                    <Input id="reg-email" type="email" placeholder="you@example.com"
                      className={inputCls} value={email} onChange={e => setEmail(e.target.value)} required />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="reg-password" className="text-slate-300">סיסמה</Label>
                  <div className="relative">
                    <Lock className={iconCls} />
                    <Input id="reg-password" type={showPassword ? 'text' : 'password'} placeholder="לפחות 6 תווים"
                      className={cn(inputCls, 'pl-9')} value={password} onChange={e => setPassword(e.target.value)} required />
                    <button type="button" onClick={() => setShowPassword(v => !v)}
                      className="absolute left-3 top-2.5 text-slate-500 hover:text-slate-300 transition-colors">
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="reg-confirm" className="text-slate-300">אימות סיסמה</Label>
                  <div className="relative">
                    <Lock className={iconCls} />
                    <Input id="reg-confirm" type={showConfirm ? 'text' : 'password'} placeholder="הזן שוב את הסיסמה"
                      className={cn(inputCls, 'pl-9')} value={confirmPass} onChange={e => setConfirmPass(e.target.value)} required />
                    <button type="button" onClick={() => setShowConfirm(v => !v)}
                      className="absolute left-3 top-2.5 text-slate-500 hover:text-slate-300 transition-colors">
                      {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
                {error   && <p className="text-sm text-red-400 text-center">{error}</p>}
                {success && <p className="text-sm text-emerald-400 text-center">{success}</p>}
                <Button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-semibold mt-2" disabled={isLoading}>
                  {isLoading && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}
                  הרשמה
                </Button>
              </motion.form>
            )}
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  )
}
