import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import ProfilePage from '../page'

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockBack = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ back: mockBack, push: vi.fn() }),
}))

// AuthGuard renders children directly in tests
vi.mock('@/components/auth/AuthGuard', () => ({
  AuthGuard: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

// framer-motion renders a plain div
vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
      <div {...props}>{children}</div>
    ),
  },
}))

const mockRefreshUser = vi.fn().mockResolvedValue(undefined)
const mockUseAuth = vi.fn()
vi.mock('@/context/AuthContext', () => ({
  useAuth: () => mockUseAuth(),
}))

// Supabase mock — configurable per test via mockSupabaseFrom
const mockEq = vi.fn()
const mockSelect = vi.fn()
const mockUpdate = vi.fn()
const mockFrom = vi.fn()
const mockSignInWithPassword = vi.fn()
const mockUpdateUser = vi.fn()
const mockUpload = vi.fn()
const mockGetPublicUrl = vi.fn()

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: (...args: unknown[]) => mockFrom(...args),
    auth: {
      signInWithPassword: (...args: unknown[]) => mockSignInWithPassword(...args),
      updateUser: (...args: unknown[]) => mockUpdateUser(...args),
    },
    storage: {
      from: () => ({
        upload: (...args: unknown[]) => mockUpload(...args),
        getPublicUrl: (...args: unknown[]) => mockGetPublicUrl(...args),
      }),
    },
  },
}))

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeUser(overrides = {}) {
  return {
    id: 'user-1',
    email: 'test@example.com',
    displayName: 'ישראל ישראלי',
    role: 'user' as const,
    competitionIds: [],
    ...overrides,
  }
}

/** Default: empty bets, no error */
function setupDefaultSupabase() {
  mockFrom.mockReturnValue({ select: mockSelect, update: mockUpdate })
  mockSelect.mockReturnValue({ eq: mockEq })
  mockUpdate.mockReturnValue({ eq: mockEq })
  mockEq.mockResolvedValue({ data: [], error: null })
}

// ── Tests ──────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks()
  mockUseAuth.mockReturnValue({ currentUser: makeUser(), refreshUser: mockRefreshUser })
  setupDefaultSupabase()
})

// ─── Profile card ─────────────────────────────────────────────────────────────

describe('profile card', () => {
  it('shows display name and email', async () => {
    render(<ProfilePage />)
    expect(screen.getByText('ישראל ישראלי')).toBeInTheDocument()
    expect(screen.getByText('test@example.com')).toBeInTheDocument()
  })

  it('shows admin badge for admin users', async () => {
    mockUseAuth.mockReturnValue({ currentUser: makeUser({ role: 'admin' }), refreshUser: mockRefreshUser })
    render(<ProfilePage />)
    expect(screen.getByText('מנהל')).toBeInTheDocument()
  })

  it('does not show admin badge for regular users', () => {
    render(<ProfilePage />)
    expect(screen.queryByText('מנהל')).not.toBeInTheDocument()
  })

  it('shows initials in avatar fallback', () => {
    render(<ProfilePage />)
    // First letter of "ישראל" is "י"
    expect(screen.getAllByText('י').length).toBeGreaterThan(0)
  })

  it('navigates back when back button is clicked', async () => {
    const user = userEvent.setup()
    render(<ProfilePage />)
    // The back button is the first button (ArrowRight icon)
    await user.click(screen.getAllByRole('button')[0])
    expect(mockBack).toHaveBeenCalled()
  })
})

// ─── Edit name form ───────────────────────────────────────────────────────────

