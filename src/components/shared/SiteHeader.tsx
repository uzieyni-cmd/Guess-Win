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
        <div className="flex items-center justify-between h-14">
          {/* שמאל: actions (back, settings…) */}
          <div className="flex items-center gap-1 min-w-[80px]">
            {left}
          </div>

          {/* מרכז: לוגו + כותרת */}
          <div className="flex items-center gap-2.5 select-none">
            <Image src="/logo.svg" alt="Guess&Win" width={40} height={47} priority />
            <span className="font-black text-xl tracking-widest leading-none whitespace-nowrap">
              <span className="text-white">GUESS</span>
              <span className="text-yellow-400"> &amp; WIN</span>
            </span>
          </div>

          {/* ימין: actions (avatar, logout…) */}
          <div className="flex items-center gap-1 min-w-[80px] justify-end">
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
