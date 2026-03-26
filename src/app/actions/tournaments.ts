'use server'

import { supabaseAdmin } from '@/lib/supabase-admin'
import { TournamentStatus } from '@/types'
import { fetchLeagueSeasons } from './leagues'

export async function fetchLogoForTournament(tournamentId: string): Promise<string | null> {
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
  const { error } = await supabaseAdmin
    .from('tournaments')
    .update({ is_hidden: hidden, updated_at: new Date().toISOString() })
    .eq('id', id)
  if (error) return { ok: false, error: error.message }
  return { ok: true }
}

export async function uploadLogo(formData: FormData): Promise<{ url?: string; error?: string }> {
  const file = formData.get('file') as File | null
  if (!file || !file.size) return { error: 'לא נבחר קובץ' }
  const ext = file.name.split('.').pop() ?? 'png'
  const path = `${Date.now()}.${ext}`
  const bytes = await file.arrayBuffer()
  const { error } = await supabaseAdmin.storage
    .from('logos')
    .upload(path, bytes, { contentType: file.type, upsert: true })
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
