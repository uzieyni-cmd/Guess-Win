import { Bet, BetResult, Match, ParticipantStanding, Score, ScoreResult, User } from '@/types'

export function getMatchOutcome(score: Score): 'home' | 'away' | 'draw' {
  if (score.home > score.away) return 'home'
  if (score.away > score.home) return 'away'
  return 'draw'
}

export function calculateScore(bet: Bet, match: Match): BetResult {
  if (!match.actualScore) {
    return { bet, match, result: 'miss', points: 0 }
  }

  const actual = match.actualScore
  const predicted = bet.predictedScore

  // Exact hit
  if (predicted.home === actual.home && predicted.away === actual.away) {
    return { bet, match, result: 'exact', points: 10 }
  }

  // Outcome hit (correct winner/draw)
  if (getMatchOutcome(predicted) === getMatchOutcome(actual)) {
    return { bet, match, result: 'outcome', points: 5 }
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
    return { user, totalPoints, rank: 0, betResults }
  })

  standings.sort((a, b) => b.totalPoints - a.totalPoints)
  standings.forEach((s, i) => (s.rank = i + 1))

  return standings
}
