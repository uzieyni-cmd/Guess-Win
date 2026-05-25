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

    const apiMessages = next.filter((m, i) => !(i === 0 && m.role === 'assistant'))

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: apiMessages, tournamentId, userId: currentUser?.id }),
      })

      if (!res.ok) throw new Error('שגיאת שרת')

      const data = await res.json()
      setMessages(prev => [...prev, { role: 'assistant', content: data.text ?? 'מצטער, לא הצלחתי לענות.' }])
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
            ? 'bg-card border border-border hover:bg-surface-deep'
            : 'bg-primary hover:bg-primary/90 hover:scale-105'
        )}
        aria-label="פתח צ'אט עזרה"
      >
        {open
          ? <X className="h-5 w-5 text-foreground" />
          : <MessageCircle className="h-5 w-5 text-primary-foreground" />}
      </button>

      {/* Chat window */}
      {open && (
        <div
          dir="rtl"
          className="fixed bottom-22 left-5 z-50 w-[320px] sm:w-[360px] rounded-2xl overflow-hidden shadow-2xl border border-border flex flex-col bg-card"
          style={{ maxHeight: '70vh' }}
        >
          {/* Header */}
          <div className="flex items-center gap-2.5 px-4 py-3 border-b border-border bg-surface-deep">
            <div className="w-7 h-7 rounded-full bg-primary flex items-center justify-center shrink-0">
              <Bot className="h-4 w-4 text-primary-foreground" />
            </div>
            <div>
              <p className="text-sm font-bold text-foreground leading-none">עוזר Guess & Win</p>
              <p className="text-[10px] text-primary mt-0.5">מחובר</p>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-3 space-y-3 scrollbar-none" style={{ minHeight: 0, overscrollBehavior: 'contain' }}>
            {messages.map((msg, i) => (
              <div key={i} className={cn('flex', msg.role === 'user' ? 'justify-start' : 'justify-end')}>
                <div className={cn(
                  'max-w-[85%] rounded-xl px-3 py-2 text-sm leading-relaxed',
                  msg.role === 'user'
                    ? 'bg-primary/15 border border-primary/30 text-foreground rounded-tr-sm'
                    : 'bg-surface-deep border border-border/60 text-foreground rounded-tl-sm'
                )}>
                  {msg.content || (loading && i === messages.length - 1
                    ? <span className="flex gap-1 items-center py-0.5">
                        <span className="w-1.5 h-1.5 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                        <span className="w-1.5 h-1.5 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                        <span className="w-1.5 h-1.5 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                      </span>
                    : null
                  )}
                </div>
              </div>
            ))}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div className="px-3 py-2.5 border-t border-border/50 flex gap-2">
            <input
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
              placeholder="שאל שאלה על הטורניר..."
              disabled={loading}
              className="flex-1 bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50 min-w-0"
            />
            <button
              onClick={send}
              disabled={!input.trim() || loading}
              className="w-9 h-9 rounded-lg bg-primary hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center transition-colors shrink-0"
            >
              <Send className="h-4 w-4 text-primary-foreground" />
            </button>
          </div>
        </div>
      )}
    </>
  )
}
