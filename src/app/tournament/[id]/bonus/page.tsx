'use client'
import { useEffect, useState, useTransition, useRef } from 'react'
import { useParams } from 'next/navigation'
import { Gift, Lock, CheckCircle2, ChevronDown, Search, X } from 'lucide-react'
import { getBonusQuestions, getMyBonusPicks, submitBonusPick } from '@/app/actions/bonus'
import { BonusQuestion, BonusPick } from '@/types'
import { cn } from '@/lib/utils'

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
    <div className="mt-3 rounded-xl border border-slate-600/50 bg-slate-800/60 overflow-hidden">
      {/* Search bar */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-slate-700/50">
        <Search className="h-3.5 w-3.5 text-slate-500 shrink-0" />
        <input
          ref={inputRef}
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="חיפוש..."
          className="flex-1 bg-transparent text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none"
          dir="rtl"
        />
        {query && (
          <button onClick={() => setQuery('')} className="text-slate-500 hover:text-slate-300">
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* Options list */}
      <div className="max-h-56 overflow-y-auto py-1 scrollbar-none">
        {filtered.length === 0 ? (
          <p className="text-center text-xs text-slate-500 py-4">אין תוצאות</p>
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
                    ? 'bg-emerald-600/20 text-emerald-300'
                    : isWrong
                    ? 'bg-red-900/20 text-red-400 line-through'
                    : isSelected
                    ? 'bg-emerald-600/10 text-emerald-300'
                    : isLocked
                    ? 'text-slate-500 cursor-default'
                    : 'text-slate-200 hover:bg-slate-700/40'
                )}
              >
                <span className="flex-1 truncate">{opt}</span>
                {isCorrect && <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />}
                {isSelected && !isCorrect && !isWrong && (
                  <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
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
  onPick,
}: {
  q: BonusQuestion
  pick: BonusPick | undefined
  isPending: boolean
  onPick: (q: BonusQuestion, opt: string) => void
}) {
  const [open, setOpen] = useState(false)
  const isLocked  = new Date() >= new Date(q.lockTime)
  const hasResult = !!q.correctOption
  const selected  = pick?.pick

  const toggleOpen = () => {
    if (isLocked) return
    setOpen(v => !v)
  }

  return (
    <div className="bg-surface border border-slate-700/40 rounded-2xl p-4">
      {/* Header row */}
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-slate-100 leading-snug">{q.question}</p>
          <p className="text-xs text-slate-500 mt-1">
            {hasResult
              ? `תשובה נכונה: ${q.correctOption}`
              : isLocked
              ? 'ההימור נעול'
              : `נועל: ${new Date(q.lockTime).toLocaleString('he-IL', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}`}
          </p>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {isLocked && <Lock className="h-3.5 w-3.5 text-slate-500" />}
          <span className="text-xs font-bold text-emerald-400 bg-emerald-400/10 px-2 py-0.5 rounded-full">
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
            ? 'border-emerald-500/60 bg-emerald-600/10 text-emerald-300'
            : selected
            ? 'border-emerald-500/40 bg-emerald-600/10 text-emerald-300 hover:border-emerald-500/60'
            : isLocked
            ? 'border-slate-700/30 bg-slate-800/30 text-slate-500 cursor-default'
            : 'border-slate-600/40 bg-slate-800/50 text-slate-400 hover:border-slate-500/60 hover:text-slate-200'
        )}
      >
        <span className="flex items-center gap-2 flex-1 min-w-0">
          {selected
            ? <span className="truncate font-medium text-slate-100">{selected}</span>
            : <span className="text-slate-500">בחר תשובה...</span>}
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
          pick.pointsAwarded ? 'text-emerald-400' : 'text-slate-500'
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

  useEffect(() => {
    getBonusQuestions(id).then(setQuestions)
    getMyBonusPicks(id).then(setPicks)
  }, [id])

  const myPick = (questionId: string) =>
    picks.find(p => p.bonusQuestionId === questionId)

  const handlePick = (q: BonusQuestion, option: string) => {
    if (myPick(q.id)?.pick === option) return
    if (new Date() >= new Date(q.lockTime)) return

    startTransition(async () => {
      const res = await submitBonusPick(q.id, id, option)
      if (res.ok) {
        setPicks(prev => [
          ...prev.filter(p => p.bonusQuestionId !== q.id),
          { id: '', bonusQuestionId: q.id, tournamentId: id, userId: '', pick: option, pointsAwarded: null },
        ])
      }
    })
  }

  if (questions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-slate-500 gap-3">
        <Gift className="h-10 w-10 text-slate-600" />
        <p className="font-semibold text-slate-300">אין הימורי בונוס עדיין</p>
        <p className="text-sm">המנהל יוסיף שאלות בונוס בקרוב</p>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <div className="flex items-center gap-2 mb-4">
        <Gift className="h-5 w-5 text-emerald-500" />
        <h2 className="font-suez text-xl text-slate-100">הימורי בונוס</h2>
      </div>

      {questions.map(q => (
        <QuestionCard
          key={q.id}
          q={q}
          pick={myPick(q.id)}
          isPending={isPending}
          onPick={handlePick}
        />
      ))}
    </div>
  )
}
