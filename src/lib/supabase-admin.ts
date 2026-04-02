// Server-side only! Uses service role key – bypasses RLS.
// Import ONLY from: Server Actions ('use server'), Route Handlers, auth-server.ts
// DO NOT import in Client Components or files without 'use server'.
import 'server-only'
import { createClient } from '@supabase/supabase-js'

export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)
