'use client'
import { useEffect } from 'react'
import { useParams, useRouter, usePathname } from 'next/navigation'
import { motion } from 'framer-motion'
import { ArrowRight, Trophy, BarChart2, User, Target, LogOut, Settings } from 'lucide-react'
import Link from 'next/link'
import { AppProviders } from '@/context/AppProviders'
import { AuthGuard } from '@/components/auth/AuthGuard'
import { useTournament } from '@/context/TournamentContext'
import { useAuth } from '@/context/AuthContext'
import { cn } from '@/lib/utils'

const NAV_TABS = [
  { label: 'משחקים', href: 'matches', icon: Target },
  { label: 'דירוג', href: 'leaderboard', icon: BarChart2 },
  { label: 'סטטיסטיקה', href: 'stats', icon: BarChart2 },
  { label: 'הניחושים שלי', href: 'personal', icon: User },
]

function TournamentShell({ children }: { children: React.ReactNode }) {
  const params = useParams()
  const id = params.id as string
  const pathname = usePathname()
  const router = useRouter()
  const { setActiveTournamentId, activeTournament, tournaments } = useTournament()
  const { currentUser, logout } = useAuth()

  useEffect(() => {
    setActiveTournamentId(id)
  }, [id, setActiveTournamentId])

  const tournament = activeTournament ?? tournaments.find((t) => t.id === id)

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col">
      {/* Header */}
      <div className="bg-gradient-to-l from-indigo-700 to-purple-700 text-white sticky top-0 z-20">
        <div className="max-w-[1600px] mx-auto px-4 py-3">
          <div className="flex items-center gap-3">
            <button onClick={() => router.push('/competitions')} className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded hover:bg-white/10 transition-colors">
              <ArrowRight className="h-5 w-5" />
            </button>
            <div className="flex items-center gap-2 flex-1 min-w-0">
              {tournament?.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={tournament.logoUrl}
                  alt={tournament.name}
                  className="h-7 w-7 object-contain rounded shrink-0"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                />
              ) : (
                <Trophy className="h-5 w-5 shrink-0" />
              )}
              <span className="font-suez text-lg truncate">{tournament?.name ?? 'טורניר'}</span>
            </div>
            <div className="flex items-center gap-1">
              {currentUser?.role === 'admin' && (
                <button onClick={() => router.push(`/admin/tournaments/${id}`)} className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded hover:bg-white/10 transition-colors">
                  <Settings className="h-4 w-4" />
                </button>
              )}
              <button onClick={() => { logout(); router.push('/login') }} className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded hover:bg-white/10 transition-colors">
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          </div>
          {/* Tabs */}
          <div className="flex gap-1 mt-2 -mb-px">
            {NAV_TABS.map((tab) => {
              const isActive = pathname.endsWith(`/${tab.href}`)
              return (
                <Link
                  key={tab.href}
                  href={`/tournament/${id}/${tab.href}`}
                  className={cn(
                    'px-3 py-1.5 text-sm font-medium rounded-t transition-colors',
                    isActive
                      ? 'bg-white text-indigo-700'
                      : 'text-indigo-200 hover:text-white hover:bg-white/10'
                  )}
                >
                  {tab.label}
                </Link>
              )
            })}
          </div>
        </div>
      </div>

      {/* Content */}
      <motion.div
        key={pathname}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
        className="flex-1 max-w-[1600px] mx-auto w-full px-4 py-6"
      >
        {children}
      </motion.div>
    </div>
  )
}

export default function TournamentLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppProviders>
      <AuthGuard>
        <TournamentShell>{children}</TournamentShell>
      </AuthGuard>
    </AppProviders>
  )
}
