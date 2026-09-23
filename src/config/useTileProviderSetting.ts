import { useQuery } from '@tanstack/react-query'
import { fetchTileProviderSetting } from '../api/settings'
import { settingsKeys } from '../api/queryKeys'
import type { TileProviderSetting } from '../types/settings'

/** The admin-controlled tile source override, read from `settings.tile_provider` at
 * runtime — same "no redeploy needed" pattern as `useServiceArea()`, and the same
 * always-return-something contract (no `isPending`/`isError` to gate rendering on — see
 * that hook's docblock for the incident this avoided). `'maptiler'` is both the default
 * row's value and the safe fallback while the query is loading or if it fails: a real
 * MapTiler outage is already covered independently by automatic failover
 * (`tileFailover.ts`) — this setting only ever matters for a deliberate admin override.
 *
 * `staleTime` is much shorter than `useServiceArea()`'s: an admin toggling this during a
 * live MapTiler outage should reach already-open tabs within minutes, not only on their
 * next full reload. See `useTileProvider()` for where this combines with
 * `useTileFailover()`. */
export function useTileProviderSetting(): TileProviderSetting {
  const { data } = useQuery({
    queryKey: settingsKeys.tileProvider(),
    queryFn: fetchTileProviderSetting,
    staleTime: 10 * 60 * 1000,
    gcTime: Infinity,
    retry: 1,
  })
  return data ?? 'maptiler'
}
