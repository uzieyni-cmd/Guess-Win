'use client'
import { useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { LogOut, Settings, Trophy } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { useTournament } from '@/context/TournamentContext'
import { AuthGuard } from '@/components/auth/AuthGuard'
import { CompetitionCard } from '@/components/competitions/CompetitionCard'
import { SiteHeader } from '@/components/shared/SiteHeader'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'

function CompetitionsContent() {
  const { currentUser, logout, isProfileReady } = useAuth()
  const { tournaments, reload } = useTournament()
  const router = useRouter()

  useEffect(() => { reload() }, [reload])

  const myTournaments = useMemo(() => {
    if (!currentUser || !isProfileReady) return null
    // אדמין רואה את כל התחרויות (כולל מוסתרות)
    if (currentUser.role === 'admin') return tournaments
    // משתמש רגיל: רק תחרויות גלויות שהוא משתתף בהן
    return tournaments.filter((t) => !t.isHidden && currentUser.competitionIds.includes(t.id))
  }, [tournaments, currentUser, isProfileReady])

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#070b14] to-[#0d1b14]">
      <SiteHeader
        left={
          <button onClick={() => { logout(); router.push('/login') }}
            className="flex items-center gap-1.5 text-slate-400 hover:text-white transition-colors text-sm px-2 py-1.5 rounded-lg hover:bg-white/8 min-h-[36px]">
            <LogOut className="h-4 w-4" />
            <span className="hidden sm:inline">יציאה</span>
          </button>
        }
        right={
          <div className="flex items-center gap-2">
            {currentUser?.role === 'admin' && (
              <button onClick={() => router.push('/admin')}
                className="flex items-center gap-1.5 text-slate-400 hover:text-white transition-colors text-sm px-2 py-1.5 rounded-lg hover:bg-white/8 min-h-[36px]">
                <Settings className="h-4 w-4" />
                <span className="hidden sm:inline">ניהול</span>
              </button>
            )}
            <button onClick={() => router.push('/profile')}
              className="rounded-full hover:ring-2 hover:ring-emerald-400 transition-all">
              <Avatar className="h-8 w-8">
                <AvatarImage src={currentUser?.avatarUrl} />
                <AvatarFallback delayMs={0} className="bg-emerald-700 text-white text-sm font-bold">
                  {currentUser?.displayName?.charAt(0)?.toUpperCase() ?? '?'}
                </AvatarFallback>
              </Avatar>
            </button>
          </div>
        }
      />

      {/* Body */}
      <div className="max-w-2xl mx-auto px-4 py-8">
        <div className="animate-fade-in">
          <div className="mb-6">
            <h2 className="font-suez text-2xl text-white mb-1">
              שלום, {currentUser?.displayName}!
            </h2>
            <p className="text-emerald-300">בחרו תחרות לניחוש</p>
          </div>

          {myTournaments === null ? (
            <div className="flex justify-center py-16">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-emerald-400 border-t-transparent" />
            </div>
          ) : myTournaments.length === 0 ? (
            <div className="text-center py-16 text-emerald-300">
              <Trophy className="h-12 w-12 mx-auto mb-4 opacity-40" />
              <p>אין לך תחרויות עדיין.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {myTournaments.map((t, i) => (
                <CompetitionCard key={t.id} tournament={t} index={i} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default function CompetitionsPage() {
  return (
    <AuthGuard>
      <CompetitionsContent />
    </AuthGuard>
  )
}
