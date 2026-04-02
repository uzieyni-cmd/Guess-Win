'use client'
import { useEffect, useState } from 'react'
import { useParams, useRouter, usePathname } from 'next/navigation'
import { ArrowRight, Trophy, TrendingUp, User, Target, LogOut, Settings } from 'lucide-react'
import Link from 'next/link'
import { AuthGuard } from '@/components/auth/AuthGuard'
import { useTournament } from '@/context/TournamentContext'
import { useAuth } from '@/context/AuthContext'
import { SiteHeader } from '@/components/shared/SiteHeader'
import { cn } from '@/lib/utils'

const NAV_TABS = [
  { label: 'משחקים', href: 'matches', icon: Target },
  { label: 'דירוג', href: 'leaderboard', icon: Trophy },
  { label: 'סטטיסטיקה', href: 'stats', icon: TrendingUp },
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
    <div className="min-h-screen bg-[#070b14] flex flex-col">
      <SiteHeader
        left={
          <button onClick={() => router.push('/competitions')}
            className="flex items-center gap-1.5 text-slate-400 hover:text-white transition-colors px-2 py-1.5 rounded-lg hover:bg-white/8 min-h-[36px]">
            <ArrowRight className="h-4 w-4" />
            <span className="hidden sm:inline text-sm">חזרה</span>
          </button>
        }
        right={
          <div className="flex items-center gap-1">
            {currentUser?.role === 'admin' && (
              <button onClick={() => router.push(`/admin/tournaments/${id}`)}
                className="p-2 text-slate-400 hover:text-white transition-colors rounded-lg hover:bg-white/8 min-h-[36px]">
                <Settings className="h-4 w-4" />
              </button>
            )}
            <button onClick={() => { logout(); router.push('/login') }}
              className="p-2 text-slate-400 hover:text-white transition-colors rounded-lg hover:bg-white/8 min-h-[36px]">
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        }
        below={
          <div className="flex gap-0.5 border-t border-white/5">
            {NAV_TABS.map((tab) => {
              const isActive = pathname.endsWith(`/${tab.href}`)
              return (
                <Link key={tab.href} href={`/tournament/${id}/${tab.href}`}
                  className={cn(
                    'flex items-center gap-1.5 px-3 py-2.5 text-xs font-medium transition-colors border-b-2 whitespace-nowrap',
                    isActive
                      ? 'text-emerald-400 border-emerald-400'
                      : 'text-slate-500 border-transparent hover:text-slate-300 hover:border-slate-600'
                  )}>
                  <tab.icon className="h-3.5 w-3.5 shrink-0" />
                  {tab.label}
                </Link>
              )
            })}
          </div>
        }
      />

      {/* Content */}
      <div key={pathname} className="flex-1 max-w-[1600px] mx-auto w-full px-4 py-6 animate-fade-up">
        {children}
      </div>
    </div>
  )
}

export default function TournamentLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard>
      <TournamentShell>{children}</TournamentShell>
    </AuthGuard>
  )
}
