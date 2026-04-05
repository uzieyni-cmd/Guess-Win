'use client'
import Image from 'next/image'
import { cn } from '@/lib/utils'

interface Props {
  left?: React.ReactNode
  right?: React.ReactNode
  className?: string
  below?: React.ReactNode   // tabs / sub-nav
}

export function SiteHeader({ left, right, className, below }: Props) {
  return (
    <div className={cn(
      'sticky top-0 z-20 bg-[#070b14]/90 backdrop-blur-md border-b border-white/8',
      className
    )}>
      <div className="max-w-[1600px] mx-auto px-4">
        <div className="flex items-center justify-between h-[68px]">
          {/* RTL: לוגו + כותרת + back — בצד ימין */}
          <div className="flex items-center gap-2 min-w-0 overflow-hidden">
            {left && <div className="shrink-0">{left}</div>}
            <Image src="/logo.svg" alt="Guess&Win" width={38} height={44} className="sm:w-[48px] sm:h-[56px] shrink-0" priority />
            <span className="font-suez text-lg sm:text-2xl tracking-wide leading-none whitespace-nowrap select-none">
              <span className="text-white">GUESS</span>
              <span className="text-yellow-400"> &amp; WIN</span>
            </span>
          </div>

          {/* RTL: כפתורי פעולה — בצד שמאל */}
          <div className="flex items-center gap-1 shrink-0">
            {right}
          </div>
        </div>

        {/* sub-nav / tabs */}
        {below && (
          <div className="pb-0">
            {below}
          </div>
        )}
      </div>
    </div>
  )
}