describe('edit name form', () => {
  it('save button is disabled when name equals current name', () => {
    render(<ProfilePage />)
    const saveBtn = screen.getByRole('button', { name: /שמירה/ })
    expect(saveBtn).toBeDisabled()
  })

  it('save button is disabled when name is cleared', async () => {
    const user = userEvent.setup()
    render(<ProfilePage />)
    const input = screen.getByPlaceholderText('השם שלך')
    await user.clear(input)
    expect(screen.getByRole('button', { name: /שמירה/ })).toBeDisabled()
  })

  it('save button is enabled when name differs', async () => {
    const user = userEvent.setup()
    render(<ProfilePage />)
    const input = screen.getByPlaceholderText('השם שלך')
    await user.clear(input)
    await user.type(input, 'שם חדש')
    expect(screen.getByRole('button', { name: /שמירה/ })).toBeEnabled()
  })

  it('shows success message after successful save', async () => {
    const user = userEvent.setup()
    mockEq.mockResolvedValue({ data: null, error: null })
    render(<ProfilePage />)
    const input = screen.getByPlaceholderText('השם שלך')
    await user.clear(input)
    await user.type(input, 'שם חדש')
    await user.click(screen.getByRole('button', { name: /שמירה/ }))
    await waitFor(() => expect(screen.getByText('השם עודכן בהצלחה')).toBeInTheDocument())
    expect(mockRefreshUser).toHaveBeenCalled()
  })

  it('shows error message when save fails', async () => {
    const user = userEvent.setup()
    mockUpdate.mockReturnValue({ eq: vi.fn().mockResolvedValue({ data: null, error: new Error('DB error') }) })
    render(<ProfilePage />)
    const input = screen.getByPlaceholderText('השם שלך')
    await user.clear(input)
    await user.type(input, 'שם חדש')
    await user.click(screen.getByRole('button', { name: /שמירה/ }))
    await waitFor(() => expect(screen.getByText('שגיאה בשמירת השם')).toBeInTheDocument())
  })
})

// ─── Change password form ─────────────────────────────────────────────────────

describe('change password form', () => {
  function getPasswordInputs() {
    const inputs = screen.getAllByPlaceholderText('••••••••')
    return { currentPw: inputs[0], newPw: inputs[1], confirmPw: inputs[2] }
  }

  it('submit button is disabled when fields are empty', () => {
    render(<ProfilePage />)
    expect(screen.getByRole('button', { name: /שינוי סיסמה/ })).toBeDisabled()
  })

  it('shows error when new passwords do not match', async () => {
    const user = userEvent.setup()
    render(<ProfilePage />)
    const { currentPw, newPw, confirmPw } = getPasswordInputs()
    await user.type(currentPw, 'oldpass')
    await user.type(newPw, 'newpass1')
    await user.type(confirmPw, 'newpass2')
    await user.click(screen.getByRole('button', { name: /שינוי סיסמה/ }))
    expect(screen.getByText('הסיסמאות אינן תואמות')).toBeInTheDocument()
  })

  it('shows error when new password is less than 6 characters', async () => {
    const user = userEvent.setup()
    render(<ProfilePage />)
    const { currentPw, newPw, confirmPw } = getPasswordInputs()
    await user.type(currentPw, 'oldpass')
    await user.type(newPw, 'abc')
    await user.type(confirmPw, 'abc')
    await user.click(screen.getByRole('button', { name: /שינוי סיסמה/ }))
    expect(screen.getByText('הסיסמה חייבת להיות לפחות 6 תווים')).toBeInTheDocument()
  })

  it('shows error when current password is wrong', async () => {
    const user = userEvent.setup()
    mockSignInWithPassword.mockResolvedValue({ error: new Error('Invalid credentials') })
    render(<ProfilePage />)
    const { currentPw, newPw, confirmPw } = getPasswordInputs()
    await user.type(currentPw, 'wrongpass')
    await user.type(newPw, 'newpass1')
    await user.type(confirmPw, 'newpass1')
    await user.click(screen.getByRole('button', { name: /שינוי סיסמה/ }))
    await waitFor(() => expect(screen.getByText('הסיסמה הנוכחית שגויה')).toBeInTheDocument())
  })

  it('shows success and clears inputs on valid password change', async () => {
    const user = userEvent.setup()
    mockSignInWithPassword.mockResolvedValue({ error: null })
    mockUpdateUser.mockResolvedValue({ error: null })
    render(<ProfilePage />)
    const { currentPw, newPw, confirmPw } = getPasswordInputs()
    await user.type(currentPw, 'oldpass')
    await user.type(newPw, 'newpass1')
    await user.type(confirmPw, 'newpass1')
    await user.click(screen.getByRole('button', { name: /שינוי סיסמה/ }))
    await waitFor(() => expect(screen.getByText('הסיסמה עודכנה בהצלחה')).toBeInTheDocument())
    const inputs = screen.getAllByPlaceholderText('••••••••')
    inputs.forEach((input) => expect(input).toHaveValue(''))
  })

  it('shows error when updateUser fails', async () => {
    const user = userEvent.setup()
    mockSignInWithPassword.mockResolvedValue({ error: null })
    mockUpdateUser.mockResolvedValue({ error: new Error('update failed') })
    render(<ProfilePage />)
    const { currentPw, newPw, confirmPw } = getPasswordInputs()
    await user.type(currentPw, 'oldpass')
    await user.type(newPw, 'newpass1')
    await user.type(confirmPw, 'newpass1')
    await user.click(screen.getByRole('button', { name: /שינוי סיסמה/ }))
    await waitFor(() => expect(screen.getByText('שגיאה בשינוי הסיסמה')).toBeInTheDocument())
  })
})

