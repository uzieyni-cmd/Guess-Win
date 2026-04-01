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
        'relative rounded-full shrink-0 overflow-hidden',
        className ?? sizes[size],
      )}
      style={{
        /* Base sphere shadow */
        boxShadow: `
          0 6px 20px rgba(0,0,0,0.45),
          0 2px 6px  rgba(0,0,0,0.30),
          inset 0 -3px 8px rgba(0,0,0,0.25)
        `,
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
      <span className="hidden absolute inset-0 flex items-center justify-center text-xs font-bold text-white bg-slate-600">
        {team.shortCode}
      </span>

      {/* ── Radial depth gradient — darkens edges for 3-D curvature ── */}
      <div
        className="absolute inset-0 rounded-full pointer-events-none"
        style={{
          background: `radial-gradient(
            ellipse at 60% 65%,
            transparent        35%,
            rgba(0,0,0,0.18)   65%,
            rgba(0,0,0,0.55)  100%
          )`,
        }}
      />

      {/* ── Gloss highlight — crescent on the upper-left ── */}
      <div
        className="absolute inset-0 rounded-full pointer-events-none"
        style={{
          background: `radial-gradient(
            ellipse 70% 55% at 38% 22%,
            rgba(255,255,255,0.72) 0%,
            rgba(255,255,255,0.22) 40%,
            transparent           70%
          )`,
        }}
      />

      {/* ── Rim light — faint bright ring on the very edge ── */}
      <div
        className="absolute inset-0 rounded-full pointer-events-none"
        style={{
          boxShadow: 'inset 0 0 0 1.5px rgba(255,255,255,0.18)',
        }}
      />
    </div>
  )
}
