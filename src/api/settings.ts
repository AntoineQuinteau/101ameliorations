import { supabase } from '../lib/supabase'
import { serviceAreaBboxFromValue } from '../types/settings'
import type { Bbox } from '../utils/bbox'

/** Reads the service area bbox from `settings` (world-readable, spec §4). Throws on a
 * missing row or a malformed value — see useServiceArea() for the fallback that keeps
 * the map usable when that happens. */
export async function fetchServiceAreaBbox(): Promise<Bbox> {
  const { data, error } = await supabase
    .from('settings')
    .select('value')
    .eq('key', 'service_area_bbox')
    .maybeSingle()
  if (error) throw error
  if (!data) throw new Error("settings row 'service_area_bbox' is missing")
  return serviceAreaBboxFromValue(data.value)
}
