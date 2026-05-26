import { createSupabaseServerClient } from '@/lib/supabase-server'
import { NextRequest, NextResponse } from 'next/server'

/**
 * Supabase PKCE auth callback — exchanges the `code` for a session server-side
 * (the PKCE verifier lives in the browser's cookies; the server client reads them).
 *
 * Email links are sent to:
 *   /auth/callback?code=xxx&next=/reset-password
 *
 * After exchange the user is redirected to `next` (defaults to /).
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/'

  if (code) {
    const supabase = await createSupabaseServerClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      return NextResponse.redirect(new URL(next, origin))
    }
  }

  // Something went wrong — send back to login with an error flag
  return NextResponse.redirect(new URL('/login?error=link_expired', origin))
}
