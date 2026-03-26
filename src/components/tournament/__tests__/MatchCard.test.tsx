'use client'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MatchCard } from '../MatchCard'
import type { Match, Bet } from '@/types'

// ── Mocks ────────────────────────────────────────────────────────────────────

const mockUseCountdown = vi.fn()
vi.mock('@/hooks/useCountdown', () => ({
  useCountdown: () => mockUseCountdown(),
}))

const mockPlaceBet = vi.fn()
vi.mock('@/context/TournamentContext', () => ({
  useTournament: () => ({ placeBet: mockPlaceBet }),
}))

vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({ currentUser: { id: 'user-1' } }),
}))

vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...p }: React.HTMLAttributes<HTMLDivElement>) => <div {...p}>{children}</div>,
  },
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

vi.mock('@/components/shared/TeamFlag', () => ({
  TeamFlag: ({ team }: { team: { name: string } }) => <span data-testid="team-flag">{team.name}</span>,
}))

vi.mock('@/components/tournament/CountdownTimer', () => ({
  CountdownTimer: () => <span data-testid="countdown">00:10:00</span>,
}))

vi.mock('@/components/tournament/ScoreInput', () => ({
  ScoreInput: ({ value, disabled, onChange }: { value: number | null; disabled: boolean; onChange: (v: number) => void }) => (
    <input
      data-testid="score-input"
      type="number"
      value={value ?? ''}
      disabled={disabled}
      onChange={(e) => onChange(Number(e.target.value))}
      readOnly={disabled}
    />
  ),
}))

vi.mock('@/components/shared/PointsBadge', () => ({
  PointsBadge: ({ result, points }: { result: string; points: number }) => (
    <span data-testid="points-badge">{points} נק׳</span>
  ),
}))

const mockCalculateScore = vi.fn()
vi.mock('@/lib/scoring', () => ({
  calculateScore: (...args: unknown[]) => mockCalculateScore(...args),
}))

// ── Fixtures ─────────────────────────────────────────────────────────────────

function makeMatch(overrides: Partial<Match> = {}): Match {
  return {
    id: 'm1',
    tournamentId: 't1',
    homeTeam: { id: 'h1', name: 'הבית', shortCode: 'HME', flagUrl: '' },
    awayTeam: { id: 'a1', name: 'האורח', shortCode: 'AWY', flagUrl: '' },
    matchStartTime: new Date(Date.now() - 30 * 60 * 1000).toISOString(), // 30 min ago
    status: 'scheduled',
    actualScore: null,
    round: 'Regular Season - 5',
    ...overrides,
  }
}

function makeBet(overrides: Partial<Bet> = {}): Bet {
  return {
    id: 'b1',
    userId: 'user-1',
    matchId: 'm1',
    tournamentId: 't1',
    predictedScore: { home: 2, away: 1 },
    submittedAt: new Date().toISOString(),
    isLocked: false,
    ...overrides,
  }
}

const DEFAULT_PROPS = {
  userBet: null as Bet | null,
  allBets: [] as Bet[],
  participants: [{ id: 'user-1', displayName: 'ישראל' }],
}

// ── Setup ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks()
  mockUseCountdown.mockReturnValue({ isLocked: false, timeLeft: 600_000, formatted: '00:10:00' })
  mockCalculateScore.mockReturnValue({ result: 'exact', points: 10 })
})

// ── Live indicator ────────────────────────────────────────────────────────────

describe('LIVE indicator', () => {
  it('shows LIVE pill when match.status === live', () => {
    render(<MatchCard match={makeMatch({ status: 'live' })} {...DEFAULT_PROPS} />)
    expect(screen.getByText('LIVE')).toBeInTheDocument()
  })

  it('shows LIVE pill for client-side live (started <2.5h ago, isLocked)', () => {
    mockUseCountdown.mockReturnValue({ isLocked: true, timeLeft: 0, formatted: '' })
    const startTime = new Date(Date.now() - 60 * 60 * 1000).toISOString() // 1h ago
    render(<MatchCard match={makeMatch({ status: 'scheduled', matchStartTime: startTime })} {...DEFAULT_PROPS} />)
    expect(screen.getByText('LIVE')).toBeInTheDocument()
  })

  it('does NOT show LIVE pill for a finished match', () => {
    render(<MatchCard match={makeMatch({ status: 'finished', actualScore: { home: 1, away: 0 } })} {...DEFAULT_PROPS} />)
    expect(screen.queryByText('LIVE')).not.toBeInTheDocument()
  })

  it('does NOT show LIVE pill when match started >2.5h ago and still scheduled', () => {
    mockUseCountdown.mockReturnValue({ isLocked: true, timeLeft: 0, formatted: '' })
    const startTime = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString() // 3h ago
    render(<MatchCard match={makeMatch({ status: 'scheduled', matchStartTime: startTime })} {...DEFAULT_PROPS} />)
    expect(screen.queryByText('LIVE')).not.toBeInTheDocument()
  })
})

