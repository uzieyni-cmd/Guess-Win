'use client'
import { Team } from '@/types'
import { cn } from '@/lib/utils'

interface Props {
  team: Team
  size?: 'sm' | 'md' | 'lg' | 'xl'
  className?: string
}

const sizes = {
  sm:  'h-9 w-9',
  md:  'h-14 w-14',
  lg:  'h-16 w-16',
  xl:  'h-20 w-20',
}

export function TeamFlag({ team, size = 'md', className }: Props) {
  return (
    <div
      className={cn(
        'relative rounded-full shrink-0 overflow-hidden bg-slate-600',
        className ?? sizes[size],
      )}
      style={{
        boxShadow: '0 4px 12px rgba(0,0,0,0.45), 0 1px 3px rgba(0,0,0,0.25)',
      }}
    >
      {/* ── Flag image fills the circle ── */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={team.flagUrl}
        alt={team.name}
        className="absolute inset-0 h-full w-full object-cover"
        onError={(e) => {
          const img = e.target as HTMLImageElement
          img.style.display = 'none'
          const fallback = img.nextElementSibling as HTMLElement | null
          fallback?.classList.remove('hidden')
        }}
      />

      {/* ── Fallback initials ── */}
      <span className="hidden absolute inset-0 flex items-center justify-center text-xs font-bold text-white">
        {team.shortCode}
      </span>

      {/* ── Subtle top highlight + border ── */}
      <div
        className="absolute inset-0 pointer-events-none rounded-full"
        style={{
          background: 'linear-gradient(180deg, rgba(255,255,255,0.18) 0%, transparent 50%)',
          boxShadow: 'inset 0 0 0 1.5px rgba(255,255,255,0.20)',
        }}
      />
    </div>
  )
}
