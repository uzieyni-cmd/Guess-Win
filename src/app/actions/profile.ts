'use server'

import { supabaseAdmin } from '@/lib/supabase-admin'
import { createSupabaseServerClient } from '@/lib/supabase-server'

const MAX_AVATAR_BYTES = 512 * 1024 // 512 KB (after client-side resize)

// Magic bytes לזיהוי סוג קובץ אמיתי (ללא הסתמכות על file.type מהלקוח)
const MAGIC: [number[], string][] = [
  [[0xff, 0xd8, 0xff],          'image/jpeg'],
  [[0x89, 0x50, 0x4e, 0x47],   'image/png'],
  [[0x52, 0x49, 0x46, 0x46],   'image/webp'], // RIFF....WEBP
  [[0x47, 0x49, 0x46],         'image/gif'],
]

function detectMime(buf: Uint8Array): string | null {
  for (const [bytes, mime] of MAGIC) {
    if (bytes.every((b, i) => buf[i] === b)) return mime
  }
  return null
}

export async function uploadAvatar(
  formData: FormData
): Promise<{ url?: string; error?: string }> {
  // אמת שהמשתמש מחובר
  const supabase = await createSupabaseServerClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return { error: 'Unauthorized' }

  const file = formData.get('file') as File | null
  if (!file || !file.size) return { error: 'לא נבחר קובץ' }

  // ולידציה: גודל (אחרי צמצום בלקוח)
  if (file.size > MAX_AVATAR_BYTES) return { error: 'הקובץ גדול מדי' }

  // ולידציה: magic bytes — מוודא שהתוכן תואם לסוג המוצהר
  const buffer = new Uint8Array(await file.arrayBuffer())
  const detectedMime = detectMime(buffer)
  if (!detectedMime) return { error: 'הקובץ אינו תמונה תקינה' }

  const ext = detectedMime.split('/')[1].replace('jpeg', 'jpg')
  const path = `${user.id}/avatar.${ext}`

  const { error: uploadError } = await supabaseAdmin.storage
    .from('avatars')
    .upload(path, buffer, { contentType: detectedMime, upsert: true })
  if (uploadError) return { error: uploadError.message }

  const { data } = supabaseAdmin.storage.from('avatars').getPublicUrl(path)

  // עדכן profiles עם ה-URL החדש
  await supabaseAdmin
    .from('profiles')
    .update({ avatar_url: data.publicUrl })
    .eq('id', user.id)

  return { url: data.publicUrl }
}