// ── Live time chip ────────────────────────────────────────────────────────────

describe('live time chip', () => {
  it('shows minute from DB when liveMinute is set', () => {
    render(<MatchCard match={makeMatch({ status: 'live', liveMinute: 67 })} {...DEFAULT_PROPS} />)
    expect(screen.getByText("67′")).toBeInTheDocument()
  })

  it('shows calculated minute when liveMinute is not set (1H period)', () => {
    const startTime = new Date(Date.now() - 33 * 60 * 1000).toISOString() // 33 min ago
    render(<MatchCard match={makeMatch({ status: 'live', matchStartTime: startTime, matchPeriod: '1H' })} {...DEFAULT_PROPS} />)
    // Should show ~33′ (client-side calc)
    const chip = screen.getByText(/^\d+′$/)
    const minute = parseInt(chip.textContent!)
    expect(minute).toBeGreaterThanOrEqual(32)
    expect(minute).toBeLessThanOrEqual(34)
  })

  it('shows "הפסקה" chip during HT', () => {
    render(<MatchCard match={makeMatch({ status: 'live', matchPeriod: 'HT', liveMinute: 45 })} {...DEFAULT_PROPS} />)
    expect(screen.getByText('הפסקה')).toBeInTheDocument()
    expect(screen.queryByText("45′")).not.toBeInTheDocument()
  })

  it('shows "הפסקה" chip during BT (break time)', () => {
    render(<MatchCard match={makeMatch({ status: 'live', matchPeriod: 'BT' })} {...DEFAULT_PROPS} />)
    expect(screen.getByText('הפסקה')).toBeInTheDocument()
  })

  it('shows "פנדלים" chip during penalty shootout', () => {
    render(<MatchCard match={makeMatch({ status: 'live', matchPeriod: 'P' })} {...DEFAULT_PROPS} />)
    expect(screen.getByText('פנדלים')).toBeInTheDocument()
  })

  it('shows "הארכה" chip during ET without minute', () => {
    render(<MatchCard match={makeMatch({ status: 'live', matchPeriod: 'ET' })} {...DEFAULT_PROPS} />)
    expect(screen.getByText('הארכה')).toBeInTheDocument()
  })

  it('shows ET minute when ET + liveMinute is set', () => {
    render(<MatchCard match={makeMatch({ status: 'live', matchPeriod: 'ET', liveMinute: 97 })} {...DEFAULT_PROPS} />)
    expect(screen.getByText("97′")).toBeInTheDocument()
  })

  it('does NOT calculate minute during HT (paused)', () => {
    // match started 60 min ago — would naively compute 60, but HT should block it
    const startTime = new Date(Date.now() - 60 * 60 * 1000).toISOString()
    render(<MatchCard match={makeMatch({ status: 'live', matchPeriod: 'HT', matchStartTime: startTime })} {...DEFAULT_PROPS} />)
    expect(screen.queryByText(/^\d+′$/)).not.toBeInTheDocument()
  })

  it('caps client-side minute at 90', () => {
    const startTime = new Date(Date.now() - 95 * 60 * 1000).toISOString() // 95 min ago
    render(<MatchCard match={makeMatch({ status: 'live', matchPeriod: '2H', matchStartTime: startTime })} {...DEFAULT_PROPS} />)
    expect(screen.getByText("90′")).toBeInTheDocument()
  })
})

// ── Live match center display ─────────────────────────────────────────────────

