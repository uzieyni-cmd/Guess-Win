// Server-side auth helpers for Server Actions and Route Handlers.
// Call requireAdmin() at the top of any 'use server' function that mutates data.
import 'server-only'
import { createSupabaseServerClient } from './supabase-server'
import { supabaseAdmin } from './supabase-admin'

/**
 * Verifies the caller is an authenticated admin.
 * Throws a plain Error (never exposes internals) if not.
 * Use at the top of every admin Server Action.
 */
export async function requireAdmin(): Promise<string> {
  const supabase = await createSupabaseServerClient()
  const { data: { user }, error } = await supabase.auth.getUser()

  if (error || !user) throw new Error('Unauthorized')

  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') throw new Error('Forbidden')

  return user.id
}
