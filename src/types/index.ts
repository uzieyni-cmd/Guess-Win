export type UserRole = 'user' | 'admin'

export interface User {
  id: string
  email: string
  displayName: string
  avatarUrl?: string
  role: UserRole
  competitionIds: string[]
}

export type TournamentStatus = 'upcoming' | 'active' | 'completed'

export interface Tournament {
  id: string
  name: string
  logoUrl: string
  description: string
  status: TournamentStatus
  isHidden: boolean
  participantIds: string[]
  matches: Match[]
  createdAt: string
  updatedAt: string
}

export interface Team {
  id: string
  name: string
  shortCode: string
  flagUrl: string
}

export type MatchStatus = 'scheduled' | 'locked' | 'live' | 'finished'

export interface Match {
  id: string
  tournamentId: string
  homeTeam: Team
  awayTeam: Team
  matchStartTime: string
  status: MatchStatus
  actualScore: Score | null
  round?: string
  liveMinute?: number
}

export interface Score {
  home: number
  away: number
}

export interface Bet {
  id: string
  userId: string
  matchId: string
  tournamentId: string
  predictedScore: Score
  submittedAt: string
  isLocked: boolean
}

export type ScoreResult = 'exact' | 'outcome' | 'miss'

export interface BetResult {
  bet: Bet
  match: Match
  result: ScoreResult
  points: number
}

export interface ParticipantStanding {
  user: User
  totalPoints: number
  rank: number
  betResults: BetResult[]
}
