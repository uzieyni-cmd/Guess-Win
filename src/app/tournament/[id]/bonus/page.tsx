'use client'
import { useEffect, useState, useTransition, useRef } from 'react'
import { useParams } from 'next/navigation'
import { Gift, Lock, CheckCircle2, ChevronDown, Search, X, Timer, ChevronRight, Users } from 'lucide-react'
import { getBonusQuestions, getMyBonusPicks, submitBonusPick, getPicksDistribution } from '@/app/actions/bonus'
import type { PickDistribution, PickDistributionSlice } from '@/app/actions/bonus'
import { BonusQuestion, BonusPick } from '@/types'
import { cn } from '@/lib/utils'
import { AnimatePresence, motion } from 'framer-motion'

// ── Palette for pie slices ───────────────────────────────────────
const SLICE_COLORS = [
  '#6366f1', // indigo (primary)
  '#f59e0b', // amber
  '#10b981', // emerald
  '#f43f5e', // rose
  '#8b5cf6', // violet
  '#0ea5e9', // sky
  '#f97316', // orange
  '#14b8a6', // teal
]

// ── SVG Pie Chart ────────────────────────────────────────────────
function PieChart({
  slices,
  total,
  activeIndex,
  onSliceClick,
}: {
  slices: PickDistributionSlice[]
  total: number
  activeIndex: number | null
  onSliceClick: (i: number) => void
}) {
  if (total === 0 || slices.length === 0) return null

  const cx = 60, cy = 60, r = 52
  let angle = -Math.PI / 2 // start top

  const paths = slices.map((s, i) => {
    const pct = s.count / total
    const sweep = pct * 2 * Math.PI
    const x1 = cx + r * Math.cos(angle)
    const y1 = cy + r * Math.sin(angle)
    angle += sweep
    const x2 = cx + r * Math.cos(angle)
    const y2 = cy + r * Math.sin(angle)
    const largeArc = sweep > Math.PI ? 1 : 0
    const d = `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2} Z`
    return { d, color: SLICE_COLORS[i % SLICE_COLORS.length], pct, index: i }
  })

  return (
    <svg viewBox="0 0 120 120" className="w-[100px] h-[100px] shrink-0" aria-hidden>
      {paths.map(({ d, color, index }) => (
        <path
          key={index}
          d={d}
          fill={color}
          opacity={activeIndex === null || activeIndex === index ? 1 : 0.35}
          className="cursor-pointer transition-opacity duration-200"
          onClick={() => onSliceClick(index)}
          style={{ filter: activeIndex === index ? 'brightness(1.15)' : undefined }}
        />
      ))}
      {/* center hole */}
      <circle cx={cx} cy={cy} r={22} className="fill-card" />
      {/* center total */}
      <text x={cx} y={cy + 1} textAnchor="middle" dominantBaseline="middle"
        className="fill-foreground" fontSize={13} fontWeight={700}>
        {total}
      </text>
      <text x={cx} y={cy + 13} textAnchor="middle" dominantBaseline="middle"
        className="fill-muted-foreground" fontSize={7}>
        בחרו
      </text>
    </svg>
  )
}

