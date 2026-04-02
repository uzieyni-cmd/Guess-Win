'use client'

import { AuthProvider } from './AuthContext'
import { TournamentProvider } from './TournamentContext'
import { OfflineBanner } from '@/components/shared/OfflineBanner'

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <TournamentProvider>
        <OfflineBanner />
        {children}
      </TournamentProvider>
    </AuthProvider>
  )
}