// ─── Statistics ───────────────────────────────────────────────────────────────

describe('statistics', () => {
  it('shows "אין ניחושים עדיין" when user has no bets', async () => {
    render(<ProfilePage />)
    await waitFor(() => expect(screen.getByText('אין ניחושים עדיין')).toBeInTheDocument())
  })

  it('displays stats grid when bets exist', async () => {
    mockEq.mockResolvedValue({
      data: [
        // exact hit: 2-1 vs 2-1 → 10 pts
        { predicted_home: 2, predicted_away: 1, tournament_id: 't1', matches: { actual_home_score: 2, actual_away_score: 1 } },
        // outcome hit: 3-0 vs 1-0 (home wins both) → 5 pts
        { predicted_home: 3, predicted_away: 0, tournament_id: 't1', matches: { actual_home_score: 1, actual_away_score: 0 } },
        // miss: predicted home win, actual draw → 0 pts
        { predicted_home: 2, predicted_away: 0, tournament_id: 't2', matches: { actual_home_score: 1, actual_away_score: 1 } },
        // pending match (no result yet)
        { predicted_home: 1, predicted_away: 1, tournament_id: 't2', matches: { actual_home_score: null, actual_away_score: null } },
      ],
      error: null,
    })
    render(<ProfilePage />)

    await waitFor(() => expect(screen.getByText('סה״כ ניחושים')).toBeInTheDocument())

    // Total bets = 4, finished = 3
    expect(screen.getByText('4')).toBeInTheDocument()
    expect(screen.getByText('3')).toBeInTheDocument()

    // Points: 10 + 5 + 0 = 15
    expect(screen.getByText('15')).toBeInTheDocument()

    // exact=1, outcome=1, miss=1
    expect(screen.getByText('תוצאה מדויקת')).toBeInTheDocument()
    expect(screen.getByText('כיוון נכון')).toBeInTheDocument()
    expect(screen.getByText('החטאה')).toBeInTheDocument()

    // Tournaments: 2
    expect(screen.getByText('תחרויות')).toBeInTheDocument()
    expect(screen.getByText('2')).toBeInTheDocument()
  })

  it('calculates success percentage correctly', async () => {
    mockEq.mockResolvedValue({
      data: [
        // 2 exact hits + 1 miss = 3 finished → 66%
        { predicted_home: 1, predicted_away: 0, tournament_id: 't1', matches: { actual_home_score: 1, actual_away_score: 0 } },
        { predicted_home: 2, predicted_away: 2, tournament_id: 't1', matches: { actual_home_score: 2, actual_away_score: 2 } },
        { predicted_home: 3, predicted_away: 0, tournament_id: 't1', matches: { actual_home_score: 0, actual_away_score: 1 } },
      ],
      error: null,
    })
    render(<ProfilePage />)
    await waitFor(() => expect(screen.getByText('67%')).toBeInTheDocument())
  })

  it('correctly identifies a draw prediction as exact', async () => {
    mockEq.mockResolvedValue({
      data: [
        { predicted_home: 0, predicted_away: 0, tournament_id: 't1', matches: { actual_home_score: 0, actual_away_score: 0 } },
      ],
      error: null,
    })
    render(<ProfilePage />)
    await waitFor(() => expect(screen.getByText('10')).toBeInTheDocument())
  })

  it('handles matches returned as array (Supabase join format)', async () => {
    mockEq.mockResolvedValue({
      data: [
        {
          predicted_home: 1, predicted_away: 0, tournament_id: 't1',
          // Supabase sometimes returns the related row as an array
          matches: [{ actual_home_score: 1, actual_away_score: 0 }],
        },
      ],
      error: null,
    })
    render(<ProfilePage />)
    // Should still calculate 10 pts (exact)
    await waitFor(() => expect(screen.getByText('10')).toBeInTheDocument())
  })
})
