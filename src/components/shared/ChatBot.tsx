'use client'

import { useEffect, useRef, useState } from 'react'
import { MessageCircle, X, Send, Bot } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuth } from '@/context/AuthContext'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

interface Props {
  tournamentId?: string
}

export function ChatBot({ tournamentId }: Props) {
  const { currentUser } = useAuth()
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([
    { role: 'assistant', content: 'שלום! אני כאן לעזור עם שאלות על הטורניר — דירוגים, ניחושים, תוצאות. מה תרצה לדעת?' }
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
      inputRef.current?.focus()
    }
  }, [open, messages])

  const send = async () => {
    const text = input.trim()
    if (!text || loading) return

    const userMsg: Message = { role: 'user', content: text }
    const next = [...messages, userMsg]
    setMessages(next)
    setInput('')
    setLoading(true)

    // שלח רק הודעות user/assistant אמיתיות — לא הברכה הראשונית
    const apiMessages = next.filter((m, i) => !(i === 0 && m.role === 'assistant'))

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: apiMessages,
          tournamentId,
          userId: currentUser?.id,
        }),
      })

      if (!res.ok || !res.body) throw new Error('שגיאת שרת')

      // stream reading — toTextStreamResponse returns plain text chunks
      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let assistantText = ''

      setMessages(prev => [...prev, { role: 'assistant', content: '' }])

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        assistantText += decoder.decode(value, { stream: true })
        setMessages(prev => {
          const updated = [...prev]
          updated[updated.length - 1] = { role: 'assistant', content: assistantText }
          return updated
        })
      }
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: 'מצטער, הייתה שגיאה. נסה שוב.' }])
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => setOpen(v => !v)}
        className={cn(
          'fixed bottom-5 left-5 z-50 w-13 h-13 rounded-full flex items-center justify-center shadow-lg transition-all duration-200',
          open
            ? 'bg-slate-700 hover:bg-slate-600'
            : 'bg-emerald-600 hover:bg-emerald-500 hover:scale-105'
        )}
        aria-label="פתח צ'אט עזרה"
      >
        {open ? <X className="h-5 w-5 text-white" /> : <MessageCircle className="h-5 w-5 text-white" />}
      </button>

      {/* Chat window */}
      {open && (
        <div
          dir="rtl"
          className="fixed bottom-22 left-5 z-50 w-[320px] sm:w-[360px] rounded-2xl overflow-hidden shadow-2xl border border-slate-700/50 flex flex-col"
          style={{ maxHeight: '70vh', background: '#0d1420' }}
        >
          {/* Header */}
          <div className="flex items-center gap-2.5 px-4 py-3 border-b border-slate-700/40 bg-[#0a0f1c]">
            <div className="w-7 h-7 rounded-full bg-emerald-600 flex items-center justify-center shrink-0">
              <Bot className="h-4 w-4 text-white" />
            </div>
            <div>
              <p className="text-sm font-bold text-slate-100 leading-none">עוזר Guess & Win</p>
              <p className="text-[10px] text-emerald-400 mt-0.5">מחובר</p>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-3 space-y-3 scrollbar-none" style={{ minHeight: 0 }}>
            {messages.map((msg, i) => (
              <div key={i} className={cn('flex', msg.role === 'user' ? 'justify-start' : 'justify-end')}>
                <div className={cn(
                  'max-w-[85%] rounded-xl px-3 py-2 text-sm leading-relaxed',
                  msg.role === 'user'
                    ? 'bg-emerald-600/20 border border-emerald-600/30 text-slate-100 rounded-tr-sm'
                    : 'bg-slate-700/50 border border-slate-600/30 text-slate-200 rounded-tl-sm'
                )}>
                  {msg.content || (loading && i === messages.length - 1
                    ? <span className="flex gap-1 items-center py-0.5">
                        <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                        <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                        <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                      </span>
                    : null
                  )}
                </div>
              </div>
            ))}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div className="px-3 py-2.5 border-t border-slate-700/40 flex gap-2">
            <input
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
              placeholder="שאל שאלה על הטורניר..."
              disabled={loading}
              className="flex-1 bg-slate-800/60 border border-slate-600/40 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-emerald-500/50 min-w-0"
            />
            <button
              onClick={send}
              disabled={!input.trim() || loading}
              className="w-9 h-9 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center transition-colors shrink-0"
            >
              <Send className="h-4 w-4 text-white" />
            </button>
          </div>
        </div>
      )}
    </>
  )
}
