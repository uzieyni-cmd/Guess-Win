'use client'
import { useTournament } from '@/context/TournamentContext'
import { BettingZone } from '@/components/tournament/BettingZone'
import { Target } from 'lucide-react'

export default function MatchesPage() {
  const { activeTournament } = useTournament()

  if (!activeTournament) {
    return <div className="flex justify-center py-16"><div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" /></div>
  }

  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <Target className="h-5 w-5 text-indigo-600" />
        <h2 className="font-suez text-xl text-gray-800">ניחושי משחקים</h2>
      </div>
      <BettingZone matches={activeTournament.matches} />
    </div>
  )
}
