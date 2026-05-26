'use server'

import { supabaseAdmin } from '@/lib/supabase-admin'
import { createSupabaseServerClient } from '@/lib/supabase-server'

const MAX_AVATAR_BYTES = 512 * 1024 // 512 KB (after client-side resize)

export async function uploadAvatar(
  formData: FormData
): Promise<{ url?: string; error?: string }> {
  const supabase = await createSupabaseServerClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return { error: 'Unauthorized' }

  const file = formData.get('file') as File | null
  if (!file || !file.size) return { error: 'לא נבחר קובץ' }
  if (file.size > MAX_AVATAR_BYTES) return { error: 'הקובץ גדול מדי' }

  // Convert to base64 data URL and store directly in avatar_url column
  const buffer = await file.arrayBuffer()
  const base64 = Buffer.from(buffer).toString('base64')
  const dataUrl = `data:image/jpeg;base64,${base64}`

  const { error } = await supabaseAdmin
    .from('profiles')
    .update({ avatar_url: dataUrl })
    .eq('id', user.id)

  if (error) return { error: error.message }
  return { url: dataUrl }
}

// ── Change password (server-side to avoid SSR cookie conflicts) ───
export async function changePassword(
  currentPassword: string,
  newPassword: string,
): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user?.email) return { ok: false, error: 'לא מחובר' }

  // Verify current password
  const { error: signInError } = await supabase.auth.signInWithPassword({
    email: user.email,
    password: currentPassword,
  })
  if (signInError) return { ok: false, error: 'הסיסמה הנוכחית שגויה' }

  // Update password via admin (bypasses session issues)
  const { error } = await supabaseAdmin.auth.admin.updateUserById(user.id, {
    password: newPassword,
  })
  if (error) return { ok: false, error: error.message }

  return { ok: true }
}
