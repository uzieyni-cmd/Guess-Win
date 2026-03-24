import { Team } from '@/types'

interface Props {
  team: Team
  size?: 'sm' | 'md' | 'lg' | 'xl'
}

const sizes = {
  sm:  'h-9 w-9',
  md:  'h-14 w-14',
  lg:  'h-16 w-16',
  xl:  'h-20 w-20',
}

export function TeamFlag({ team, size = 'md' }: Props) {
  return (
    <div className={`${sizes[size]} rounded-full bg-white border border-gray-100 shadow-sm flex items-center justify-center overflow-hidden shrink-0`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={team.flagUrl}
        alt={team.name}
        className="h-full w-full object-contain p-1"
        onError={(e) => {
          const target = e.target as HTMLImageElement
          target.style.display = 'none'
          target.nextElementSibling?.classList.remove('hidden')
        }}
      />
      <span className="hidden text-xs font-bold text-muted-foreground">
        {team.shortCode}
      </span>
    </div>
  )
}
