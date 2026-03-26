'use client'
import { useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import { Trophy, Users, LayoutDashboard, ArrowRight } from 'lucide-react'
import { AuthGuard } from '@/components/auth/AuthGuard'
import { useAuth } from '@/context/AuthContext'
import { cn } from '@/lib/utils'

const NAV_ITEMS = [
  { label: 'סקירה', href: '/admin', icon: LayoutDashboard },
  { label: 'תחרויות', href: '/admin/tournaments', icon: Trophy },
  { label: 'משתמשים', href: '/admin/users', icon: Users },
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
    <div className="min-h-screen bg-gray-100 flex">
      {/* Sidebar */}
      <aside className="hidden md:flex w-56 bg-white border-l flex-col">
        <div className="p-4 border-b">
          <div className="flex items-center gap-2">
            <Trophy className="h-5 w-5 text-indigo-600" />
            <span className="font-suez text-lg">לוח ניהול</span>
          </div>
        </div>
        <nav className="flex-1 p-3 space-y-1">
          {NAV_ITEMS.map((item) => {
            const isActive = item.href === '/admin' ? pathname === '/admin' : pathname.startsWith(item.href)
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                  isActive ? 'bg-indigo-50 text-indigo-700' : 'text-gray-600 hover:bg-gray-50'
                )}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </Link>
            )
          })}
        </nav>
        <div className="p-3 border-t">
          <Link
            href="/competitions"
            className="flex items-center justify-center gap-2 w-full px-3 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium transition-colors"
          >
            <ArrowRight className="h-4 w-4" />
            חזרה לאפליקציה
          </Link>
        </div>
      </aside>

      {/* Mobile nav */}
      <div className="md:hidden fixed bottom-0 inset-x-0 bg-white border-t flex z-20">
        {NAV_ITEMS.map((item) => {
          const isActive = item.href === '/admin' ? pathname === '/admin' : pathname.startsWith(item.href)
          return (
            <Link key={item.href} href={item.href} className={cn('flex-1 flex flex-col items-center py-2 text-xs gap-1', isActive ? 'text-indigo-600' : 'text-gray-500')}>
              <item.icon className="h-5 w-5" />
              {item.label}
            </Link>
          )
        })}
      </div>

      <main className="flex-1 overflow-auto pb-16 md:pb-0">
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
