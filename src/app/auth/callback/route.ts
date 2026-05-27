import { createSupabaseServerClient } from '@/lib/supabase-server'
import { NextRequest, NextResponse } from 'next/server'

/**
 * Supabase auth callback — handles two URL formats:
 *
 * 1. PKCE flow (default with @supabase/ssr):
 *    /auth/callback?code=xxx&next=/reset-password
 *
 * 2. Token hash flow (older email templates / some Supabase configs):
 *    /auth/callback?token_hash=xxx&type=recovery&next=/reset-password
 *
 * After exchange the user is redirected to `next` (defaults to /).
 * For recovery type, always redirects to /reset-password regardless of `next`.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl
  const code       = searchParams.get('code')
  const token_hash = searchParams.get('token_hash')
  const type       = searchParams.get('type')
  const next       = searchParams.get('next') ?? '/'

  const supabase = await createSupabaseServerClient()

  // ── 1. PKCE code exchange ─────────────────────────────────────────
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      const destination = type === 'recovery' ? '/reset-password' : next
      return NextResponse.redirect(new URL(destination, origin))
    }
  }

  // ── 2. Token hash exchange (older flow) ───────────────────────────
  if (token_hash && type) {
    const { error } = await supabase.auth.verifyOtp({ token_hash, type: type as 'recovery' | 'email' })
    if (!error) {
      const destination = type === 'recovery' ? '/reset-password' : next
      return NextResponse.redirect(new URL(destination, origin))
    }
  }

  // Something went wrong — send back to login with an error flag
  return NextResponse.redirect(new URL('/login?error=link_expired', origin))
}
