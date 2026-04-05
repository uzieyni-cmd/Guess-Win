'use client'

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { User } from '@/types'

interface AuthContextType {
  currentUser: User | null
  isLoading: boolean
  /** true once the full DB profile (role, competitionIds, etc.) has been fetched */
  isProfileReady: boolean
  login: (email: string, password: string) => Promise<void>
  register: (email: string, password: string, firstName: string, lastName: string, phone?: string) => Promise<void>
  logout: () => void
  refreshUser: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | null>(null)

async function loadProfile(userId: string): Promise<User | null> {
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single()

  if (!profile) return null

  const { data: participations } = await supabase
    .from('tournament_participants')
    .select('tournament_id')
    .eq('user_id', userId)

  return {
    id: profile.id,
    email: profile.email,
    displayName: profile.display_name,
    firstName: profile.first_name ?? undefined,
    lastName: profile.last_name ?? undefined,
    avatarUrl: profile.avatar_url ?? undefined,
    phone: profile.phone ?? undefined,
    role: profile.role,
    competitionIds: participations?.map((p: { tournament_id: string }) => p.tournament_id) ?? [],
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isProfileReady, setIsProfileReady] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)
  const hasInitialized = useRef(false)
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ── Idle logout — 10 דקות ללא פעילות ───────────────────────────
  useEffect(() => {
    const IDLE_MS = 10 * 60 * 1000
    const EVENTS = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll', 'click']

    const resetTimer = () => {
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current)
      idleTimerRef.current = setTimeout(async () => {
        await supabase.auth.signOut()
      }, IDLE_MS)
    }

    // התחל timer רק אם יש משתמש מחובר
    if (!currentUser) {
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current)
      return
    }

    resetTimer()
    EVENTS.forEach(e => window.addEventListener(e, resetTimer, { passive: true }))

    return () => {
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current)
      EVENTS.forEach(e => window.removeEventListener(e, resetTimer))
    }
  }, [currentUser])

  useEffect(() => {
    let mounted = true

    // Safety valve: unblock UI if auth events never fire (network issue, etc.)
    const safetyTimeout = setTimeout(() => {
      if (!hasInitialized.current && mounted) {
        hasInitialized.current = true
        setIsLoading(false)
      }
    }, 5_000)

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return
      if (event === 'TOKEN_REFRESHED') return

      if (!hasInitialized.current) {
        // ── First event (INITIAL_SESSION on page load / refresh) ──────────
        // Unblock the UI immediately — do NOT wait for DB profile queries.
        clearTimeout(safetyTimeout)
        hasInitialized.current = true

        if (!session?.user) {
          setCurrentUser(null)
          setUserId(null)
          setIsProfileReady(true) // no profile to load
          setIsLoading(false)
          return
        }

        // Authenticated: construct a minimal user from the session so the UI
        // can render instantly while the full profile loads in the background.
        const { user } = session
        setUserId(user.id)
        setCurrentUser({
          id: user.id,
          email: user.email ?? '',
          displayName:
            (user.user_metadata?.display_name as string | undefined) ??
            user.email?.split('@')[0] ??
            '',
          avatarUrl: undefined,
          role: 'user',       // conservative default — overwritten by profile
          competitionIds: [], // populated once profile loads
        })
        setIsLoading(false) // ← spinner gone, page renders immediately

        // Enrich with full profile data (role, avatar, competitionIds) in background
        loadProfile(user.id)
          .then(full => {
            if (mounted && full) setCurrentUser(full)
          })
          .catch(() => { /* keep minimal user on error */ })
          .finally(() => { if (mounted) setIsProfileReady(true) })

      } else {
        // ── Subsequent events (SIGNED_IN after login, SIGNED_OUT, etc.) ───
        if (session?.user) {
          setUserId(session.user.id)
          setIsProfileReady(false)
          try {
            const user = await loadProfile(session.user.id)
            if (mounted) setCurrentUser(user)
          } catch {
            if (mounted) setCurrentUser(null)
          } finally {
            if (mounted) setIsProfileReady(true)
          }
        } else {
          setUserId(null)
          setCurrentUser(null)
          setIsProfileReady(true)
        }
      }
    })

    return () => {
      mounted = false
      clearTimeout(safetyTimeout)
      subscription.unsubscribe()
    }
  }, [])

  const login = useCallback(async (email: string, password: string) => {
    const { error, data } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw new Error('דוא"ל או סיסמה שגויים')
    // Guard: if auth succeeded but profile row is missing, sign out and surface a clear error
    if (data.user) {
      const { data: profile } = await supabase
        .from('profiles').select('id').eq('id', data.user.id).single()
      if (!profile) {
        await supabase.auth.signOut()
        throw new Error('החשבון אינו מוגדר במערכת. פנה למנהל.')
      }
    }
  }, [])

  const register = useCallback(async (email: string, password: string, firstName: string, lastName: string, phone?: string) => {
    const displayName = `${firstName.trim()} ${lastName.trim()}`.trim()
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { display_name: displayName, first_name: firstName.trim(), last_name: lastName.trim() } },
    })
    if (error) throw new Error(error.message)
    // Update phone if provided (trigger creates profile first)
    if (phone?.trim() && data.user) {
      await supabase.from('profiles').update({ phone: phone.trim() }).eq('id', data.user.id)
    }
  }, [])

  const logout = useCallback(async () => {
    await supabase.auth.signOut()
    setCurrentUser(null)
    setUserId(null)
  }, [])

  const refreshUser = useCallback(async () => {
    if (!userId) return
    const user = await loadProfile(userId)
    setCurrentUser(user)
  }, [userId])

  return (
    <AuthContext.Provider value={{ currentUser, isLoading, isProfileReady, login, register, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
