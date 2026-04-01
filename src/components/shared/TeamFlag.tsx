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
        'relative rounded-full shrink-0 overflow-hidden bg-slate-600 transform-gpu',
        className ?? sizes[size],
      )}
      style={{
        boxShadow:
          '0 6px 20px rgba(0,0,0,0.55), 0 2px 6px rgba(0,0,0,0.30), inset 0 -3px 8px rgba(0,0,0,0.20)',
      }}
    >
      {/* ── Flag image fills the entire circle ── */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={team.flagUrl}
        alt={team.name}
        className="absolute inset-0 h-full w-full object-cover scale-[1.18]"
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

      {/* ── 3D convex lens effect: bright gloss top-left + depth bottom-right ── */}
      <div
        className="absolute inset-0 pointer-events-none rounded-full"
        style={{
          background: `
            radial-gradient(ellipse 72% 55% at 38% 22%, rgba(255,255,255,0.88) 0%, rgba(255,255,255,0.38) 32%, transparent 62%),
            radial-gradient(ellipse at 62% 72%, transparent 28%, rgba(0,0,0,0.20) 62%, rgba(0,0,0,0.48) 100%)
          `,
          boxShadow: 'inset 0 0 0 1.5px rgba(255,255,255,0.28)',
        }}
      />
    </div>
  )
}
