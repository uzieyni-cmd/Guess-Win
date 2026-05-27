import { createClient } from '@supabase/supabase-js'

/**
 * Standalone Supabase client for the reset-password page only.
 *
 * Uses the standard createClient (not @supabase/ssr) which:
 * - Stores session in localStorage (not cookies)
 * - Auto-detects ?code= / #access_token= in the URL and exchanges them
 * - Fires PASSWORD_RECOVERY event automatically
 *
 * This mirrors how non-SSR React apps (e.g. mondial-yashir) handle
 * password reset reliably. The SSR client (createBrowserClient) does
 * NOT auto-detect session from URL — it expects the server to exchange
 * the code — which causes updateUser to hang.
 */
export const supabaseReset = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)
