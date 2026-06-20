import { Bet, BetResult, Match, ParticipantStanding, Score, ScoreResult, User } from '@/types'

export function getMatchOutcome(score: Score): 'home' | 'away' | 'draw' {
  if (score.home > score.away) return 'home'
  if (score.away > score.home) return 'away'
  return 'draw'
}

// הניקוד שמוצג למשתמש — לוקח מה-DB (כולל מדורגת וג'וקר)
export function betDisplayResult(bet: { points: number | null; betResult: string | null; teamBonusPick?: number }): { result: ScoreResult; points: number } | null {
  const bonus = bet.teamBonusPick ?? 0
  if (!bet.betResult && bet.points === null) {
    if (bonus > 0) return { result: 'miss', points: bonus }
    return null
  }
  if (!bet.betResult || bet.points === null) return null
  return { result: bet.betResult as ScoreResult, points: bet.points + bonus }
}

export function calculateScore(bet: Bet, match: Match): BetResult {
  if (!match.actualScore) {
    return { bet, match, result: 'miss', points: 0 }
  }

  const actual = match.actualScore
  const predicted = bet.predictedScore

  // Exact hit
  if (predicted.home === actual.home && predicted.away === actual.away) {
    return { bet, match, result: 'exact', points: 4 }
  }

  // Outcome hit (correct winner/draw)
  if (getMatchOutcome(predicted) === getMatchOutcome(actual)) {
    return { bet, match, result: 'outcome', points: 1 }
  }

  return { bet, match, result: 'miss', points: 0 }
}

export function deriveLeaderboard(
  users: User[],
  bets: Bet[],
  matches: Match[],
  tournamentId: string
): ParticipantStanding[] {
  const matchMap = new Map(matches.map((m) => [m.id, m]))
  const finishedMatches = matches.filter((m) => m.actualScore !== null)

  const standings: ParticipantStanding[] = users.map((user) => {
    const userBets = bets.filter(
      (b) => b.userId === user.id && b.tournamentId === tournamentId
    )
    const betResults: BetResult[] = []

    for (const bet of userBets) {
      const match = matchMap.get(bet.matchId)
      if (match && finishedMatches.find((m) => m.id === match.id)) {
        betResults.push(calculateScore(bet, match))
      }
    }

    const totalPoints = betResults.reduce((sum, r) => sum + r.points, 0)
    const exactCount = betResults.filter(r => r.result === 'exact').length
    return { user, totalPoints, rank: 0, betResults, scoredBetsCount: betResults.length, exactCount }
  })

  standings.sort((a, b) => b.totalPoints - a.totalPoints || b.exactCount - a.exactCount)
  standings.forEach((s, i) => (s.rank = i + 1))

  return standings
}
