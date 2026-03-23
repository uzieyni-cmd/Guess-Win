import { Team } from '@/types'

interface Props {
  team: Team
  size?: 'sm' | 'md' | 'lg'
}

const sizes = { sm: 'h-6 w-8', md: 'h-8 w-11', lg: 'h-10 w-14' }

export function TeamFlag({ team, size = 'md' }: Props) {
  return (
    <div className="flex flex-col items-center gap-1">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={team.flagUrl}
        alt={team.name}
        className={`${sizes[size]} object-cover rounded shadow-sm`}
        onError={(e) => {
          const target = e.target as HTMLImageElement
          target.style.display = 'none'
          target.nextElementSibling?.classList.remove('hidden')
        }}
      />
      <span className="hidden text-xs font-bold text-muted-foreground bg-muted rounded px-1">
        {team.shortCode}
      </span>
    </div>
  )
}
