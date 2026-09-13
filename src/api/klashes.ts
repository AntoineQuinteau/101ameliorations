import { supabase } from '../lib/supabase'
import type { Bbox } from '../utils/bbox'
import { klashFromRow, type Klash, type KlashCategory, type KlashUrgency } from '../types/klash'

/** Klashs visible in a map viewport, via the `klashes_in_bbox` RPC (already excludes
 * rejected/duplicate and resolved-over-90-days — see the migration). */
export async function fetchKlashesInBbox(bbox: Bbox): Promise<Klash[]> {
  const { data, error } = await supabase.rpc('klashes_in_bbox', {
    min_lat: bbox.minLat,
    min_lng: bbox.minLng,
    max_lat: bbox.maxLat,
    max_lng: bbox.maxLng,
  })
  if (error) throw error
  return data.map(klashFromRow)
}

/** A single klash for the detail page, or `null` if it doesn't exist (or isn't visible
 * to the current viewer under RLS). */
export async function fetchKlashById(id: string): Promise<Klash | null> {
  const { data, error } = await supabase
    .from('klashes_public')
    .select('*')
    .eq('id', id)
    .maybeSingle()
  if (error) throw error
  return data ? klashFromRow(data) : null
}

/** Active klashs within `radiusM` metres of a point, for duplicate detection
 * (spec §6.2 step 2). Excludes rejected/duplicate and resolved-over-30-days,
 * per the `klashes_nearby` RPC. */
export async function fetchKlashesNearby(
  lat: number,
  lng: number,
  radiusM: number,
): Promise<Klash[]> {
  const { data, error } = await supabase.rpc('klashes_nearby', {
    origin_lat: lat,
    origin_lng: lng,
    radius_m: radiusM,
  })
  if (error) throw error
  return data.map(klashFromRow)
}

export interface CreateKlashInput {
  lat: number
  lng: number
  category: KlashCategory
  urgency: KlashUrgency
  title: string
  description: string | null
}

/** Creates a klash via the `create_klash` RPC (builds the PostGIS point
 * server-side and hands back the row shaped like `klashes_public`, since a
 * plain insert on `klashes` can do neither — see the migration). */
export async function createKlash(input: CreateKlashInput): Promise<Klash> {
  const { data, error } = await supabase.rpc('create_klash', {
    lat: input.lat,
    lng: input.lng,
    category: input.category,
    urgency: input.urgency,
    title: input.title,
    // The generated type has `description: string` (gen_types doesn't mark a
    // plain `text` SQL parameter as nullable), but the column and the RPC's
    // plpgsql body both accept null — the DB, not this type, is authoritative.
    description: input.description as string,
  })
  if (error) throw error
  return klashFromRow(data)
}
