import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

/**
 * Next.js 16 proxy (replaces middleware).
 *
 * Runs on every HTML page request (not static assets / API routes).
 * 1. Calls supabase.auth.getUser() to refresh an expired access token server-side,
 *    writing the fresh token to cookies before client JS runs — eliminates the
 *    multi-second loading spinner on hard refresh.
 * 2. Protects /admin routes: redirects unauthenticated users to /login.
 */
export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // getUser() validates + refreshes the session server-side.
  // Must not be removed — this is what writes the fresh token to cookies.
  const { data: { user } } = await supabase.auth.getUser()

  // Protect /admin routes
  if (!user && request.nextUrl.pathname.startsWith('/admin')) {
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('next', request.nextUrl.pathname)
    return NextResponse.redirect(loginUrl)
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    /*
     * Match all request paths EXCEPT:
     * - _next/static  (static files)
     * - _next/image   (image optimisation)
     * - favicon.ico, png, svg, jpg, jpeg, gif, webp
     * - /api/*        (API routes handle auth themselves)
     */
    '/((?!_next/static|_next/image|favicon\\.ico|api/|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
