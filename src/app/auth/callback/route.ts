import { createServerClient } from '@supabase/ssr'
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
 * IMPORTANT: Cookies must be set directly on the redirect Response object,
 * NOT via next/headers cookieStore — otherwise they are lost on the redirect.
 */

function makeSupabaseWithResponse(request: NextRequest, response: NextResponse) {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookiesToSet) => {
          cookiesToSet.forEach(({ name, value, options }) => {
            // Write to both request (so this handler can read them) and response (sent to browser)
            request.cookies.set(name, value)
            response.cookies.set(name, value, options)
          })
        },
      },
    }
  )
}

export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl
  const code       = searchParams.get('code')
  const token_hash = searchParams.get('token_hash')
  const type       = searchParams.get('type')
  const next       = searchParams.get('next') ?? '/'

  // ── 1. PKCE code exchange ─────────────────────────────────────────
  if (code) {
    const destination = type === 'recovery' ? '/reset-password' : next
    const response = NextResponse.redirect(new URL(destination, origin))
    const supabase = makeSupabaseWithResponse(request, response)

    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) return response
  }

  // ── 2. Token hash exchange (older flow) ───────────────────────────
  if (token_hash && type) {
    const destination = type === 'recovery' ? '/reset-password' : next
    const response = NextResponse.redirect(new URL(destination, origin))
    const supabase = makeSupabaseWithResponse(request, response)

    const { error } = await supabase.auth.verifyOtp({ token_hash, type: type as 'recovery' | 'email' })
    if (!error) return response
  }

  // Something went wrong — send back to login with an error flag
  return NextResponse.redirect(new URL('/login?error=link_expired', origin))
}
