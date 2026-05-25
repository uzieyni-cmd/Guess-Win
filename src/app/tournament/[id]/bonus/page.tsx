'use client'
import { useEffect, useState, useTransition, useRef } from 'react'
import { useParams } from 'next/navigation'
import { Gift, Lock, CheckCircle2, ChevronDown, Search, X, Timer } from 'lucide-react'
import { getBonusQuestions, getMyBonusPicks, submitBonusPick } from '@/app/actions/bonus'
import { BonusQuestion, BonusPick } from '@/types'
import { cn } from '@/lib/utils'

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

// ── Countdown display ────────────────────────────────────────────
function Countdown({ lockTime }: { lockTime: string }) {
  const r = useCountdown(lockTime)

  if (!r) return null   // locked — parent shows lock icon

  const pad = (n: number) => String(n).padStart(2, '0')

  // urgency tiers
  const urgent  = r.totalSec < 5 * 60          // < 5 min  → red pulse
  const warning = r.totalSec < 60 * 60          // < 1 hour → amber

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 font-condensed text-xs tracking-wide',
        urgent  ? 'text-destructive animate-pulse'
        : warning ? 'text-amber-600'
        : 'text-muted-foreground'
      )}
    >
      <Timer className="h-3 w-3 shrink-0" />
      {r.days > 0 && <span>{r.days}י׳ </span>}
      <span className="tabular-nums">
        {r.hours > 0 ? `${pad(r.hours)}:` : ''}{pad(r.minutes)}:{pad(r.seconds)}
      </span>
    </span>
  )
}

// ── Hero countdown banner ────────────────────────────────────────
function HeroCountdown({ lockTime }: { lockTime: string }) {
  const r = useCountdown(lockTime)

  const pad = (n: number) => String(n).padStart(2, '0')

  if (!r) {
    // All picks are locked
    return (
      <div className="w-full rounded-2xl bg-foreground px-6 py-8 text-center mb-6">
        <Lock className="h-8 w-8 text-muted-foreground/60 mx-auto mb-2" />
        <p className="font-suez text-lg text-white/60">הבחירות נסגרו</p>
      </div>
    )
  }

  const urgent  = r.totalSec < 5 * 60
  const warning = r.totalSec < 60 * 60

  const blocks = [
    { value: String(r.days), label: 'ימים'   },
    { value: pad(r.hours),   label: 'שעות'   },
    { value: pad(r.minutes), label: 'דקות'   },
    { value: pad(r.seconds), label: 'שניות'  },
  ]

  return (
    <div
      className={cn(
        'w-full rounded-2xl px-6 py-7 mb-6 transition-colors duration-1000',
        urgent
          ? 'bg-destructive/90'
          : 'bg-foreground'
      )}
    >
      <p className={cn(
        'text-center text-sm font-medium mb-5 tracking-wide',
        urgent ? 'text-white/80' : 'text-white/50'
      )}>
        סגירת הבחירות בעוד
      </p>

      <div className="flex justify-center gap-3 sm:gap-6" dir="ltr">
        {blocks.map(({ value, label }) => (
          <div key={label} className="flex flex-col items-center gap-1.5 min-w-[52px]">
            <span
              className={cn(
                'font-condensed tabular-nums leading-none',
                urgent  ? 'text-white text-5xl sm:text-6xl font-black'
                : warning ? 'text-amber-400 text-5xl sm:text-6xl font-black'
                : 'text-primary text-5xl sm:text-6xl font-black'
              )}
            >
              {value}
            </span>
            <span className={cn(
              'text-xs tracking-widest uppercase',
              urgent ? 'text-white/70' : 'text-white/40'
            )}>
              {label}
            </span>
          </div>
        ))}
      </div>

      {warning && !urgent && (
        <p className="text-center text-xs text-amber-400/80 mt-4 animate-pulse">
          פחות משעה — מהרו להגיש!
        </p>
      )}
      {urgent && (
        <p className="text-center text-xs text-white/80 mt-4 animate-pulse font-semibold">
          פחות מ-5 דקות — מהרו!
        </p>
      )}
    </div>
  )
}

// ── Mini toast ───────────────────────────────────────────────────
function SavedBadge({ show }: { show: boolean }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-2 py-0.5 transition-all duration-300',
        show ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-1 pointer-events-none'
      )}
    >
      <CheckCircle2 className="h-3 w-3" />
      נשמר
    </span>
  )
}

