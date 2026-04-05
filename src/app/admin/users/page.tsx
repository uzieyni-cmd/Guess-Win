'use client'
import { useEffect, useState } from 'react'
import { Users, Save, CheckCircle2, Phone, Search, Trash2, Download, Shield, ShieldOff } from 'lucide-react'
import { useTournament } from '@/context/TournamentContext'
import { useAuth } from '@/context/AuthContext'
import { setUserRole } from '@/app/actions/roles'
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
  owner: '👑 בעלים',
  admin: '🛡 מנהל',
  tournament_admin: '⚙️ מנהל טורניר',
  user: 'משתמש',
}

const ROLE_COLOR: Record<UserRole, string> = {
  owner:            'text-yellow-400 bg-yellow-400/10 border-yellow-400/30',
  admin:            'text-blue-400 bg-blue-400/10 border-blue-400/30',
  tournament_admin: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/30',
  user:             'text-slate-400 bg-slate-700/40 border-slate-600/30',
}

export default function AdminUsersPage() {
  const { tournaments, updateUserPermissions } = useTournament()
  const { currentUser } = useAuth()
  const [users, setUsers]             = useState<FullUser[]>([])
  const [permissions, setPermissions] = useState<Record<string, string[]>>({})
  const [saved, setSaved]             = useState<string[]>([])
  const [search, setSearch]           = useState('')
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  const [roleMsg, setRoleMsg]         = useState('')

  const callerRole = currentUser?.role as UserRole

  const load = async () => {
    const { data: profiles } = await supabase
      .from('profiles')
      .select('*')

    if (!profiles) return

    const { data: participations } = await supabase
      .from('tournament_participants')
      .select('user_id, tournament_id')
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

    setUsers(mappedUsers)
    setPermissions(Object.fromEntries(mappedUsers.map((u) => [u.id, [...u.competitionIds]])))
  }

  useEffect(() => { load() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const toggle = (userId: string, tournamentId: string) => {
    setPermissions((prev) => {
      const current = prev[userId] ?? []
      const next = current.includes(tournamentId)
        ? current.filter((id) => id !== tournamentId)
        : [...current, tournamentId]
      return { ...prev, [userId]: next }
    })
  }

  const save = async (userId: string) => {
    await updateUserPermissions(userId, permissions[userId] ?? [])
    setSaved((prev) => [...prev, userId])
    setTimeout(() => setSaved((prev) => prev.filter((x) => x !== userId)), 2000)
  }

  const handleDelete = async (userId: string) => {
    await supabase.from('bets').delete().eq('user_id', userId)
    await supabase.from('tournament_participants').delete().eq('user_id', userId)
    await supabase.from('profiles').delete().eq('id', userId)
    setUsers((prev) => prev.filter((u) => u.id !== userId))
    setDeleteConfirm(null)
  }

  const handleSetRole = async (userId: string, newRole: UserRole) => {
    const res = await setUserRole(userId, newRole)
    if (res.ok) {
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, role: newRole } : u))
    } else {
      setRoleMsg(res.error ?? 'שגיאה')
      setTimeout(() => setRoleMsg(''), 3000)
    }
  }

  const exportExcel = async () => {
    const { utils, writeFile } = await import('xlsx')
    const rows = users.map((u) => {
      const base: Record<string, string> = {
        'שם פרטי':   u.firstName ?? '',
        'שם משפחה': u.lastName  ?? '',
        'מס טלפון': u.phone     ?? '',
        'מייל':     u.email,
        'תפקיד':    ROLE_LABEL[u.role] ?? u.role,
      }
      for (const t of tournaments) {
        base[t.name] = u.competitionIds.includes(t.id) ? '✓' : ''
      }
      return base
    })
    const ws = utils.json_to_sheet(rows)
    const wb = utils.book_new()
    utils.book_append_sheet(wb, ws, 'משתמשים')
    writeFile(wb, 'users.xlsx')
  }

  const filtered = users.filter((u) => {
    if (!search) return true
    const q = search.toLowerCase()
    return (
      u.displayName.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q) ||
      (u.firstName ?? '').toLowerCase().includes(q) ||
      (u.lastName  ?? '').toLowerCase().includes(q)
    )
  })

  return (
    <div className="p-6 max-w-2xl">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <Users className="h-5 w-5 text-blue-400" />
          <h1 className="font-suez text-2xl text-white">הרשאות משתמשים</h1>
          <span className="text-xs text-slate-500 mr-1">({users.length})</span>
        </div>
        <Button variant="outline" size="sm" onClick={exportExcel} className="flex items-center gap-1.5">
          <Download className="h-4 w-4" />
          ייצוא Excel
        </Button>
      </div>

      {roleMsg && (
        <div className="mb-4 p-3 rounded-lg text-sm bg-red-500/10 border border-red-500/20 text-red-400">
          {roleMsg}
        </div>
      )}

      <div className="relative mb-5">
        <Search className="absolute right-3 top-2.5 h-4 w-4 text-slate-500 pointer-events-none" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="חיפוש לפי שם, שם משפחה או מייל..."
          className="pr-9 bg-slate-800/60 border-slate-700 text-slate-100 placeholder:text-slate-500"
        />
      </div>

      {filtered.length === 0 && (
        <p className="text-center py-12 text-slate-500">
          {search ? 'לא נמצאו משתמשים' : 'אין משתמשים רשומים עדיין.'}
        </p>
      )}

      <div className="space-y-3">
        {filtered.map((user) => {
          const isOwner = user.role === 'owner'
          const isMe = user.id === currentUser?.id
          const canChangeRole = callerRole === 'owner' && !isOwner
          const canDelete = !isOwner && !isMe && callerRole === 'owner'

          return (
            <div key={user.id} className="rounded-xl bg-slate-800/50 border border-slate-700/40 overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700/30">
                <div className="flex items-center gap-3">
                  <Avatar>
                    <AvatarFallback className="bg-emerald-700 text-white font-bold text-sm">
                      {user.displayName.charAt(0)}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-slate-200">{user.displayName}</p>
                      <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border ${ROLE_COLOR[user.role]}`}>
                        {ROLE_LABEL[user.role]}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500">{user.email}</p>
                    {user.phone && (
                      <p className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
                        <Phone className="h-3 w-3" />{user.phone}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {/* Role toggle — owner only */}
                  {canChangeRole && (
                    <div className="flex items-center gap-1">
                      {user.role !== 'admin' && (
                        <button
                          onClick={() => handleSetRole(user.id, 'admin')}
                          className="p-1.5 rounded-lg text-slate-500 hover:text-blue-400 hover:bg-blue-400/10 transition-colors"
                          title="הגדר כמנהל"
                        >
                          <Shield className="h-4 w-4" />
                        </button>
                      )}
                      {user.role === 'admin' && (
                        <button
                          onClick={() => handleSetRole(user.id, 'user')}
                          className="p-1.5 rounded-lg text-blue-400 hover:text-slate-500 hover:bg-slate-700 transition-colors"
                          title="הסר הרשאת מנהל"
                        >
                          <ShieldOff className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  )}

                  <button
                    onClick={() => save(user.id)}
                    className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium transition-colors min-w-[64px] justify-center"
                  >
                    {saved.includes(user.id)
                      ? <><CheckCircle2 className="h-3.5 w-3.5" />נשמר</>
                      : <><Save className="h-3.5 w-3.5" />שמור</>}
                  </button>

                  {canDelete && (
                    deleteConfirm === user.id ? (
                      <div className="flex items-center gap-1">
                        <button onClick={() => handleDelete(user.id)}
                          className="text-xs px-2.5 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 text-white font-medium">
                          אישור
                        </button>
                        <button onClick={() => setDeleteConfirm(null)}
                          className="text-xs px-2.5 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-300">
                          ביטול
                        </button>
                      </div>
                    ) : (
                      <button onClick={() => setDeleteConfirm(user.id)}
                        className="p-1.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                        title="מחק משתמש">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )
                  )}
                </div>
              </div>

              {/* Tournament permissions — hide for owner/admin (they have all access) */}
              {user.role !== 'owner' && user.role !== 'admin' && (
                <div className="px-4 py-3">
                  <p className="text-xs text-slate-500 mb-2.5">גישה לתחרויות:</p>
                  <div className="space-y-2">
                    {tournaments.map((t) => (
                      <label key={t.id} className="flex items-center gap-2.5 cursor-pointer group">
                        <input
                          type="checkbox"
                          checked={(permissions[user.id] ?? []).includes(t.id)}
                          onChange={() => toggle(user.id, t.id)}
                          className="rounded border-slate-600 bg-slate-700 text-emerald-500 focus:ring-emerald-500 focus:ring-offset-0"
                        />
                        <span className="text-sm text-slate-300 group-hover:text-white transition-colors">{t.name}</span>
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
