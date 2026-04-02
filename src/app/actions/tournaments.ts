'use server'

import { supabaseAdmin } from '@/lib/supabase-admin'
import { requireAdmin } from '@/lib/auth-server'
import { TournamentStatus } from '@/types'
import { fetchLeagueSeasons } from './leagues'

export async function fetchLogoForTournament(tournamentId: string): Promise<string | null> {
  await requireAdmin()
  const { data } = await supabaseAdmin
    .from('tournaments')
    .select('api_league_id')
    .eq('id', tournamentId)
    .single()
  if (!data?.api_league_id) return null
  const { logoUrl } = await fetchLeagueSeasons(data.api_league_id)
  return logoUrl || null
}

export async function adminUpdateTournament(
  id: string,
  data: { name?: string; logoUrl?: string; description?: string; status?: TournamentStatus }
): Promise<{ ok: boolean; error?: string }> {
  await requireAdmin()
  const { error } = await supabaseAdmin
    .from('tournaments')
    .update({
      ...(data.name        !== undefined && { name:        data.name }),
      ...(data.logoUrl     !== undefined && { logo_url:    data.logoUrl || null }),
      ...(data.description !== undefined && { description: data.description }),
      ...(data.status      !== undefined && { status:      data.status }),
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
  if (error) return { ok: false, error: error.message }
  return { ok: true }
}

export async function adminDeleteTournament(
  id: string
): Promise<{ ok: boolean; error?: string }> {
  await requireAdmin()
  const { error } = await supabaseAdmin
    .from('tournaments')
    .delete()
    .eq('id', id)
  if (error) return { ok: false, error: error.message }
  return { ok: true }
}

export async function adminToggleHide(
  id: string,
  hidden: boolean
): Promise<{ ok: boolean; error?: string }> {
  await requireAdmin()
  const { error } = await supabaseAdmin
    .from('tournaments')
    .update({ is_hidden: hidden, updated_at: new Date().toISOString() })
    .eq('id', id)
  if (error) return { ok: false, error: error.message }
  return { ok: true }
}

const MAX_LOGO_BYTES = 512 * 1024 // 512 KB
const ALLOWED_LOGO_MIME = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml']
const LOGO_MAGIC: [number[], string][] = [
  [[0xff, 0xd8, 0xff],        'image/jpeg'],
  [[0x89, 0x50, 0x4e, 0x47], 'image/png'],
  [[0x52, 0x49, 0x46, 0x46], 'image/webp'],
  [[0x47, 0x49, 0x46],       'image/gif'],
  [[0x3c, 0x73, 0x76, 0x67], 'image/svg+xml'], // <svg
  [[0x3c, 0x3f, 0x78, 0x6d], 'image/svg+xml'], // <?xm (<?xml)
]

export async function uploadLogo(formData: FormData): Promise<{ url?: string; error?: string }> {
  await requireAdmin()
  const file = formData.get('file') as File | null
  if (!file || !file.size) return { error: 'לא נבחר קובץ' }

  if (file.size > MAX_LOGO_BYTES) return { error: 'הקובץ גדול מדי (מקסימום 512KB)' }
  if (!ALLOWED_LOGO_MIME.includes(file.type)) return { error: 'סוג קובץ לא נתמך' }

  const buffer = new Uint8Array(await file.arrayBuffer())
  const detectedMime = LOGO_MAGIC.find(([bytes]) => bytes.every((b, i) => buffer[i] === b))?.[1] ?? null
  if (!detectedMime) return { error: 'הקובץ אינו תמונה תקינה' }

  const ext = detectedMime.split('/')[1].replace('jpeg', 'jpg').replace('svg+xml', 'svg')
  const path = `${Date.now()}.${ext}`
  const { error } = await supabaseAdmin.storage
    .from('logos')
    .upload(path, buffer, { contentType: detectedMime, upsert: true })
  if (error) return { error: error.message }
  const { data } = supabaseAdmin.storage.from('logos').getPublicUrl(path)
  return { url: data.publicUrl }
}

export async function adminCreateTournament(data: {
  name: string
  description: string
  logoUrl: string
  apiLeagueId?: number
  apiSeason?: number
}): Promise<{ id?: string; error?: string }> {
  await requireAdmin()
  const { data: row, error } = await supabaseAdmin
    .from('tournaments')
    .insert({
      name:          data.name,
      description:   data.description,
      logo_url:      data.logoUrl || null,
      api_league_id: data.apiLeagueId ?? null,
      api_season:    data.apiSeason ?? null,
      status:        'upcoming',
      is_hidden:     false,
    })
    .select('id')
    .single()
  if (error || !row) return { error: error?.message ?? 'Unknown error' }
  return { id: row.id }
}
