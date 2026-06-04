'use client'
import { useEffect, useState } from 'react'
import { Users, Save, CheckCircle2, Phone, Search, Trash2, Download, Settings, Trophy, CreditCard } from 'lucide-react'
import { useTournament } from '@/context/TournamentContext'
import { useAuth } from '@/context/AuthContext'
import { setUserRole, getMyAdminTournamentIds } from '@/app/actions/roles'
import { deleteUser, updateUserTournaments, setPaymentStatus } from '@/app/actions/users'
import { supabase } from '@/lib/supabase'
import { User, UserRole } from '@/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'

interface FullUser extends User {
  firstName?: string
  lastName?: string
}

const ROLE_LABEL: Record<UserRole, string> = {
  admin: '🛡 מנהל',
  tournament_admin: '⚙️ מנהל טורניר',
  user: 'משתמש',
}

const ROLE_COLOR: Record<UserRole, string> = {
  admin:            'text-blue-600 bg-blue-400/15 border-blue-500/30',
  tournament_admin: 'text-emerald-600 bg-emerald-400/15 border-emerald-500/30',
  user:             'text-muted-foreground bg-muted border-border',
}

type PaymentFilter = 'all' | 'paid' | 'unpaid'

export default function AdminUsersPage() {
  const { tournaments } = useTournament()
  const { currentUser, isProfileReady } = useAuth()
  const [users, setUsers]             = useState<FullUser[]>([])
  const [permissions, setPermissions] = useState<Record<string, string[]>>({})
  // payments: { [userId:tournamentId]: boolean }
  const [payments, setPayments]       = useState<Record<string, boolean>>({})
  const [saved, setSaved]             = useState<string[]>([])
  const [dirtySet, setDirtySet]       = useState<Set<string>>(new Set())
  const [savingAll, setSavingAll]     = useState(false)
  const [savedAll, setSavedAll]       = useState(false)
  const [search, setSearch]           = useState('')
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  const [roleMsg, setRoleMsg]         = useState('')
  const [myTournamentIds, setMyTournamentIds]   = useState<string[] | 'all'>('all')
  // activeFilters: Set of active filter keys ('none' = ללא טורניר, or a tournament id)
  const [activeFilters, setActiveFilters]       = useState<Set<string>>(new Set())
  const [filtersInitialized, setFiltersInitialized] = useState(false)
  const [paymentFilter, setPaymentFilter]       = useState<PaymentFilter>('all')

  const callerRole = (isProfileReady ? currentUser?.role : undefined) as UserRole | undefined
  const isFullAdmin = callerRole === 'admin'

  const visibleTournaments = myTournamentIds === 'all'
    ? tournaments
    : tournaments.filter(t => (myTournamentIds as string[]).includes(t.id))

  // Initialize all filters as active once tournaments are loaded
  useEffect(() => {
    if (!filtersInitialized && visibleTournaments.length > 0) {
      setActiveFilters(new Set(['none', ...visibleTournaments.map(t => t.id)]))
      setFiltersInitialized(true)
    }
  }, [visibleTournaments, filtersInitialized])

  const toggleFilter = (key: string) => {
    setActiveFilters(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
    setPaymentFilter('all')
  }

  const load = async () => {
    const { data: profiles } = await supabase.from('profiles').select('*')
    if (!profiles) return

    const { data: participations } = await supabase
      .from('tournament_participants')
      .select('user_id, tournament_id, paid')
      .in('user_id', profiles.map((p: { id: string }) => p.id))

    const mappedUsers: FullUser[] = profiles.map((p: {
      id: string; email: string; display_name: string; role: string;
      phone?: string; first_name?: string; last_name?: string
    }) => ({
      id: p.id,
      email: p.email,
      displayName: p.display_name,
      firstName: p.first_name ?? undefined,
      lastName: p.last_name ?? undefined,
      phone: p.phone ?? undefined,
      role: p.role as UserRole,
      competitionIds: participations
        ?.filter((x: { user_id: string }) => x.user_id === p.id)
        .map((x: { tournament_id: string }) => x.tournament_id) ?? [],
    }))

    const perms = Object.fromEntries(mappedUsers.map((u) => [u.id, [...u.competitionIds]]))
    setUsers(mappedUsers)
    setPermissions(perms)
    setDirtySet(new Set()) // reset on reload

    // build payments map
    const payMap: Record<string, boolean> = {}
    for (const row of (participations ?? []) as { user_id: string; tournament_id: string; paid: boolean }[]) {
      payMap[`${row.user_id}:${row.tournament_id}`] = row.paid ?? false
    }
    setPayments(payMap)
  }

  useEffect(() => {
    load()
    getMyAdminTournamentIds().then(setMyTournamentIds)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const toggle = (userId: string, tournamentId: string) => {
    setPermissions((prev) => {
      const current = prev[userId] ?? []
      const next = current.includes(tournamentId)
        ? current.filter((id) => id !== tournamentId)
        : [...current, tournamentId]
      return { ...prev, [userId]: next }
    })
    setDirtySet(prev => new Set([...prev, userId]))
  }

  const dirtyUserIds = [...dirtySet]

  const save = async (userId: string) => {
    const res = await updateUserTournaments(userId, permissions[userId] ?? [])
    if (res.ok) {
      setDirtySet(prev => { const next = new Set(prev); next.delete(userId); return next })
      setSaved((prev) => [...prev, userId])
      setTimeout(() => setSaved((prev) => prev.filter((x) => x !== userId)), 2000)
    } else {
      setRoleMsg(res.error ?? 'שגיאת שמירה')
      setTimeout(() => setRoleMsg(''), 3000)
    }
  }

  const saveAll = async () => {
    if (!dirtyUserIds.length || savingAll) return
    setSavingAll(true)
    const results = await Promise.all(dirtyUserIds.map(uid =>
      updateUserTournaments(uid, permissions[uid] ?? []).then(res => ({ uid, res }))
    ))
    const errors = results.filter(r => !r.res.ok)
    if (errors.length === 0) {
      setDirtySet(new Set())
      setSavedAll(true)
      setTimeout(() => setSavedAll(false), 2500)
    } else {
      setRoleMsg(`שגיאה בשמירת ${errors.length} משתמשים`)
      setTimeout(() => setRoleMsg(''), 3000)
    }
    setSavingAll(false)
  }

  const togglePaid = async (userId: string, tournamentId: string) => {
    const key = `${userId}:${tournamentId}`
    const current = payments[key] ?? false
    const next = !current
    // Optimistic update
    setPayments(prev => ({ ...prev, [key]: next }))
    const res = await setPaymentStatus(userId, tournamentId, next)
    if (!res.ok) {
      // Revert
      setPayments(prev => ({ ...prev, [key]: current }))
      setRoleMsg(res.error ?? 'שגיאת עדכון תשלום')
      setTimeout(() => setRoleMsg(''), 3000)
    }
  }

  const handleDelete = async (userId: string) => {
    const res = await deleteUser(userId)
    if (res.ok) {
      setUsers((prev) => prev.filter((u) => u.id !== userId))
    } else {
      setRoleMsg(res.error ?? 'שגיאת מחיקה')
      setTimeout(() => setRoleMsg(''), 3000)
    }
    setDeleteConfirm(null)
  }

  const handleSetRole = async (userId: string, newRole: UserRole) => {
    try {
      const res = await setUserRole(userId, newRole)
      if (res.ok) {
        setUsers(prev => prev.map(u => u.id === userId ? { ...u, role: newRole } : u))
      } else {
        setRoleMsg(res.error ?? 'שגיאה')
        setTimeout(() => setRoleMsg(''), 3000)
      }
    } catch (e) {
      setRoleMsg(e instanceof Error ? e.message : 'שגיאה לא צפויה')
      setTimeout(() => setRoleMsg(''), 3000)
    }
  }

  const exportExcel = async () => {
    const { utils, writeFile } = await import('xlsx')
    const rows = users.map((u) => {
      const base: Record<string, string> = {
        'שם תצוגה':  u.displayName,
        'שם פרטי':   u.firstName ?? '',
        'שם משפחה': u.lastName  ?? '',
        'מס טלפון': u.phone     ?? '',
        'מייל':     u.email,
        'תפקיד':    ROLE_LABEL[u.role] ?? u.role,
      }
      for (const t of tournaments) {
        const inTournament = u.competitionIds.includes(t.id)
        base[t.name] = inTournament ? '✓' : ''
        if (inTournament) {
          base[`${t.name} - שולם`] = payments[`${u.id}:${t.id}`] ? '✓' : ''
        }
      }
      return base
    })
    const ws = utils.json_to_sheet(rows)
    const wb = utils.book_new()
    utils.book_append_sheet(wb, ws, 'משתמשים')
    writeFile(wb, 'users.xlsx')
  }

  // Which tournament (if exactly one non-'none') is active — for payment filter & paid toggle
  const allFilterKeys = ['none', ...visibleTournaments.map(t => t.id)]
  const allActive = allFilterKeys.length > 0 && allFilterKeys.every(k => activeFilters.has(k))
  const activeTournamentOnly = !activeFilters.has('none') &&
    visibleTournaments.filter(t => activeFilters.has(t.id)).length === 1
      ? visibleTournaments.find(t => activeFilters.has(t.id))!.id
      : null

  const filtered = users.filter((u) => {
    // search filter
    if (search) {
      const q = search.toLowerCase()
      const matchesSearch =
        u.displayName.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        (u.firstName ?? '').toLowerCase().includes(q) ||
        (u.lastName  ?? '').toLowerCase().includes(q)
      if (!matchesSearch) return false
    }

    // tournament multi-filter — skip when all active
    if (!allActive && activeFilters.size > 0) {
      const hasNoTournament = u.competitionIds.length === 0
      const matchesNone       = activeFilters.has('none') && hasNoTournament
      const matchesTournament = u.competitionIds.some(id => activeFilters.has(id))
      if (!matchesNone && !matchesTournament) return false
    }

    // payment filter — only when exactly one tournament selected
    if (activeTournamentOnly && paymentFilter !== 'all') {
      const isPaid = payments[`${u.id}:${activeTournamentOnly}`] ?? false
      if (paymentFilter === 'paid'   && !isPaid) return false
      if (paymentFilter === 'unpaid' &&  isPaid) return false
    }

    return true
  })

  // stats — only for single tournament
  const tournamentStats = activeTournamentOnly ? (() => {
    const members = users.filter(u => u.competitionIds.includes(activeTournamentOnly))
    const paidCount = members.filter(u => payments[`${u.id}:${activeTournamentOnly}`]).length
    return { total: members.length, paid: paidCount, unpaid: members.length - paidCount }
  })() : null

  return (
    <div className="p-6 max-w-2xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <Users className="h-5 w-5 text-primary" />
          <h1 className="font-suez text-2xl text-foreground">הרשאות משתמשים</h1>
          <span className="text-xs text-muted-foreground mr-1">({users.length})</span>
        </div>
        <div className="flex items-center gap-2">
          {/* Save All button — only shown when there are unsaved changes */}
          {dirtyUserIds.length > 0 && (
            <Button
              size="sm"
              onClick={saveAll}
              disabled={savingAll}
              className="flex items-center gap-1.5"
            >
              {savingAll ? (
                <span className="h-3.5 w-3.5 rounded-full border-2 border-primary-foreground/40 border-t-primary-foreground animate-spin" />
              ) : (
                <Save className="h-3.5 w-3.5" />
              )}
              {savingAll ? 'שומר...' : `שמור הכל (${dirtyUserIds.length})`}
            </Button>
          )}
          {savedAll && (
            <span className="flex items-center gap-1 text-xs font-semibold text-emerald-600">
              <CheckCircle2 className="h-3.5 w-3.5" />נשמר
            </span>
          )}
          <Button variant="outline" size="sm" onClick={exportExcel} className="flex items-center gap-1.5">
            <Download className="h-4 w-4" />
            ייצוא Excel
          </Button>
        </div>
      </div>

      {roleMsg && (
        <div className="mb-4 p-3 rounded-lg text-sm bg-red-100 border border-red-300 text-red-700">
          {roleMsg}
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col gap-3 mb-5">
        {/* Search */}
        <div className="relative">
          <Search className="absolute right-3 top-2.5 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="חיפוש לפי שם, שם משפחה או מייל..."
            className="pr-9 bg-background border-border text-foreground placeholder:text-muted-foreground"
          />
        </div>

        {/* Tournament multi-select filter */}
        <div className="flex items-center gap-2 flex-wrap">
          <Trophy className="h-4 w-4 text-muted-foreground shrink-0" />
          {/* ללא טורניר */}
          <button
            onClick={() => toggleFilter('none')}
            className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
              activeFilters.has('none')
                ? 'bg-primary text-primary-foreground border-primary'
                : 'bg-background text-muted-foreground border-border hover:border-primary/50'
            }`}
          >
            ללא טורניר
          </button>
          {visibleTournaments.map(t => (
            <button
              key={t.id}
              onClick={() => toggleFilter(t.id)}
              className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                activeFilters.has(t.id)
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-background text-muted-foreground border-border hover:border-primary/50'
              }`}
            >
              {t.name}
            </button>
          ))}
        </div>

        {/* Payment filter + stats — only when exactly one tournament is selected */}
        {activeTournamentOnly && (
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <CreditCard className="h-4 w-4 text-muted-foreground shrink-0" />
              {(['all', 'paid', 'unpaid'] as PaymentFilter[]).map(f => (
                <button
                  key={f}
                  onClick={() => setPaymentFilter(f)}
                  className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                    paymentFilter === f
                      ? f === 'paid'   ? 'bg-emerald-600 text-white border-emerald-600'
                      : f === 'unpaid' ? 'bg-red-500 text-white border-red-500'
                      :                  'bg-primary text-primary-foreground border-primary'
                      : 'bg-background text-muted-foreground border-border hover:border-primary/50'
                  }`}
                >
                  {f === 'all' ? 'הכל' : f === 'paid' ? 'שולם' : 'לא שולם'}
                </button>
              ))}
            </div>

            {tournamentStats && (
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <span className="text-emerald-600 font-medium">✓ {tournamentStats.paid} שילמו</span>
                <span className="text-red-500 font-medium">✗ {tournamentStats.unpaid} לא שילמו</span>
                <span>סה״כ {tournamentStats.total}</span>
              </div>
            )}
          </div>
        )}
      </div>

      {filtered.length === 0 && (
        <p className="text-center py-12 text-muted-foreground">
          {search || !allActive ? 'לא נמצאו משתמשים' : 'אין משתמשים רשומים עדיין.'}
        </p>
      )}

      <div className="space-y-3">
        {filtered.map((user) => {
          const isMe = user.id === currentUser?.id
          const canSetTournamentAdmin = !isMe && callerRole === 'admin' && user.role !== 'admin'
          const canDelete = !isMe &&
            (callerRole === 'admin' || callerRole === 'tournament_admin') &&
            user.role !== 'admin'

          // paid status for the single active tournament (if any)
          const isPaid = activeTournamentOnly
            ? (payments[`${user.id}:${activeTournamentOnly}`] ?? false)
            : false

          return (
            <div key={user.id} className="rounded-xl bg-card border border-border overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-border/60">
                <div className="flex items-center gap-3">
                  <Avatar>
                    <AvatarFallback className="bg-primary text-primary-foreground font-bold text-sm">
                      {user.displayName.charAt(0)}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-foreground">{user.displayName}</p>
                      <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border ${ROLE_COLOR[user.role]}`}>
                        {ROLE_LABEL[user.role]}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">{user.email}</p>
                    {user.phone && (
                      <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                        <Phone className="h-3 w-3" />{user.phone}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {/* Paid toggle — visible only when exactly one tournament is selected */}
                  {activeTournamentOnly && user.role !== 'admin' && (
                    <button
                      onClick={() => togglePaid(user.id, activeTournamentOnly)}
                      className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border font-medium transition-colors min-w-[72px] justify-center ${
                        isPaid
                          ? 'bg-emerald-600 text-white border-emerald-600 hover:bg-emerald-700'
                          : 'bg-background text-muted-foreground border-border hover:border-emerald-500 hover:text-emerald-600'
                      }`}
                      title={isPaid ? 'שולם — לחץ לביטול' : 'לא שולם — לחץ לסימון'}
                    >
                      {isPaid ? <><CheckCircle2 className="h-3.5 w-3.5" />שולם</> : <>שולם?</>}
                    </button>
                  )}

                  {canSetTournamentAdmin && (
                    user.role === 'tournament_admin' ? (
                      <button
                        onClick={() => handleSetRole(user.id, 'user')}
                        aria-label="הסר הרשאת מנהל טורניר"
                        className="p-2 rounded-lg text-emerald-600 hover:text-muted-foreground hover:bg-muted transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
                      >
                        <Settings className="h-4 w-4" />
                      </button>
                    ) : (
                      <button
                        onClick={() => handleSetRole(user.id, 'tournament_admin')}
                        aria-label="הגדר כמנהל טורניר"
                        className="p-2 rounded-lg text-muted-foreground hover:text-emerald-600 hover:bg-emerald-50 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
                      >
                        <Settings className="h-4 w-4" />
                      </button>
                    )
                  )}

                  {user.role !== 'admin' && user.role !== 'tournament_admin' && (
                    <button
                      onClick={() => save(user.id)}
                      className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground font-medium transition-colors min-w-[64px] justify-center"
                    >
                      {saved.includes(user.id)
                        ? <><CheckCircle2 className="h-3.5 w-3.5" />נשמר</>
                        : <><Save className="h-3.5 w-3.5" />שמור</>}
                    </button>
                  )}

                  {canDelete && (
                    deleteConfirm === user.id ? (
                      <div className="flex items-center gap-1">
                        <button onClick={() => handleDelete(user.id)}
                          className="text-xs px-2.5 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 text-white font-medium">
                          אישור
                        </button>
                        <button onClick={() => setDeleteConfirm(null)}
                          className="text-xs px-2.5 py-1.5 rounded-lg bg-muted hover:bg-surface-deep text-muted-foreground">
                          ביטול
                        </button>
                      </div>
                    ) : (
                      <button onClick={() => setDeleteConfirm(user.id)}
                        aria-label="מחק משתמש"
                        className="p-2 rounded-lg text-muted-foreground hover:text-red-600 hover:bg-red-50 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )
                  )}
                </div>
              </div>

              {/* Tournament permissions */}
              {user.role !== 'admin' && user.role !== 'tournament_admin' && (
                <div className="px-4 py-3">
                  <p className="text-xs text-muted-foreground mb-2.5">גישה לתחרויות:</p>
                  <div className="space-y-2">
                    {visibleTournaments.map((t) => (
                      <label key={t.id} className="flex items-center gap-2.5 cursor-pointer group">
                        <input
                          type="checkbox"
                          checked={(permissions[user.id] ?? []).includes(t.id)}
                          onChange={() => toggle(user.id, t.id)}
                          className="rounded border-border bg-background text-primary focus:ring-primary focus:ring-offset-0"
                        />
                        <span className="text-sm text-muted-foreground group-hover:text-foreground transition-colors">{t.name}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
