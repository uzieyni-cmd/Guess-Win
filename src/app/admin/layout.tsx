'use client'
import { useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import { Trophy, Users, LayoutDashboard, ArrowRight } from 'lucide-react'
import { AuthGuard } from '@/components/auth/AuthGuard'
import { useAuth } from '@/context/AuthContext'
import { SiteHeader } from '@/components/shared/SiteHeader'
import { cn } from '@/lib/utils'

const NAV_ITEMS = [
  { label: 'סקירה',     href: '/admin',              icon: LayoutDashboard },
  { label: 'תחרויות',  href: '/admin/tournaments',  icon: Trophy },
  { label: 'משתמשים',  href: '/admin/users',         icon: Users },
]

function AdminShell({ children }: { children: React.ReactNode }) {
  const { currentUser } = useAuth()
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    if (currentUser && currentUser.role !== 'admin') {
      router.replace('/competitions')
    }
  }, [currentUser, router])

  if (currentUser?.role !== 'admin') return null

  return (
    <div className="min-h-screen bg-[#070b14] flex flex-col">
      <SiteHeader
        left={
          <Link href="/competitions"
            className="flex items-center gap-1.5 text-slate-400 hover:text-white transition-colors text-sm px-2 py-1.5 rounded-lg hover:bg-white/8 min-h-[36px]">
            <ArrowRight className="h-4 w-4" />
            <span className="hidden sm:inline">חזרה</span>
          </Link>
        }
        below={
          <div className="flex gap-0.5 border-t border-white/5">
            {NAV_ITEMS.map((item) => {
              const isActive = item.href === '/admin' ? pathname === '/admin' : pathname.startsWith(item.href)
              return (
                <Link key={item.href} href={item.href}
                  className={cn(
                    'flex items-center gap-1.5 px-3 py-2.5 text-xs font-medium transition-colors border-b-2 whitespace-nowrap',
                    isActive
                      ? 'text-emerald-400 border-emerald-400'
                      : 'text-slate-500 border-transparent hover:text-slate-300 hover:border-slate-600'
                  )}>
                  <item.icon className="h-3.5 w-3.5" />
                  {item.label}
                </Link>
              )
            })}
          </div>
        }
      />

      {/* Content */}
      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  )
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard>
      <AdminShell>{children}</AdminShell>
    </AuthGuard>
  )
}
