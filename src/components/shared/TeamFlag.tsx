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
        'relative rounded-full shrink-0 overflow-hidden bg-slate-700',
        className ?? sizes[size],
      )}
      style={{
        boxShadow:
          '0 8px 24px rgba(0,0,0,0.55), 0 2px 6px rgba(0,0,0,0.35), inset 0 -4px 10px rgba(0,0,0,0.30)',
      }}
    >
      {/* ── Flag image fills the sphere ── */}
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

      {/* ── Single overlay: depth darkening + gloss crescent ── */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: `
            radial-gradient(ellipse 62% 48% at 35% 18%, rgba(255,255,255,0.90) 0%, rgba(255,255,255,0.30) 38%, transparent 62%),
            radial-gradient(ellipse at 58% 68%, transparent 28%, rgba(0,0,0,0.22) 60%, rgba(0,0,0,0.65) 100%)
          `,
          boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.25)',
        }}
      />
    </div>
  )
}
