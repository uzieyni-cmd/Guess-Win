import { render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { BonusCountdownBanner } from '../BonusCountdownBanner'

const mockGetBonusQuestions = vi.fn()
vi.mock('@/app/actions/bonus', () => ({
  getBonusQuestions: (...args: unknown[]) => mockGetBonusQuestions(...args),
}))

vi.mock('next/link', () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}))

function q(lockTime: string) {
  return { id: 'x', tournamentId: 't1', type: 'number', question: 'q', options: [], correctOptions: null, points: 1, lockTime }
}

const future = () => new Date(Date.now() + 5 * 60 * 60 * 1000).toISOString()
const past   = () => new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString()

describe('BonusCountdownBanner', () => {
  beforeEach(() => vi.clearAllMocks())

  it('renders a countdown when at least one bonus is still open', async () => {
    mockGetBonusQuestions.mockResolvedValue([q(past()), q(future())])
    render(<BonusCountdownBanner tournamentId="t1" />)
    expect(await screen.findByText('בונוסים פתוחים')).toBeTruthy()
  })

  it('renders nothing when all bonuses are closed', async () => {
    mockGetBonusQuestions.mockResolvedValue([q(past()), q(past())])
    const { container } = render(<BonusCountdownBanner tournamentId="t1" />)
    await waitFor(() => expect(mockGetBonusQuestions).toHaveBeenCalled())
    // give the effect a tick to settle
    await new Promise(r => setTimeout(r, 20))
    expect(container.querySelector('a')).toBeNull()
  })
})