// ── Drilldown panel for a single question ────────────────────────
function DrilldownPanel({
  options,
  selected,
  correct,
  isLocked,
  isPending,
  onSelect,
  onClose,
}: {
  options: string[]
  selected: string | undefined
  correct: string | null
  isLocked: boolean
  isPending: boolean
  onSelect: (opt: string) => void
  onClose: () => void
}) {
  const [query, setQuery] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const filtered = query.trim()
    ? options.filter(o => o.toLowerCase().includes(query.toLowerCase()))
    : options

  return (
    <div className="mt-3 rounded-xl border border-border bg-surface-deep overflow-hidden">
      {/* Search bar */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border/50">
        <Search className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        <input
          ref={inputRef}
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="חיפוש..."
          className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
          dir="rtl"
        />
        {query && (
          <button onClick={() => setQuery('')} className="text-muted-foreground hover:text-foreground">
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* Options list */}
      <div className="max-h-56 overflow-y-auto py-1 scrollbar-none">
        {filtered.length === 0 ? (
          <p className="text-center text-xs text-muted-foreground py-4">אין תוצאות</p>
        ) : (
          filtered.map(opt => {
            const isSelected = selected === opt
            const isCorrect  = !!correct && correct === opt
            const isWrong    = !!correct && isSelected && !isCorrect

            return (
              <button
                key={opt}
                disabled={isLocked || isPending}
                onClick={() => { onSelect(opt); onClose() }}
                className={cn(
                  'w-full text-right px-4 py-2.5 text-sm flex items-center justify-between gap-3 transition-colors',
                  isCorrect
                    ? 'bg-primary/20 text-primary'
                    : isWrong
                    ? 'bg-destructive/20 text-destructive line-through'
                    : isSelected
                    ? 'bg-primary/10 text-primary'
                    : isLocked
                    ? 'text-muted-foreground cursor-default'
                    : 'text-foreground hover:bg-foreground/8'
                )}
              >
                <span className="flex-1 truncate">{opt}</span>
                {isCorrect && <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />}
                {isSelected && !isCorrect && !isWrong && (
                  <span className="w-2 h-2 rounded-full bg-primary shrink-0" />
                )}
              </button>
            )
          })
        )}
      </div>
    </div>
  )
}

// ── Question card ────────────────────────────────────────────────
function QuestionCard({
  q,
  pick,
  isPending,
  savedId,
  errorId,
  onPick,
}: {
  q: BonusQuestion
  pick: BonusPick | undefined
  isPending: boolean
  savedId: string | null
  errorId: string | null
  onPick: (q: BonusQuestion, opt: string) => void
}) {
  const [open, setOpen] = useState(false)
  const isLocked  = new Date() >= new Date(q.lockTime)
  const hasResult = !!q.correctOption
  const selected  = pick?.pick
  const justSaved = savedId === q.id
  const hasError  = errorId === q.id

  const toggleOpen = () => {
    if (isLocked) return
    setOpen(v => !v)
  }

  return (
    <div className="bg-card border border-border rounded-2xl p-4">
      {/* Header row */}
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-semibold text-foreground leading-snug">{q.question}</p>
            <SavedBadge show={justSaved} />
          </div>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            {hasResult ? (
              <p className="text-xs text-muted-foreground">{`תשובה נכונה: ${q.correctOption}`}</p>
            ) : isLocked ? (
              <p className="text-xs text-muted-foreground">ההימור נעול</p>
            ) : (
              <>
                <p className="text-xs text-muted-foreground">
                  {`נועל: ${new Date(q.lockTime).toLocaleString('he-IL', { timeZone: 'Asia/Jerusalem', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}`}
                </p>
                <Countdown lockTime={q.lockTime} />
              </>
            )}
          </div>
          {hasError && (
            <p className="text-xs text-destructive mt-1">שגיאה בשמירה — נסה שוב</p>
          )}
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {isLocked && <Lock className="h-3.5 w-3.5 text-muted-foreground" />}
          <span className="text-xs font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full">
            {q.points} נק'
          </span>
        </div>
      </div>

      {/* Current selection / trigger */}
      <button
        onClick={toggleOpen}
        disabled={isLocked || isPending}
        className={cn(
          'w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl border text-sm transition-all',
          open
            ? 'border-primary/60 bg-primary/10 text-primary'
            : selected
            ? 'border-primary/40 bg-primary/10 text-primary hover:border-primary/60'
            : isLocked
            ? 'border-border/50 bg-muted text-muted-foreground cursor-default'
            : 'border-border bg-surface-deep text-muted-foreground hover:border-primary/40 hover:text-foreground'
        )}
      >
        <span className="flex items-center gap-2 flex-1 min-w-0">
          {selected
            ? <span className="truncate font-medium text-foreground">{selected}</span>
            : <span className="text-muted-foreground">בחר תשובה...</span>}
        </span>
        {!isLocked && (
          <ChevronDown className={cn('h-4 w-4 shrink-0 transition-transform duration-200', open && 'rotate-180')} />
        )}
      </button>

      {/* Drilldown */}
      {open && (
        <DrilldownPanel
          options={q.options}
          selected={selected}
          correct={q.correctOption}
          isLocked={isLocked}
          isPending={isPending}
          onSelect={opt => onPick(q, opt)}
          onClose={() => setOpen(false)}
        />
      )}

      {/* Points result */}
      {hasResult && pick && (
        <p className={cn(
          'text-xs font-semibold mt-3',
          pick.pointsAwarded ? 'text-primary' : 'text-muted-foreground'
        )}>
          {pick.pointsAwarded
            ? `✓ קיבלת ${pick.pointsAwarded} נקודות!`
            : '✗ לא קיבלת נקודות על שאלה זו'}
        </p>
      )}
    </div>
  )
}

// ── Page ─────────────────────────────────────────────────────────
export default function BonusPage() {
  const { id } = useParams<{ id: string }>()
  const [questions, setQuestions] = useState<BonusQuestion[]>([])
  const [picks, setPicks]         = useState<BonusPick[]>([])
  const [isPending, startTransition] = useTransition()
  const [savedId,  setSavedId]  = useState<string | null>(null)
  const [errorId,  setErrorId]  = useState<string | null>(null)
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    getBonusQuestions(id).then(setQuestions)
    getMyBonusPicks(id).then(setPicks)
  }, [id])

  // cleanup timer on unmount
  useEffect(() => () => { if (savedTimer.current) clearTimeout(savedTimer.current) }, [])

  const myPick = (questionId: string) =>
    picks.find(p => p.bonusQuestionId === questionId)

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
        // Show "נשמר ✓" badge for 2.5 s
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

  // All questions share the same lock_time — use the first one for the hero
  const lockTime = questions[0]?.lockTime

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      {/* Hero countdown */}
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
          isPending={isPending}
          savedId={savedId}
          errorId={errorId}
          onPick={handlePick}
        />
      ))}
    </div>
  )
}
