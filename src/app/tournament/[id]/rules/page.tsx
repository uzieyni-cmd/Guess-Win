'use client'
import { useParams } from 'next/navigation'
import { ScrollText } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { useTournament } from '@/context/TournamentContext'
import { EmptyState } from '@/components/shared/EmptyState'

export default function RulesPage() {
  const { id } = useParams() as { id: string }
  const { activeTournament, tournaments } = useTournament()
  const tournament = activeTournament ?? tournaments.find(t => t.id === id)
  const rules = tournament?.rules?.trim()

  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <ScrollText className="h-5 w-5 text-primary" />
        <h2 className="font-suez text-xl text-foreground">תקנון</h2>
      </div>

      {!rules ? (
        <EmptyState icon={ScrollText} title="אין תקנון עדיין" subtitle="מנהל הטורניר טרם הוסיף תקנון" />
      ) : (
        <div className="rounded-2xl border border-border bg-card p-4 sm:p-6">
          <div className="text-sm leading-relaxed text-foreground/90">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                h1: ({ children }) => <h1 className="font-suez text-xl text-foreground mt-4 mb-2 first:mt-0">{children}</h1>,
                h2: ({ children }) => <h2 className="font-suez text-lg text-foreground mt-4 mb-2 first:mt-0">{children}</h2>,
                h3: ({ children }) => <h3 className="font-semibold text-base text-foreground mt-3 mb-1.5">{children}</h3>,
                p:  ({ children }) => <p className="mb-2">{children}</p>,
                ul: ({ children }) => <ul className="list-disc pr-5 space-y-1 mb-2">{children}</ul>,
                ol: ({ children }) => <ol className="list-decimal pr-5 space-y-1 mb-2">{children}</ol>,
                strong: ({ children }) => <strong className="font-bold text-foreground">{children}</strong>,
                a: ({ href, children }) => (
                  <a href={href} target="_blank" rel="noopener noreferrer" className="text-primary underline">{children}</a>
                ),
                // eslint-disable-next-line @next/next/no-img-element
                img: ({ src, alt }) => <img src={typeof src === 'string' ? src : ''} alt={alt ?? ''} className="rounded-xl max-w-full my-3 border border-border" />,
                hr: () => <hr className="my-4 border-border" />,
                blockquote: ({ children }) => <blockquote className="border-r-4 border-primary/40 pr-3 text-muted-foreground italic my-2">{children}</blockquote>,
              }}
            >
              {rules}
            </ReactMarkdown>
          </div>
        </div>
      )}
    </div>
  )
}
