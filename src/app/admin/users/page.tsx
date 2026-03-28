'use client'
import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Users, Save, CheckCircle2 } from 'lucide-react'
import { useTournament } from '@/context/TournamentContext'
import { supabase } from '@/lib/supabase'
import { User } from '@/types'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'

export default function AdminUsersPage() {
  const { tournaments, updateUserPermissions } = useTournament()
  const [users, setUsers] = useState<User[]>([])
  const [permissions, setPermissions] = useState<Record<string, string[]>>({})
  const [saved, setSaved] = useState<string[]>([])

  useEffect(() => {
    const load = async () => {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('*')
        .neq('role', 'admin')

      if (!profiles) return

      const { data: participations } = await supabase
        .from('tournament_participants')
        .select('user_id, tournament_id')
        .in('user_id', profiles.map((p: { id: string }) => p.id))

      const mappedUsers: User[] = profiles.map((p: { id: string; email: string; display_name: string; role: string }) => ({
        id: p.id,
        email: p.email,
        displayName: p.display_name,
        role: p.role as User['role'],
        competitionIds: participations
          ?.filter((x: { user_id: string }) => x.user_id === p.id)
          .map((x: { tournament_id: string }) => x.tournament_id) ?? [],
      }))

      setUsers(mappedUsers)
      setPermissions(Object.fromEntries(mappedUsers.map((u) => [u.id, [...u.competitionIds]])))
    }
    load()
  }, [])

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

  return (
    <div className="p-6 max-w-2xl">
      <div className="flex items-center gap-2 mb-6">
        <Users className="h-5 w-5 text-blue-400" />
        <h1 className="font-suez text-2xl text-white">הרשאות משתמשים</h1>
      </div>

      {users.length === 0 && (
        <p className="text-center py-12 text-slate-500">אין משתמשים רשומים עדיין.</p>
      )}

      <div className="space-y-3">
        {users.map((user, i) => (
          <motion.div key={user.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }}>
            <div className="rounded-xl bg-slate-800/50 border border-slate-700/40 overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700/30">
                <div className="flex items-center gap-3">
                  <Avatar>
                    <AvatarFallback className="bg-emerald-700 text-white font-bold text-sm">
                      {user.displayName.charAt(0)}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="text-sm font-medium text-slate-200">{user.displayName}</p>
                    <p className="text-xs text-slate-500">{user.email}</p>
                  </div>
                </div>
                <button onClick={() => save(user.id)}
                  className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium transition-colors min-w-[64px] justify-center">
                  {saved.includes(user.id)
                    ? <><CheckCircle2 className="h-3.5 w-3.5" />נשמר</>
                    : <><Save className="h-3.5 w-3.5" />שמור</>
                  }
                </button>
              </div>
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
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  )
}
