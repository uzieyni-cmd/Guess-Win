'use client'
import { useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { LogOut, Settings, Trophy } from 'lucide-react'
import Image from 'next/image'
import { useAuth } from '@/context/AuthContext'
import { useTournament } from '@/context/TournamentContext'
import { AuthGuard } from '@/components/auth/AuthGuard'
import { CompetitionCard } from '@/components/competitions/CompetitionCard'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'

function CompetitionsContent() {
  const { currentUser, logout } = useAuth()
  const { tournaments, reload } = useTournament()
  const router = useRouter()

  useEffect(() => { reload() }, [reload])

  const myTournaments = useMemo(() => {
    if (!currentUser) return []
    // אדמין רואה את כל התחרויות (כולל מוסתרות)
    if (currentUser.role === 'admin') return tournaments
    // משתמש רגיל: רק תחרויות גלויות שהוא משתתף בהן
    return tournaments.filter((t) => !t.isHidden && currentUser.competitionIds.includes(t.id))
  }, [tournaments, currentUser])

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0a0e1a] to-[#0d1b14]">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-[#0a0e1a]/80 backdrop-blur-md border-b border-white/10">
        <div className="max-w-2xl mx-auto px-4 py-2 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Image src="/logo.svg" alt="Guess&Win" width={64} height={75} priority />
            <div className="flex flex-col leading-tight">
              <span className="text-white font-black text-lg tracking-widest uppercase">GUESS</span>
              <span className="text-yellow-400 font-black text-base tracking-widest uppercase">&amp; WIN</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {currentUser?.role === 'admin' && (
              <Button variant="ghost" size="sm" className="text-white hover:text-white hover:bg-white/10" onClick={() => router.push('/admin')}>
                <Settings className="h-4 w-4 ml-1" />
                ניהול
              </Button>
            )}
            <button onClick={() => router.push('/profile')} className="rounded-full hover:ring-2 hover:ring-emerald-400 transition-all">
              <Avatar className="h-8 w-8">
                <AvatarImage src={currentUser?.avatarUrl} />
                <AvatarFallback delayMs={0} className="bg-emerald-600 text-white text-sm font-bold">
                  {currentUser?.displayName?.charAt(0)?.toUpperCase() ?? '?'}
                </AvatarFallback>
              </Avatar>
            </button>
            <Button variant="ghost" size="sm" className="text-white hover:text-white hover:bg-white/10" onClick={() => { logout(); router.push('/login') }}>
              <LogOut className="h-4 w-4 ml-1" />
              יציאה
            </Button>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="max-w-2xl mx-auto px-4 py-8">
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <div className="mb-6">
            <h2 className="font-suez text-2xl text-white mb-1">
              שלום, {currentUser?.displayName}!
            </h2>
            <p className="text-emerald-300">בחרו תחרות לניחוש</p>
          </div>

          {myTournaments.length === 0 ? (
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
        </motion.div>
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
