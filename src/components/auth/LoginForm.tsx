'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { Loader2, Mail, Lock, Trophy, User, Eye, EyeOff } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'

type Tab = 'login' | 'register'

export function LoginForm() {
  const { login, register } = useAuth()
  const router = useRouter()

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
      router.push('/competitions')
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

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="w-full max-w-md px-4"
    >
      <Card className="shadow-2xl border-0 bg-white/95 backdrop-blur-sm">
        <CardHeader className="text-center pb-2">
          <div className="flex justify-center mb-4">
            <div className="rounded-full bg-primary/10 p-4">
              <Trophy className="h-10 w-10 text-primary" />
            </div>
          </div>
          <CardTitle className="font-suez text-3xl text-gray-900">Guess&amp;Win</CardTitle>

          {/* Tabs */}
          <div className="flex mt-4 rounded-lg bg-muted p-1 gap-1">
            {(['login', 'register'] as Tab[]).map(t => (
              <button
                key={t}
                onClick={() => switchTab(t)}
                className={cn(
                  'flex-1 rounded-md py-1.5 text-sm font-medium transition-all cursor-pointer',
                  tab === t
                    ? 'bg-white shadow text-primary'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                {t === 'login' ? 'כניסה' : 'הרשמה'}
              </button>
            ))}
          </div>
        </CardHeader>

        <CardContent className="pt-4">
          <AnimatePresence mode="wait">
            {tab === 'login' ? (
              <motion.form
                key="login"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}
                onSubmit={handleLogin}
                className="space-y-4"
              >
                <div className="space-y-2">
                  <Label htmlFor="login-email">דוא"ל</Label>
                  <div className="relative">
                    <Mail className="absolute right-3 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="login-email"
                      type="email"
                      placeholder="you@example.com"
                      className="pr-9"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      required
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="login-password">סיסמה</Label>
                  <div className="relative">
                    <Lock className="absolute right-3 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="login-password"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="••••••••"
                      className="pr-9 pl-9"
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(v => !v)}
                      className="absolute left-3 top-2.5 text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
                {error && <p className="text-sm text-destructive text-center">{error}</p>}
                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}
                  כניסה
                </Button>
              </motion.form>
            ) : (
              <motion.form
                key="register"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}
                onSubmit={handleRegister}
                className="space-y-4"
              >
                <div className="space-y-2">
                  <Label htmlFor="reg-name">שם תצוגה</Label>
                  <div className="relative">
                    <User className="absolute right-3 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="reg-name"
                      type="text"
                      placeholder="השם שיופיע בלוח תוצאות"
                      className="pr-9"
                      value={displayName}
                      onChange={e => setDisplayName(e.target.value)}
                      required
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="reg-email">דוא"ל</Label>
                  <div className="relative">
                    <Mail className="absolute right-3 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="reg-email"
                      type="email"
                      placeholder="you@example.com"
                      className="pr-9"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      required
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="reg-password">סיסמה</Label>
                  <div className="relative">
                    <Lock className="absolute right-3 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="reg-password"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="לפחות 6 תווים"
                      className="pr-9 pl-9"
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(v => !v)}
                      className="absolute left-3 top-2.5 text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="reg-confirm">אימות סיסמה</Label>
                  <div className="relative">
                    <Lock className="absolute right-3 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="reg-confirm"
                      type={showConfirm ? 'text' : 'password'}
                      placeholder="הזן שוב את הסיסמה"
                      className="pr-9 pl-9"
                      value={confirmPass}
                      onChange={e => setConfirmPass(e.target.value)}
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirm(v => !v)}
                      className="absolute left-3 top-2.5 text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
                {error   && <p className="text-sm text-destructive text-center">{error}</p>}
                {success && <p className="text-sm text-green-600 text-center">{success}</p>}
                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}
                  הרשמה
                </Button>
              </motion.form>
            )}
          </AnimatePresence>
        </CardContent>
      </Card>
    </motion.div>
  )
}
