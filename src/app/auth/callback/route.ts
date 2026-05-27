import { NextRequest, NextResponse } from 'next/server'

/**
 * Supabase auth callback — handles two URL formats:
 *
 * 1. PKCE flow — recovery:
 *    /auth/callback?code=xxx&type=recovery
 *    → redirect to /reset-password?code=xxx  (client exchanges the code itself)
 *
 * 2. PKCE flow — other (email confirmation, etc.):
 *    /auth/callback?code=xxx&next=/foo
 *    → exchange server-side, redirect to next
 *
 * 3. Token hash flow (older Supabase email templates):
 *    /auth/callback?token_hash=xxx&type=recovery
 *    → redirect to /reset-password?token_hash=xxx&type=recovery
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl
  const code       = searchParams.get('code')
  const token_hash = searchParams.get('token_hash')
  const type       = searchParams.get('type')
  const next       = searchParams.get('next') ?? '/'

  // ── Recovery flow: let the client page exchange the code ──────────
  // (avoids cookie-on-redirect issues in SSR route handlers)
  if (code && type === 'recovery') {
    return NextResponse.redirect(
      new URL(`/reset-password?code=${code}`, origin)
    )
  }

  if (token_hash && type === 'recovery') {
    return NextResponse.redirect(
      new URL(`/reset-password?token_hash=${token_hash}&type=${type}`, origin)
    )
  }

  // ── Non-recovery PKCE (email confirmation, magic link, etc.) ──────
  if (code) {
    const { createServerClient } = await import('@supabase/ssr')
    const { cookies } = await import('next/headers')
    const cookieStore = await cookies()

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll: () => cookieStore.getAll(),
          setAll: (list) => {
            try { list.forEach(({ name, value, options }) => cookieStore.set(name, value, options)) }
            catch { /* server component – ignore */ }
          },
        },
      }
    )

    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) return NextResponse.redirect(new URL(next, origin))
  }

  // Something went wrong
  return NextResponse.redirect(new URL('/login?error=link_expired', origin))
}