describe('live match score display', () => {
  it('shows actual score (not ScoreInputs) when live', () => {
    render(<MatchCard
      match={makeMatch({ status: 'live', actualScore: { home: 2, away: 1 } })}
      {...DEFAULT_PROPS}
    />)
    // Big score digits visible
    expect(screen.getByText('2')).toBeInTheDocument()
    expect(screen.getByText('1')).toBeInTheDocument()
    // No editable score inputs
    expect(screen.queryByTestId('score-input')).not.toBeInTheDocument()
  })

  it('shows 0–0 when live and no actual score yet', () => {
    render(<MatchCard match={makeMatch({ status: 'live', actualScore: null })} {...DEFAULT_PROPS} />)
    const zeros = screen.getAllByText('0')
    expect(zeros.length).toBeGreaterThanOrEqual(2)
  })

  it('shows user prediction below live score', () => {
    const bet = makeBet({ predictedScore: { home: 3, away: 0 } })
    render(<MatchCard
      match={makeMatch({ status: 'live', actualScore: { home: 1, away: 1 } })}
      userBet={bet}
      allBets={[bet]}
      participants={DEFAULT_PROPS.participants}
    />)
    expect(screen.getByText('ניחוש שלי:')).toBeInTheDocument()
    expect(screen.getByText('3–0')).toBeInTheDocument()
  })

  it('shows "לא ניחשת" when live and user has no bet', () => {
    render(<MatchCard match={makeMatch({ status: 'live', actualScore: { home: 0, away: 0 } })} {...DEFAULT_PROPS} />)
    expect(screen.getByText('לא ניחשת')).toBeInTheDocument()
  })
})

// ── Finished match display ────────────────────────────────────────────────────

describe('finished match display', () => {
  it('shows actual final score prominently (not ScoreInputs)', () => {
    render(<MatchCard
      match={makeMatch({ status: 'finished', actualScore: { home: 3, away: 2 } })}
      {...DEFAULT_PROPS}
    />)
    expect(screen.getByText('3')).toBeInTheDocument()
    expect(screen.getByText('2')).toBeInTheDocument()
    expect(screen.queryByTestId('score-input')).not.toBeInTheDocument()
  })

  it('shows user prediction and points badge below score', () => {
    mockCalculateScore.mockReturnValue({ result: 'outcome', points: 5 })
    const bet = makeBet({ predictedScore: { home: 2, away: 1 } })
    render(<MatchCard
      match={makeMatch({ status: 'finished', actualScore: { home: 1, away: 0 } })}
      userBet={bet}
      allBets={[bet]}
      participants={DEFAULT_PROPS.participants}
    />)
    expect(screen.getByText('ניחוש שלי:')).toBeInTheDocument()
    expect(screen.getByText('2–1')).toBeInTheDocument()
    expect(screen.getByTestId('points-badge')).toBeInTheDocument()
  })

  it('shows "לא ניחשת" when finished and user has no bet', () => {
    render(<MatchCard
      match={makeMatch({ status: 'finished', actualScore: { home: 0, away: 0 } })}
      {...DEFAULT_PROPS}
    />)
    expect(screen.getByText('לא ניחשת')).toBeInTheDocument()
  })

  it('does not show LIVE pill for finished match', () => {
    render(<MatchCard
      match={makeMatch({ status: 'finished', actualScore: { home: 1, away: 1 } })}
      {...DEFAULT_PROPS}
    />)
    expect(screen.queryByText('LIVE')).not.toBeInTheDocument()
  })
})

// ── Scheduled / not-yet-started match ────────────────────────────────────────

describe('scheduled match', () => {
  it('shows ScoreInputs when not locked', () => {
    const futureTime = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString()
    render(<MatchCard match={makeMatch({ matchStartTime: futureTime })} {...DEFAULT_PROPS} />)
    const inputs = screen.getAllByTestId('score-input')
    expect(inputs.length).toBe(2)
    inputs.forEach(i => expect(i).not.toBeDisabled())
  })

  it('shows countdown timer when not locked', () => {
    render(<MatchCard match={makeMatch()} {...DEFAULT_PROPS} />)
    expect(screen.getByTestId('countdown')).toBeInTheDocument()
  })

  it('shows "הניחושים נעולים" when locked and not live and not finished', () => {
    mockUseCountdown.mockReturnValue({ isLocked: true, timeLeft: 0, formatted: '' })
    // match is in the past but >2.5h ago → not client-side live
    const oldTime = new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString()
    render(<MatchCard match={makeMatch({ matchStartTime: oldTime, status: 'scheduled' })} {...DEFAULT_PROPS} />)
    expect(screen.getByText('הניחושים נעולים — ממתינים לתוצאה')).toBeInTheDocument()
  })
})

