'use client'
import { useEffect, useState, useTransition } from 'react'
import { useParams } from 'next/navigation'
import { Gift, Lock, CheckCircle2 } from 'lucide-react'
import { getBonusQuestions, getMyBonusPicks, submitBonusPick } from '@/app/actions/bonus'
import { BonusQuestion, BonusPick } from '@/types'
import { cn } from '@/lib/utils'

export default function BonusPage() {
  const { id } = useParams<{ id: string }>()
  const [questions, setQuestions] = useState<BonusQuestion[]>([])
  const [picks, setPicks] = useState<BonusPick[]>([])
  const [isPending, startTransition] = useTransition()
  const [msg, setMsg] = useState<Record<string, string>>({})

  useEffect(() => {
    getBonusQuestions(id).then(setQuestions)
    getMyBonusPicks(id).then(setPicks)
  }, [id])

  const myPick = (questionId: string) =>
    picks.find(p => p.bonusQuestionId === questionId)

  const handlePick = (q: BonusQuestion, option: string) => {
    const existing = myPick(q.id)
    if (existing?.pick === option) return  // already selected
    if (new Date() >= new Date(q.lockTime)) return

    startTransition(async () => {
      const res = await submitBonusPick(q.id, id, option)
      if (res.ok) {
        setPicks(prev => {
          const filtered = prev.filter(p => p.bonusQuestionId !== q.id)
          return [...filtered, {
            id: '',
            bonusQuestionId: q.id,
            tournamentId: id,
            userId: '',
            pick: option,
            pointsAwarded: null,
          }]
        })
      } else {
        setMsg(prev => ({ ...prev, [q.id]: res.error ?? 'שגיאה' }))
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

      {questions.map(q => {
        const isLocked = new Date() >= new Date(q.lockTime)
        const pick = myPick(q.id)
        const hasResult = !!q.correctOption

        return (
          <div key={q.id} className="bg-[#0d1420] border border-slate-700/40 rounded-2xl p-4 space-y-3">
            {/* Header */}
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-semibold text-slate-100">{q.question}</p>
                <p className="text-xs text-slate-500 mt-0.5">
                  {hasResult
                    ? `תוצאה: ${q.correctOption}`
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

            {/* Options */}
            <div className="flex flex-wrap gap-2">
              {q.options.map(opt => {
                const isMyPick = pick?.pick === opt
                const isCorrect = hasResult && q.correctOption === opt
                const isWrong   = hasResult && isMyPick && !isCorrect

                return (
                  <button
                    key={opt}
                    disabled={isLocked || isPending}
                    onClick={() => handlePick(q, opt)}
                    className={cn(
                      'px-3 py-1.5 rounded-xl text-sm font-medium border transition-all duration-150',
                      isCorrect
                        ? 'bg-emerald-600 border-emerald-500 text-white'
                        : isWrong
                        ? 'bg-red-900/30 border-red-700/50 text-red-400 line-through'
                        : isMyPick
                        ? 'bg-emerald-600/20 border-emerald-500/60 text-emerald-300'
                        : isLocked
                        ? 'bg-slate-800/40 border-slate-700/30 text-slate-500 cursor-default'
                        : 'bg-slate-800/60 border-slate-600/40 text-slate-300 hover:border-emerald-500/50 hover:text-slate-100'
                    )}
                  >
                    {isCorrect && <CheckCircle2 className="inline h-3.5 w-3.5 mb-0.5 ml-1" />}
                    {opt}
                  </button>
                )
              })}
            </div>

            {/* Points awarded */}
            {hasResult && pick && (
              <p className={cn(
                'text-xs font-semibold',
                pick.pointsAwarded ? 'text-emerald-400' : 'text-slate-500'
              )}>
                {pick.pointsAwarded
                  ? `✓ קיבלת ${pick.pointsAwarded} נקודות!`
                  : '✗ לא קיבלת נקודות על שאלה זו'}
              </p>
            )}

            {msg[q.id] && <p className="text-xs text-red-400">{msg[q.id]}</p>}
          </div>
        )
      })}
    </div>
  )
}
