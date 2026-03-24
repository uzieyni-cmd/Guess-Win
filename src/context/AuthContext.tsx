'use client'

import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { User } from '@/types'

interface AuthContextType {
  currentUser: User | null
  isLoading: boolean
  login: (email: string, password: string) => Promise<void>
  register: (email: string, password: string, displayName: string) => Promise<void>
  logout: () => void
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
    role: profile.role,
    competitionIds: participations?.map((p: { tournament_id: string }) => p.tournament_id) ?? [],
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    // בדוק session קיים
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session?.user) {
        const user = await loadProfile(session.user.id)
        setCurrentUser(user)
      }
      setIsLoading(false)
    })

    // האזן לשינויים ב-auth
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session?.user) {
        const user = await loadProfile(session.user.id)
        setCurrentUser(user)
      } else {
        setCurrentUser(null)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  const login = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw new Error('דוא"ל או סיסמה שגויים')
  }, [])

  const register = useCallback(async (email: string, password: string, displayName: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { display_name: displayName } },
    })
    if (error) throw new Error(error.message)
  }, [])

  const logout = useCallback(async () => {
    await supabase.auth.signOut()
    setCurrentUser(null)
  }, [])

  return (
    <AuthContext.Provider value={{ currentUser, isLoading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