// ── Save bet flow ─────────────────────────────────────────────────────────────

describe('save bet', () => {
  it('save button appears after changing score', async () => {
    const user = userEvent.setup()
    const futureTime = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString()
    render(<MatchCard match={makeMatch({ matchStartTime: futureTime })} {...DEFAULT_PROPS} />)
    const [homeInput] = screen.getAllByTestId('score-input')
    await user.clear(homeInput)
    await user.type(homeInput, '3')
    expect(screen.getByText('שמור')).toBeInTheDocument()
  })

  it('calls placeBet with correct scores on save', async () => {
    const user = userEvent.setup()
    mockPlaceBet.mockResolvedValue(true)
    const futureTime = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString()
    render(<MatchCard match={makeMatch({ matchStartTime: futureTime })} {...DEFAULT_PROPS} />)
    const [homeInput, awayInput] = screen.getAllByTestId('score-input')
    await user.clear(homeInput)
    await user.type(homeInput, '2')
    await user.clear(awayInput)
    await user.type(awayInput, '1')
    await user.click(screen.getByText('שמור'))
    expect(mockPlaceBet).toHaveBeenCalledWith('m1', { home: 2, away: 1 }, 'user-1')
  })

  it('shows "נשמר" briefly after successful save', async () => {
    const user = userEvent.setup()
    mockPlaceBet.mockResolvedValue(true)
    const futureTime = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString()
    render(<MatchCard match={makeMatch({ matchStartTime: futureTime })} {...DEFAULT_PROPS} />)
    const [homeInput] = screen.getAllByTestId('score-input')
    await user.clear(homeInput)
    await user.type(homeInput, '3')
    await user.click(screen.getByText('שמור'))
    expect(await screen.findByText('נשמר')).toBeInTheDocument()
  })

  it('shows "שגיאה" when placeBet fails', async () => {
    const user = userEvent.setup()
    mockPlaceBet.mockResolvedValue(false)
    const futureTime = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString()
    render(<MatchCard match={makeMatch({ matchStartTime: futureTime })} {...DEFAULT_PROPS} />)
    const [homeInput] = screen.getAllByTestId('score-input')
    await user.clear(homeInput)
    await user.type(homeInput, '3')
    await user.click(screen.getByText('שמור'))
    expect(await screen.findByText('שגיאה')).toBeInTheDocument()
  })
})

// ── Other participants' bets ──────────────────────────────────────────────────

describe('other participants bets', () => {
  it('shows others bets toggle when locked', () => {
    mockUseCountdown.mockReturnValue({ isLocked: true, timeLeft: 0, formatted: '' })
    const oldTime = new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString()
    const otherBet = makeBet({ id: 'b2', userId: 'user-2', predictedScore: { home: 1, away: 3 } })
    render(<MatchCard
      match={makeMatch({ matchStartTime: oldTime })}
      userBet={null}
      allBets={[otherBet]}
      participants={[{ id: 'user-2', displayName: 'יובל' }]}
    />)
    expect(screen.getByText('ניחושי שאר המשתתפים (1)')).toBeInTheDocument()
  })

  it('shows others bets toggle when live', async () => {
    const otherBet = makeBet({ id: 'b2', userId: 'user-2', predictedScore: { home: 0, away: 2 } })
    render(<MatchCard
      match={makeMatch({ status: 'live' })}
      userBet={null}
      allBets={[otherBet]}
      participants={[{ id: 'user-2', displayName: 'יובל' }]}
    />)
    expect(screen.getByText('ניחושי שאר המשתתפים (1)')).toBeInTheDocument()
  })

  it('reveals bets on click', async () => {
    const user = userEvent.setup()
    mockUseCountdown.mockReturnValue({ isLocked: true, timeLeft: 0, formatted: '' })
    const oldTime = new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString()
    const otherBet = makeBet({ id: 'b2', userId: 'user-2', predictedScore: { home: 1, away: 3 } })
    render(<MatchCard
      match={makeMatch({ matchStartTime: oldTime })}
      userBet={null}
      allBets={[otherBet]}
      participants={[{ id: 'user-2', displayName: 'יובל' }]}
    />)
    await user.click(screen.getByText('ניחושי שאר המשתתפים (1)'))
    expect(screen.getByText('יובל')).toBeInTheDocument()
    expect(screen.getByText('1 – 3')).toBeInTheDocument()
  })
})
