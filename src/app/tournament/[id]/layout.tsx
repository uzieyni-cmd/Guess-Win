'use client'
import { useEffect, useState } from 'react'
import { useParams, useRouter, usePathname } from 'next/navigation'
import { ArrowRight, Trophy, TrendingUp, Target, LogOut, Settings, TableProperties, Gift, ScrollText, Award } from 'lucide-react'
import Link from 'next/link'
import { AuthGuard } from '@/components/auth/AuthGuard'
import { useTournament } from '@/context/TournamentContext'
import { useAuth } from '@/context/AuthContext'
import { SiteHeader } from '@/components/shared/SiteHeader'
import { ChatBot } from '@/components/shared/ChatBot'
import { BonusCountdownBanner } from '@/components/tournament/BonusCountdownBanner'
import { cn } from '@/lib/utils'

const NAV_TABS = [
  { label: 'משחקים', href: 'matches', icon: Target },
  { label: 'דירוג', href: 'leaderboard', icon: Trophy },
  { label: 'טבלה', href: 'standings', icon: TableProperties },
  { label: 'בונוס', href: 'bonus', icon: Gift },
  { label: 'סטטיסטיקת בונוס', href: 'bonus-stats', icon: Award },
  { label: 'סטטיסטיקה', href: 'stats', icon: TrendingUp },
  { label: 'תקנון', href: 'rules', icon: ScrollText },
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
    <div className="min-h-screen bg-base flex flex-col">
      <SiteHeader
        left={
          <button onClick={() => router.push('/competitions')}
            className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors px-2 py-1.5 rounded-lg hover:bg-foreground/8 min-h-[36px]">
            <ArrowRight className="h-4 w-4" />
            <span className="hidden sm:inline text-sm">חזרה</span>
          </button>
        }
        right={
          <div className="flex items-center gap-1">
            {currentUser?.role === 'admin' && (
              <button onClick={() => router.push(`/admin/tournaments/${id}`)}
                aria-label="ניהול תחרות"
                className="p-2 text-muted-foreground hover:text-foreground transition-colors rounded-lg hover:bg-foreground/8 min-h-[44px] min-w-[44px] flex items-center justify-center">
                <Settings className="h-4 w-4" />
              </button>
            )}
            <button onClick={async () => { await logout(); router.push('/login') }}
              aria-label="יציאה"
              className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors rounded-lg hover:bg-foreground/8 min-h-[44px]">
              <LogOut className="h-4 w-4 shrink-0" />
              <span>יציאה</span>
            </button>
          </div>
        }
        below={
          <div className="relative border-t border-border/30">
            <div className="flex gap-0.5 overflow-x-auto scrollbar-none">
              {NAV_TABS.map((tab) => {
                const isActive = pathname.endsWith(`/${tab.href}`)
                return (
                  <Link key={tab.href} href={`/tournament/${id}/${tab.href}`}
                    className={cn(
                      'flex items-center gap-1.5 px-3 py-2.5 text-xs font-medium transition-colors border-b-2 whitespace-nowrap',
                      isActive
                        ? 'text-primary border-primary'
                        : 'text-muted-foreground border-transparent hover:text-foreground hover:border-border'
                    )}>
                    <tab.icon className="h-3.5 w-3.5 shrink-0" />
                    {tab.label}
                  </Link>
                )
              })}
            </div>
            {/* רמז גלילה — מעיד שיש עוד טאבים מעבר לקצה הנראה */}
            <div className="pointer-events-none absolute inset-y-0 left-0 w-6 bg-gradient-to-r from-base to-transparent" />
            <div className="pointer-events-none absolute inset-y-0 right-0 w-6 bg-gradient-to-l from-base to-transparent" />
          </div>
        }
      />

      {/* Content */}
      <div key={pathname} className="flex-1 max-w-[1600px] mx-auto w-full px-4 py-6 animate-fade-up">
        {/* תזכורת בונוס פתוח — בכל הלשוניות חוץ מלשונית הבונוס עצמה (שם כבר יש שעון) */}
        {!pathname.endsWith('/bonus') && <BonusCountdownBanner tournamentId={id} />}
        {children}
      </div>

      <ChatBot tournamentId={id} />
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
