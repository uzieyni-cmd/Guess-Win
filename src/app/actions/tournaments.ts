'use server'

import { supabaseAdmin } from '@/lib/supabase-admin'
import { TournamentStatus } from '@/types'

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