// ── Users Panel (slide-down) ─────────────────────────────────────
function UsersPanel({
  slices,
  activeIndex,
  onClose,
}: {
  slices: PickDistributionSlice[]
  activeIndex: number | null
  onClose: () => void
}) {
  const displaySlices = activeIndex !== null ? [{ ...slices[activeIndex], colorIndex: activeIndex }] : slices.map((s, i) => ({ ...s, colorIndex: i }))

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.22, ease: 'easeOut' }}
      className="overflow-hidden"
    >
      <div className="mt-3 rounded-xl border border-border bg-surface-deep overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-3 py-2 border-b border-border/50">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Users className="h-3.5 w-3.5" />
            {activeIndex !== null ? (
              <span>
                <span className="font-semibold text-foreground">{slices[activeIndex].option}</span>
                {' '}— {slices[activeIndex].count} בחרו
              </span>
            ) : (
              <span>חלוקת בחירות</span>
            )}
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground p-0.5">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        <div className="divide-y divide-border/40 max-h-64 overflow-y-auto scrollbar-none">
          {displaySlices.map(({ option, users, colorIndex }) => (
            <div key={option}>
              {activeIndex === null && (
                <div className="flex items-center gap-2 px-3 py-2 bg-muted/30">
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ background: SLICE_COLORS[colorIndex % SLICE_COLORS.length] }}
                  />
                  <span className="text-xs font-semibold text-foreground">{option}</span>
                  <span className="text-xs text-muted-foreground mr-auto">{users.length}</span>
                </div>
              )}
              <div className="px-3 py-1.5 flex flex-wrap gap-2">
                {users.length === 0 ? (
                  <span className="text-xs text-muted-foreground py-1">אין בחירות</span>
                ) : users.map(u => (
                  <div key={u.id} className="flex items-center gap-1.5">
                    <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center text-[9px] font-bold text-primary-foreground shrink-0">
                      {u.displayName.charAt(0).toUpperCase()}
                    </div>
                    <span className="text-xs text-foreground">{u.displayName}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  )
}

// ── Countdown hook ───────────────────────────────────────────────
function useCountdown(lockTime: string) {
  const getRemaining = () => {
    const diff = new Date(lockTime).getTime() - Date.now()
    if (diff <= 0) return null
    const totalSec = Math.floor(diff / 1000)
    return {
      days:    Math.floor(totalSec / 86400),
      hours:   Math.floor((totalSec % 86400) / 3600),
      minutes: Math.floor((totalSec % 3600) / 60),
      seconds: totalSec % 60,
      totalSec,
    }
  }
  const [remaining, setRemaining] = useState(getRemaining)
  useEffect(() => {
    const id = setInterval(() => setRemaining(getRemaining()), 1000)
    return () => clearInterval(id)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lockTime])
  return remaining
}

// ── Hero countdown banner ────────────────────────────────────────
function HeroCountdown({ lockTime }: { lockTime: string }) {
  const r = useCountdown(lockTime)
  const pad = (n: number) => String(n).padStart(2, '0')

  if (!r) {
    return (
      <div className="w-full rounded-2xl bg-foreground px-6 py-8 text-center mb-6">
        <Lock className="h-8 w-8 text-muted-foreground/60 mx-auto mb-2" />
        <p className="font-suez text-lg text-white/60">הבחירות נסגרו</p>
      </div>
    )
  }

  const urgent  = r.totalSec < 5 * 60
  const warning = r.totalSec < 60 * 60
  const blocks  = [
    { value: String(r.days), label: 'ימים' },
    { value: pad(r.hours),   label: 'שעות' },
    { value: pad(r.minutes), label: 'דקות' },
    { value: pad(r.seconds), label: 'שניות' },
  ]

  return (
    <div className={cn('w-full rounded-2xl px-6 py-7 mb-6 transition-colors duration-1000', urgent ? 'bg-destructive/90' : 'bg-foreground')}>
      <p className={cn('text-center text-sm font-medium mb-5 tracking-wide', urgent ? 'text-white/80' : 'text-white/50')}>
        סגירת הבחירות בעוד
      </p>
      <div className="flex justify-center gap-3 sm:gap-6" dir="ltr">
        {blocks.map(({ value, label }) => (
          <div key={label} className="flex flex-col items-center gap-1.5 min-w-[52px]">
            <span className={cn('font-condensed tabular-nums leading-none',
              urgent  ? 'text-white text-5xl sm:text-6xl font-black'
              : warning ? 'text-amber-400 text-5xl sm:text-6xl font-black'
              : 'text-primary text-5xl sm:text-6xl font-black'
            )}>
              {value}
            </span>
            <span className={cn('text-xs tracking-widest uppercase', urgent ? 'text-white/70' : 'text-white/40')}>
              {label}
            </span>
          </div>
        ))}
      </div>
      {warning && !urgent && <p className="text-center text-xs text-amber-400/80 mt-4 animate-pulse">פחות משעה — מהרו להגיש!</p>}
      {urgent  && <p className="text-center text-xs text-white/80 mt-4 animate-pulse font-semibold">פחות מ-5 דקות — מהרו!</p>}
    </div>
  )
}

// ── Mini saved toast ─────────────────────────────────────────────
function SavedBadge({ show }: { show: boolean }) {
  return (
    <span className={cn(
      'inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-2 py-0.5 transition-all duration-300',
      show ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-1 pointer-events-none'
    )}>
      <CheckCircle2 className="h-3 w-3" />נשמר
    </span>
  )
}

// ── Drilldown panel (pre-lock) ───────────────────────────────────
function DrilldownPanel({ options, selected, correct, isLocked, isPending, onSelect, onClose }: {
  options: string[]; selected: string | undefined; correct: string[] | null
  isLocked: boolean; isPending: boolean
  onSelect: (opt: string) => void; onClose: () => void
}) {
  const [query, setQuery] = useState('')
  const filtered = query.trim() ? options.filter(o => o.toLowerCase().includes(query.toLowerCase())) : options

  return (
    <div className="mt-3 rounded-xl border border-border bg-surface-deep overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border/50">
        <Search className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        <input value={query} onChange={e => setQuery(e.target.value)} placeholder="חיפוש..."
          className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none" dir="rtl" />
        {query && <button onClick={() => setQuery('')} className="text-muted-foreground hover:text-foreground"><X className="h-3.5 w-3.5" /></button>}
      </div>
      <div className="max-h-56 overflow-y-auto py-1 scrollbar-none overscroll-y-contain">
        {filtered.length === 0 ? (
          <p className="text-center text-xs text-muted-foreground py-4">אין תוצאות</p>
        ) : filtered.map(opt => {
          const isSelected = selected === opt
          const isCorrect  = !!correct?.length && correct.includes(opt)
          const isWrong    = !!correct?.length && isSelected && !isCorrect
          return (
            <button key={opt} disabled={isLocked || isPending} onClick={() => { onSelect(opt); onClose() }}
              className={cn('w-full text-right px-4 py-2.5 text-sm flex items-center justify-between gap-3 transition-colors',
                isCorrect ? 'bg-primary/20 text-primary'
                : isWrong ? 'bg-destructive/20 text-destructive line-through'
                : isSelected ? 'bg-primary/10 text-primary'
                : isLocked ? 'text-muted-foreground cursor-default'
                : 'text-foreground hover:bg-foreground/8'
              )}
            >
              <span className="flex-1 truncate">{opt}</span>
              {isCorrect && <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />}
              {isSelected && !isCorrect && !isWrong && <span className="w-2 h-2 rounded-full bg-primary shrink-0" />}
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ── Question Card ────────────────────────────────────────────────
function QuestionCard({ q, pick, dist, isPending, savedId, errorId, onPick }: {
  q: BonusQuestion
  pick: BonusPick | undefined
  dist: PickDistribution | undefined
  isPending: boolean
  savedId: string | null
  errorId: string | null
  onPick: (q: BonusQuestion, opt: string) => void
}) {
  const [open, setOpen]             = useState(false)
  const [panelOpen, setPanelOpen]   = useState(false)
  const [activeSlice, setActiveSlice] = useState<number | null>(null)

  const isLocked   = new Date() >= new Date(q.lockTime)
  const hasResult  = !!(q.correctOptions?.length)
  const selected   = pick?.pick
  const justSaved  = savedId === q.id
  const hasError   = errorId === q.id

  const total = dist?.slices.reduce((s, sl) => s + sl.count, 0) ?? 0

  const handleSliceClick = (i: number) => {
    setActiveSlice(prev => prev === i ? null : i)
    setPanelOpen(true)
  }

  const handleDetailsClick = () => {
    setActiveSlice(null)
    setPanelOpen(v => !v)
  }

  // ── Locked state ────────────────────────────────────────────────
  if (isLocked) {
    const won = hasResult && selected && q.correctOptions!.includes(selected)
    const lost = hasResult && selected && !won

    return (
      <div className="bg-card border border-border rounded-2xl p-4 space-y-4">
        {/* Header */}
        <div className="flex items-start justify-between gap-2">
          <p className="font-semibold text-foreground leading-snug flex-1">{q.question}</p>
          <div className="flex items-center gap-1.5 shrink-0">
            <Lock className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-xs font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full">{q.points} נק'</span>
          </div>
        </div>

        {/* User's pick */}
        {selected ? (
          <div className={cn(
            'flex items-center justify-between gap-3 px-4 py-3 rounded-xl border',
            won  ? 'bg-emerald-500/10 border-emerald-500/40'
            : lost ? 'bg-destructive/8 border-destructive/30'
            : 'bg-muted/50 border-border'
          )}>
            <div className="flex items-center gap-2">
              {won  && <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />}
              {lost && <X className="h-4 w-4 text-destructive shrink-0" />}
              {!hasResult && <span className="w-2 h-2 rounded-full bg-primary shrink-0 mt-0.5" />}
              <span className={cn('text-sm font-semibold',
                won ? 'text-emerald-600' : lost ? 'text-destructive' : 'text-foreground'
              )}>
                {selected}
              </span>
            </div>
            {won && pick?.pointsAwarded ? (
              <span className="text-sm font-bold text-emerald-600">+{pick.pointsAwarded} נק'</span>
            ) : lost ? (
              <span className="text-xs text-muted-foreground">0 נק'</span>
            ) : !hasResult ? (
              <span className="text-xs text-muted-foreground">ממתין לתוצאה</span>
            ) : null}
          </div>
        ) : (
          <div className="flex items-center gap-2 px-4 py-3 rounded-xl border border-dashed border-border/60 text-muted-foreground">
            <Timer className="h-4 w-4 shrink-0" />
            <span className="text-sm">לא הגשת בחירה</span>
          </div>
        )}

        {/* Correct answer (if available and user didn't win) */}
        {hasResult && !won && (
          <p className="text-xs text-muted-foreground">
            תשובה נכונה: <span className="font-semibold text-foreground">{q.correctOptions!.join(' / ')}</span>
          </p>
        )}

        {/* Pie chart + legend */}
        {dist && total > 0 && (
          <div className="space-y-3">
            <div className="flex items-center gap-4">
              <PieChart
                slices={dist.slices}
                total={total}
                activeIndex={activeSlice}
                onSliceClick={handleSliceClick}
              />

              {/* Legend */}
              <div className="flex-1 space-y-1.5 min-w-0">
                {dist.slices.map((sl, i) => (
                  <button
                    key={sl.option}
                    onClick={() => handleSliceClick(i)}
                    className={cn(
                      'w-full flex items-center gap-2 text-right transition-opacity rounded-lg px-1.5 py-1 hover:bg-muted/50',
                      activeSlice !== null && activeSlice !== i ? 'opacity-40' : 'opacity-100'
                    )}
                  >
                    <span className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ background: SLICE_COLORS[i % SLICE_COLORS.length] }} />
                    <span className="text-xs text-foreground truncate flex-1">{sl.option}</span>
                    <span className="text-xs text-muted-foreground tabular-nums shrink-0">
                      {Math.round((sl.count / total) * 100)}% ({sl.count})
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Details button */}
            <button
              onClick={handleDetailsClick}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors"
            >
              <ChevronRight className={cn('h-3.5 w-3.5 transition-transform', panelOpen && 'rotate-90')} />
              {panelOpen ? 'הסתר פרטים' : 'הצג פרטים'}
            </button>

            {/* Users panel */}
            <AnimatePresence>
              {panelOpen && (
                <UsersPanel
                  slices={dist.slices}
                  activeIndex={activeSlice}
                  onClose={() => { setPanelOpen(false); setActiveSlice(null) }}
                />
              )}
            </AnimatePresence>
          </div>
        )}

        {/* No distribution yet */}
        {(!dist || total === 0) && (
          <p className="text-xs text-muted-foreground">אין בחירות עדיין</p>
        )}
      </div>
    )
  }

  // ── Pre-lock state (unchanged) ───────────────────────────────────
  return (
    <div className="bg-card border border-border rounded-2xl p-4">
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-semibold text-foreground leading-snug">{q.question}</p>
            <SavedBadge show={justSaved} />
          </div>
          <div className="mt-1">
            {hasResult ? (
              <p className="text-xs text-muted-foreground">
                {q.correctOptions!.length === 1
                  ? `תשובה נכונה: ${q.correctOptions![0]}`
                  : `תשובות נכונות: ${q.correctOptions!.join(' / ')}`}
              </p>
            ) : null}
          </div>
          {hasError && <p className="text-xs text-destructive mt-1">שגיאה בשמירה — נסה שוב</p>}
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <span className="text-xs font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full">{q.points} נק'</span>
        </div>
      </div>

      <button
        onClick={() => setOpen(v => !v)}
        disabled={isPending}
        className={cn(
          'w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl border text-sm transition-all',
          open
            ? 'border-primary/60 bg-primary/10 text-primary'
            : selected
            ? 'border-primary/40 bg-primary/10 text-primary hover:border-primary/60'
            : 'border-border bg-surface-deep text-muted-foreground hover:border-primary/40 hover:text-foreground'
        )}
      >
        <span className="flex-1 min-w-0">
          {selected
            ? <span className="truncate font-medium text-foreground">{selected}</span>
            : <span className="text-muted-foreground">בחר תשובה...</span>}
        </span>
        <ChevronDown className={cn('h-4 w-4 shrink-0 transition-transform duration-200', open && 'rotate-180')} />
      </button>

      {open && (
        <DrilldownPanel
          options={q.options}
          selected={selected}
          correct={q.correctOptions}
          isLocked={false}
          isPending={isPending}
          onSelect={opt => onPick(q, opt)}
          onClose={() => setOpen(false)}
        />
      )}

      {hasResult && pick && (
        <p className={cn('text-xs font-semibold mt-3', pick.pointsAwarded ? 'text-primary' : 'text-muted-foreground')}>
          {pick.pointsAwarded ? `✓ קיבלת ${pick.pointsAwarded} נקודות!` : '✗ לא קיבלת נקודות על שאלה זו'}
        </p>
      )}
    </div>
  )
}

// ── Page ─────────────────────────────────────────────────────────
export default function BonusPage() {
  const { id } = useParams<{ id: string }>()
  const [questions, setQuestions]     = useState<BonusQuestion[]>([])
  const [picks, setPicks]             = useState<BonusPick[]>([])
  const [distributions, setDists]     = useState<PickDistribution[]>([])
  const [isPending, startTransition]  = useTransition()
  const [savedId,  setSavedId]        = useState<string | null>(null)
  const [errorId,  setErrorId]        = useState<string | null>(null)
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    getBonusQuestions(id).then(setQuestions)
    getMyBonusPicks(id).then(setPicks)
    getPicksDistribution(id).then(setDists)
  }, [id])

  useEffect(() => () => { if (savedTimer.current) clearTimeout(savedTimer.current) }, [])

  const myPick   = (questionId: string) => picks.find(p => p.bonusQuestionId === questionId)
  const distFor  = (questionId: string) => distributions.find(d => d.questionId === questionId)

  const handlePick = (q: BonusQuestion, option: string) => {
    if (myPick(q.id)?.pick === option) return
    if (new Date() >= new Date(q.lockTime)) return

    setErrorId(null)
    startTransition(async () => {
      const res = await submitBonusPick(q.id, id, option)
      if (res.ok) {
        setPicks(prev => [
          ...prev.filter(p => p.bonusQuestionId !== q.id),
          { id: '', bonusQuestionId: q.id, tournamentId: id, userId: '', pick: option, pointsAwarded: null },
        ])
        setSavedId(q.id)
        if (savedTimer.current) clearTimeout(savedTimer.current)
        savedTimer.current = setTimeout(() => setSavedId(null), 2500)
      } else {
        setErrorId(q.id)
      }
    })
  }

  if (questions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-muted-foreground gap-3">
        <Gift className="h-10 w-10 text-muted-foreground/50" />
        <p className="font-semibold text-foreground">אין הימורי בונוס עדיין</p>
        <p className="text-sm">המנהל יוסיף שאלות בונוס בקרוב</p>
      </div>
    )
  }

  const lockTime = questions[0]?.lockTime

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      {lockTime && <HeroCountdown lockTime={lockTime} />}

      <div className="flex items-center gap-2 mb-2">
        <Gift className="h-5 w-5 text-primary" />
        <h2 className="font-suez text-xl text-foreground">הימורי בונוס</h2>
      </div>

      {questions.map(q => (
        <QuestionCard
          key={q.id}
          q={q}
          pick={myPick(q.id)}
          dist={distFor(q.id)}
          isPending={isPending}
          savedId={savedId}
          errorId={errorId}
          onPick={handlePick}
        />
      ))}
    </div>
  )
}
