'use client'

import { AuthProvider } from './AuthContext'
import { TournamentProvider } from './TournamentContext'

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <TournamentProvider>
        {children}
      </TournamentProvider>
    </AuthProvider>
  )
}
