import { supabase } from '../lib/supabase'
import type { Bbox } from '../utils/bbox'
import { klashFromRow, type Klash } from '../types/klash'

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
