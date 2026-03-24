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
    <div className="p-6">
      <div className="flex items-center gap-2 mb-6">
        <Users className="h-5 w-5 text-indigo-600" />
        <h1 className="font-suez text-2xl">הרשאות משתמשים</h1>
      </div>

      {users.length === 0 && (
        <p className="text-center py-12 text-muted-foreground">אין משתמשים רשומים עדיין.</p>
      )}

      <div className="space-y-4">
        {users.map((user, i) => (
          <motion.div key={user.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}>
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Avatar>
                      <AvatarFallback className="bg-indigo-100 text-indigo-700 font-bold">
                        {user.displayName.charAt(0)}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <CardTitle className="text-sm">{user.displayName}</CardTitle>
                      <p className="text-xs text-muted-foreground">{user.email}</p>
                    </div>
                  </div>
                  <Button size="sm" onClick={() => save(user.id)}>
                    {saved.includes(user.id)
                      ? <CheckCircle2 className="h-4 w-4 text-green-500" />
                      : <><Save className="h-4 w-4 ml-1" />שמור</>
                    }
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <p className="text-xs text-muted-foreground mb-2">גישה לתחרויות:</p>
                <div className="space-y-2">
                  {tournaments.map((t) => (
                    <label key={t.id} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={(permissions[user.id] ?? []).includes(t.id)}
                        onChange={() => toggle(user.id, t.id)}
                        className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                      />
                      <span className="text-sm">{t.name}</span>
                    </label>
                  ))}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>
    </div>
  )
}
