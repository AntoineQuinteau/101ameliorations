import { supabase } from '../lib/supabase'
import { serviceAreaBboxFromValue, tileProviderFromValue } from '../types/settings'
import type { TileProviderSetting } from '../types/settings'
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

/** Reads the admin-controlled tile source override from `settings`
 * (world-readable — see the `tile_provider` migration). Throws on a missing row or a
 * malformed value — see `useTileProviderSetting()` for the fallback that keeps the map
 * usable when that happens. */
export async function fetchTileProviderSetting(): Promise<TileProviderSetting> {
  const { data, error } = await supabase
    .from('settings')
    .select('value')
    .eq('key', 'tile_provider')
    .maybeSingle()
  if (error) throw error
  if (!data) throw new Error("settings row 'tile_provider' is missing")
  return tileProviderFromValue(data.value)
}
