import { Tournament } from '@/types'

interface CreateTournamentInput {
  name: string
  description: string
  logoUrl: string
  participantIds: string[]
}

export function generateTournament(input: CreateTournamentInput): Tournament {
  return {
    id: `tournament-${Date.now()}`,
    name: input.name,
    logoUrl: input.logoUrl || 'https://flagcdn.com/w40/un.png',
    description: input.description,
    status: 'upcoming',
    participantIds: input.participantIds,
    matches: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
}
