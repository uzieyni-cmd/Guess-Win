export function MatchCardSkeleton() {
  return (
    <div className="rounded-2xl overflow-hidden border border-slate-700/30 bg-[#0d1420] animate-pulse">
      {/* header strip */}
      <div className="h-8 bg-slate-800/60 border-b border-slate-700/20" />

      <div className="p-4">
        {/* teams row */}
        <div className="flex items-center gap-3">
          {/* home team */}
          <div className="flex-1 flex flex-col items-center gap-2">
            <div className="h-14 w-14 rounded-full bg-slate-700/50" />
            <div className="h-3 w-16 rounded bg-slate-700/50" />
          </div>

          {/* score inputs */}
          <div className="flex flex-col items-center gap-1.5 shrink-0">
            <div className="h-7 w-7 rounded bg-slate-700/30" />
            <div className="h-11 w-11 rounded-lg bg-slate-700/50" />
            <div className="h-7 w-7 rounded bg-slate-700/30" />
          </div>

          <div className="h-5 w-5 rounded bg-slate-700/30 shrink-0" />

          <div className="flex flex-col items-center gap-1.5 shrink-0">
            <div className="h-7 w-7 rounded bg-slate-700/30" />
            <div className="h-11 w-11 rounded-lg bg-slate-700/50" />
            <div className="h-7 w-7 rounded bg-slate-700/30" />
          </div>

          {/* away team */}
          <div className="flex-1 flex flex-col items-center gap-2">
            <div className="h-14 w-14 rounded-full bg-slate-700/50" />
            <div className="h-3 w-16 rounded bg-slate-700/50" />
          </div>
        </div>

        {/* save button */}
        <div className="mt-4 h-9 rounded-lg bg-slate-700/40 w-full" />
      </div>
    </div>
  )
}

export function BettingZoneSkeleton() {
  return (
    <div className="space-y-6">
      {/* date header */}
      <div>
        <div className="h-4 w-32 rounded bg-slate-700/40 mb-3 animate-pulse" />
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
          {Array.from({ length: 4 }).map((_, i) => (
            <MatchCardSkeleton key={i} />
          ))}
        </div>
      </div>
    </div>
  )
}
