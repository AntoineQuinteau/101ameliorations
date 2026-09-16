import { useQuery } from '@tanstack/react-query'
import { fetchServiceAreaBbox } from '../api/settings'
import { settingsKeys } from '../api/queryKeys'
import { SERVICE_AREA_BBOX } from './serviceArea'
import type { Bbox } from '../utils/bbox'

/** The service area bbox, read from `settings.service_area_bbox` at runtime so an
 * edit in Supabase takes effect without a redeploy (see SERVICE_AREA_BBOX's
 * docblock). Always returns a usable `Bbox`, never `undefined`: there is no
 * `isPending`/`isError` to gate on here on purpose — a disabled or still-loading
 * TanStack query that a caller waits on before rendering is what produced the
 * infinite /admin spinner (see docs/handoff.md). The query always runs and always
 * settles one way or another; whenever it hasn't resolved yet or failed, the
 * compile-time constant is returned instead, so the map paints on the first frame
 * and a malformed row degrades to the fallback rather than to a stuck page. */
export function useServiceArea(): Bbox {
  const { data } = useQuery({
    queryKey: settingsKeys.serviceAreaBbox(),
    queryFn: fetchServiceAreaBbox,
    staleTime: 60 * 60 * 1000,
    gcTime: Infinity,
    retry: 1,
  })
  return data ?? SERVICE_AREA_BBOX
}
