'use client'
import { useEffect, useState } from 'react'
import { MessageSquare, Users, Coins, TrendingUp, Trophy, Calendar } from 'lucide-react'
import { getChatStats, ChatStatsResult } from '@/app/actions/chat-stats'

const DAYS_OPTIONS = [7, 14, 30, 90]

function fmt(n: number) { return n.toLocaleString('he-IL') }

export default function ChatStatsPage() {
  const [days, setDays] = useState(30)
  const [stats, setStats] = useState<ChatStatsResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    setError(null)
    getChatStats(days)
      .then(setStats)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [days])

  return (
    <div className="p-6 max-w-5xl">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-5 w-5 text-primary" />
          <h1 className="font-suez text-2xl text-foreground">שימושיות צ׳אט</h1>
        </div>
        <div className="flex gap-1">
          {DAYS_OPTIONS.map(d => (
            <button key={d} onClick={() => setDays(d)}
              className={`px-3 py-1.5 text-xs rounded-full font-medium transition-colors ${
                days === d
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:text-foreground'
              }`}>
              {d} ימים
            </button>
          ))}
        </div>
      </div>

      {loading && (
        <div className="flex justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      )}

      {error && (
        <div className="rounded-xl bg-red-50 border border-red-200 p-4 text-sm text-red-700">
          שגיאה: {error}
          <br />
          <span className="text-xs text-red-500">ייתכן שטבלת chat_logs עדיין לא קיימת — הרץ את migration/add_chat_logs.sql ב-Supabase</span>
        </div>
      )}

      {stats && !loading && (
        <div className="space-y-6">
          {/* KPI cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: 'הודעות סה"כ',   value: fmt(stats.totalMessages),            icon: MessageSquare, color: 'text-blue-600',   bg: 'bg-blue-500/10'   },
              { label: 'Tokens קלט',    value: fmt(stats.totalTokensIn),             icon: TrendingUp,    color: 'text-emerald-600', bg: 'bg-emerald-500/10' },
              { label: 'Tokens פלט',    value: fmt(stats.totalTokensOut),            icon: TrendingUp,    color: 'text-amber-600',   bg: 'bg-amber-500/10'  },
              { label: 'עלות משוערת',   value: `$${stats.estimatedCostUSD.toFixed(3)}`, icon: Coins,      color: 'text-rose-600',   bg: 'bg-rose-500/10'   },
            ].map(s => (
              <div key={s.label} className="rounded-xl bg-card border border-border p-4">
                <p className="text-xs text-muted-foreground mb-2">{s.label}</p>
                <div className="flex items-center gap-2">
                  <div className={`p-1.5 rounded-lg ${s.bg}`}>
                    <s.icon className={`h-4 w-4 ${s.color}`} />
                  </div>
                  <span className="text-2xl font-bold tabular-nums text-foreground">{s.value}</span>
                </div>
              </div>
            ))}
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            {/* By user */}
            <div className="rounded-xl bg-card border border-border p-4">
              <div className="flex items-center gap-2 mb-4">
                <Users className="h-4 w-4 text-primary" />
                <h2 className="font-semibold text-sm text-foreground">שימוש לפי משתמש</h2>
              </div>
              {stats.byUser.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">אין נתונים עדיין</p>
              ) : (
                <div className="space-y-2">
                  {stats.byUser.map((u, i) => (
                    <div key={u.user_id} className="flex items-center justify-between py-2 border-b border-border/40 last:border-0">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-xs text-muted-foreground w-5 shrink-0">{i + 1}.</span>
                        <p className="text-sm font-medium text-foreground truncate">{u.display_name}</p>
                      </div>
                      <div className="shrink-0 flex items-center gap-3 text-xs text-muted-foreground">
                        <span className="tabular-nums">{fmt(u.tokens_input + u.tokens_output)} tokens</span>
                        <span className="font-bold tabular-nums text-foreground bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                          {u.count} שאלות
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* By tournament */}
            <div className="rounded-xl bg-card border border-border p-4">
              <div className="flex items-center gap-2 mb-4">
                <Trophy className="h-4 w-4 text-primary" />
                <h2 className="font-semibold text-sm text-foreground">שימוש לפי טורניר</h2>
              </div>
              {stats.byTournament.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">אין נתונים עדיין</p>
              ) : (
                <div className="space-y-2">
                  {stats.byTournament.map((t, i) => (
                    <div key={t.tournament_id} className="flex items-center justify-between py-2 border-b border-border/40 last:border-0">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-xs text-muted-foreground w-5 shrink-0">{i + 1}.</span>
                        <p className="text-sm font-medium text-foreground truncate">{t.tournament_name}</p>
                      </div>
                      <span className="shrink-0 font-bold tabular-nums text-primary bg-primary/10 px-2 py-0.5 rounded-full text-xs">
                        {t.count} שאלות
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* By day */}
          <div className="rounded-xl bg-card border border-border p-4">
            <div className="flex items-center gap-2 mb-4">
              <Calendar className="h-4 w-4 text-primary" />
              <h2 className="font-semibold text-sm text-foreground">שאלות לפי יום</h2>
            </div>
            {stats.byDay.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">אין נתונים עדיין</p>
            ) : (
              <div className="space-y-2">
                {stats.byDay.map(d => {
                  const maxCount = Math.max(...stats.byDay.map(x => x.count))
                  const pct = maxCount > 0 ? (d.count / maxCount) * 100 : 0
                  const costDay =
                    (d.tokens_input / 1_000_000) * 3 +
                    (d.tokens_output / 1_000_000) * 15
                  return (
                    <div key={d.date} className="flex items-center gap-3">
                      <span className="text-xs text-muted-foreground w-20 shrink-0 tabular-nums">
                        {new Date(d.date).toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit' })}
                      </span>
                      <div className="flex-1 h-5 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full bg-gradient-to-l from-primary to-primary/70 transition-all duration-500"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className="text-xs font-bold tabular-nums text-foreground w-14 text-left shrink-0">
                        {d.count} שאלות
                      </span>
                      <span className="text-xs tabular-nums text-muted-foreground w-16 text-left shrink-0">
                        ${costDay.toFixed(4)}
                      </span>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          <p className="text-xs text-muted-foreground text-center">
            * עלות מחושבת לפי Perplexity sonar-pro: $3/M tokens קלט, $15/M tokens פלט
          </p>
        </div>
      )}
    </div>
  )
}
