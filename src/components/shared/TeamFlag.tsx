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
    <div className={cn('shrink-0 flex items-center justify-center', className ?? sizes[size])}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={team.flagUrl}
        alt={team.name}
        className="max-h-full max-w-full object-contain"
        onError={(e) => {
          const img = e.target as HTMLImageElement
          img.style.display = 'none'
          const fallback = img.nextElementSibling as HTMLElement | null
          fallback?.classList.remove('hidden')
        }}
      />
      <span className="hidden text-xs font-bold text-white">{team.shortCode}</span>
    </div>
  )
}
