'use server'

import { supabaseAdmin } from '@/lib/supabase-admin'
import { createSupabaseServerClient } from '@/lib/supabase-server'

const MAX_AVATAR_BYTES = 512 * 1024 // 512 KB (after client-side resize)
const BUCKET = 'avatars'

export async function uploadAvatar(
  formData: FormData
): Promise<{ url?: string; error?: string }> {
  const supabase = await createSupabaseServerClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return { error: 'Unauthorized' }

  const file = formData.get('file') as File | null
  if (!file || !file.size) return { error: 'לא נבחר קובץ' }
  if (file.size > MAX_AVATAR_BYTES) return { error: 'הקובץ גדול מדי' }

  const buffer = new Uint8Array(await file.arrayBuffer())
  const path = `${user.id}/avatar.jpg`

  // Use the user's own session for upload (respects storage RLS policies)
  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(path, buffer, { contentType: 'image/jpeg', upsert: true })
  if (uploadError) return { error: `upload: ${uploadError.message}` }

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path)

  await supabaseAdmin
    .from('profiles')
    .update({ avatar_url: data.publicUrl })
    .eq('id', user.id)

  return { url: data.publicUrl }
}
