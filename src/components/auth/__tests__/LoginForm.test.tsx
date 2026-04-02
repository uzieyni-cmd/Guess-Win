import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { LoginForm } from '../LoginForm'

// ── Mocks ──────────────────────────────────────────────────────────────────────

const mockPush = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}))

vi.mock('next/image', () => ({
  default: ({ src, alt, ...props }: React.ImgHTMLAttributes<HTMLImageElement> & { src: string }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} {...props} />
  ),
}))

vi.mock('framer-motion', () => ({
  motion: {
    div:  ({ children, ...p }: React.HTMLAttributes<HTMLDivElement>)  => <div {...p}>{children}</div>,
    form: ({ children, ...p }: React.HTMLAttributes<HTMLFormElement>) => <form {...p}>{children}</form>,
  },
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

const mockLogin    = vi.fn()
const mockRegister = vi.fn()
const mockUseAuth  = vi.fn()

vi.mock('@/context/AuthContext', () => ({
  useAuth: () => mockUseAuth(),
}))

// ── Helpers ────────────────────────────────────────────────────────────────────

/** The submit button (type=submit) — avoids confusing it with tab buttons */
const getSubmit = () =>
  screen.getAllByRole('button').find(b => b.getAttribute('type') === 'submit')!

/** Tab button with given text (no type attribute) */
const getTab = (name: string) =>
  screen.getAllByRole('button', { name }).find(b => !b.getAttribute('type'))!

// ── Setup ──────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks()
  mockUseAuth.mockReturnValue({ login: mockLogin, register: mockRegister, currentUser: null })
})

// ── Logo ───────────────────────────────────────────────────────────────────────

describe('logo', () => {
  it('renders the SVG logo with correct src and alt', () => {
    render(<LoginForm />)
    const img = screen.getByAltText('Guess&Win')
    expect(img).toBeInTheDocument()
    expect(img).toHaveAttribute('src', '/logo.svg')
  })
})

// ── Tab switching ──────────────────────────────────────────────────────────────

describe('tab switching', () => {
  it('shows login form by default (register-only field absent)', () => {
    render(<LoginForm />)
    expect(screen.queryByPlaceholderText('השם שיופיע בלוח תוצאות')).not.toBeInTheDocument()
    expect(screen.getAllByPlaceholderText('you@example.com').length).toBeGreaterThan(0)
  })

  it('switches to register form when clicking הרשמה tab', async () => {
    const user = userEvent.setup()
    render(<LoginForm />)
    await user.click(getTab('הרשמה'))
    expect(screen.getByPlaceholderText('השם שיופיע בלוח תוצאות')).toBeInTheDocument()
  })

  it('clears fields when switching back to login', async () => {
    const user = userEvent.setup()
    render(<LoginForm />)
    // Type into email on login tab
    const [emailInput] = screen.getAllByPlaceholderText('you@example.com')
    await user.type(emailInput, 'test@mail.com')
    // Switch to register then back to login
    await user.click(getTab('הרשמה'))
    await user.click(getTab('כניסה'))
    expect(screen.getAllByPlaceholderText('you@example.com')[0]).toHaveValue('')
  })
})

// ── Login form ─────────────────────────────────────────────────────────────────

describe('login form', () => {
  it('calls login with email and password on submit', async () => {
    const user = userEvent.setup()
    mockLogin.mockResolvedValue(undefined)
    render(<LoginForm />)
    await user.type(screen.getAllByPlaceholderText('you@example.com')[0], 'a@b.com')
    await user.type(screen.getAllByPlaceholderText('••••••••')[0], 'secret123')
    await user.click(getSubmit())
    await waitFor(() => expect(mockLogin).toHaveBeenCalledWith('a@b.com', 'secret123'))
  })

  it('shows error message when login fails', async () => {
    const user = userEvent.setup()
    mockLogin.mockRejectedValue(new Error('אימייל או סיסמה שגויים'))
    render(<LoginForm />)
    await user.type(screen.getAllByPlaceholderText('you@example.com')[0], 'a@b.com')
    await user.type(screen.getAllByPlaceholderText('••••••••')[0], 'wrong')
    await user.click(getSubmit())
    await waitFor(() => expect(screen.getByText('אימייל או סיסמה שגויים')).toBeInTheDocument())
  })

  it('disables submit button while loading', async () => {
    const user = userEvent.setup()
    let resolve!: () => void
    mockLogin.mockReturnValue(new Promise<void>((r) => { resolve = r }))
    render(<LoginForm />)
    await user.type(screen.getAllByPlaceholderText('you@example.com')[0], 'a@b.com')
    await user.type(screen.getAllByPlaceholderText('••••••••')[0], 'pass123')
    await user.click(getSubmit())
    expect(getSubmit()).toBeDisabled()
    resolve()
  })
})

// ── Password visibility toggle (login) ────────────────────────────────────────

describe('password visibility toggle — login', () => {
  // The eye toggle is the only type="button" inside a .relative div in the login form
  function getEyeToggle() {
    return screen.getAllByRole('button').find(
      b => b.getAttribute('type') === 'button'
    )!
  }

  it('password input is type=password by default', () => {
    render(<LoginForm />)
    expect(screen.getAllByPlaceholderText('••••••••')[0]).toHaveAttribute('type', 'password')
  })

  it('reveals password when eye toggle is clicked', async () => {
    const user = userEvent.setup()
    render(<LoginForm />)
    await user.click(getEyeToggle())
    expect(screen.getAllByPlaceholderText('••••••••')[0]).toHaveAttribute('type', 'text')
  })

  it('hides password again on second click', async () => {
    const user = userEvent.setup()
    render(<LoginForm />)
    await user.click(getEyeToggle())
    await user.click(getEyeToggle())
    expect(screen.getAllByPlaceholderText('••••••••')[0]).toHaveAttribute('type', 'password')
  })
})

// ── Register form ──────────────────────────────────────────────────────────────

describe('register form', () => {
  async function switchToRegister() {
    const user = userEvent.setup()
    render(<LoginForm />)
    await user.click(getTab('הרשמה'))
    return user
  }

  it('shows error when display name is whitespace-only', async () => {
    const user = await switchToRegister()
    // Type only spaces — passes the native `required` check but fails .trim()
    await user.type(screen.getByPlaceholderText('השם שיופיע בלוח תוצאות'), '   ')
    await user.type(screen.getByPlaceholderText('you@example.com'), 'a@b.com')
    await user.type(screen.getByPlaceholderText('לפחות 6 תווים'), 'pass123')
    await user.type(screen.getByPlaceholderText('הזן שוב את הסיסמה'), 'pass123')
    await user.click(getSubmit())
    await waitFor(() => expect(screen.getByText('נא להזין שם תצוגה')).toBeInTheDocument())
    expect(mockRegister).not.toHaveBeenCalled()
  })

  it('shows error when password is less than 6 characters', async () => {
    const user = await switchToRegister()
    await user.type(screen.getByPlaceholderText('השם שיופיע בלוח תוצאות'), 'נועה')
    await user.type(screen.getByPlaceholderText('you@example.com'), 'a@b.com')
    await user.type(screen.getByPlaceholderText('לפחות 6 תווים'), 'abc')
    await user.type(screen.getByPlaceholderText('הזן שוב את הסיסמה'), 'abc')
    await user.click(getSubmit())
    expect(screen.getByText('הסיסמה חייבת להכיל לפחות 6 תווים')).toBeInTheDocument()
  })

  it('shows error when passwords do not match', async () => {
    const user = await switchToRegister()
    await user.type(screen.getByPlaceholderText('השם שיופיע בלוח תוצאות'), 'נועה')
    await user.type(screen.getByPlaceholderText('you@example.com'), 'a@b.com')
    await user.type(screen.getByPlaceholderText('לפחות 6 תווים'), 'pass123')
    await user.type(screen.getByPlaceholderText('הזן שוב את הסיסמה'), 'pass456')
    await user.click(getSubmit())
    expect(screen.getByText('הסיסמאות אינן תואמות')).toBeInTheDocument()
  })

  it('calls register with trimmed name on valid input', async () => {
    const user = await switchToRegister()
    mockRegister.mockResolvedValue(undefined)
    await user.type(screen.getByPlaceholderText('השם שיופיע בלוח תוצאות'), '  נועה  ')
    await user.type(screen.getByPlaceholderText('you@example.com'), 'noa@test.com')
    await user.type(screen.getByPlaceholderText('לפחות 6 תווים'), 'mypassword')
    await user.type(screen.getByPlaceholderText('הזן שוב את הסיסמה'), 'mypassword')
    await user.click(getSubmit())
    await waitFor(() =>
      expect(mockRegister).toHaveBeenCalledWith('noa@test.com', 'mypassword', 'נועה')
    )
  })

  it('shows success message after successful registration', async () => {
    const user = await switchToRegister()
    mockRegister.mockResolvedValue(undefined)
    await user.type(screen.getByPlaceholderText('השם שיופיע בלוח תוצאות'), 'נועה')
    await user.type(screen.getByPlaceholderText('you@example.com'), 'noa@test.com')
    await user.type(screen.getByPlaceholderText('לפחות 6 תווים'), 'mypassword')
    await user.type(screen.getByPlaceholderText('הזן שוב את הסיסמה'), 'mypassword')
    await user.click(getSubmit())
    await waitFor(() => expect(screen.getByText(/נרשמת בהצלחה/)).toBeInTheDocument())
  })

  it('shows error message when registration fails', async () => {
    const user = await switchToRegister()
    mockRegister.mockRejectedValue(new Error('כתובת מייל כבר בשימוש'))
    await user.type(screen.getByPlaceholderText('השם שיופיע בלוח תוצאות'), 'נועה')
    await user.type(screen.getByPlaceholderText('you@example.com'), 'existing@test.com')
    await user.type(screen.getByPlaceholderText('לפחות 6 תווים'), 'mypassword')
    await user.type(screen.getByPlaceholderText('הזן שוב את הסיסמה'), 'mypassword')
    await user.click(getSubmit())
    await waitFor(() => expect(screen.getByText('כתובת מייל כבר בשימוש')).toBeInTheDocument())
  })
})

// ── Auth redirect ──────────────────────────────────────────────────────────────

describe('auth redirect', () => {
  it('redirects to /competitions when currentUser is already set', async () => {
    mockUseAuth.mockReturnValue({
      login: mockLogin,
      register: mockRegister,
      currentUser: { id: '1', email: 'x@x.com' },
    })
    render(<LoginForm />)
    await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/competitions'))
  })
})
