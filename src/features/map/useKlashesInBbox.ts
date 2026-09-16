import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { fetchKlashesInBbox } from '../../api/klashes'
import { klashKeys } from '../../api/queryKeys'
import { clampBbox, expandBbox, roundBbox, type Bbox } from '../../utils/bbox'

/** Loads klashs for a map viewport. The viewport is padded 25% and rounded to 2 decimals
 * before becoming the query key/argument: small pans reuse the same cache entry (no
 * refetch, no flicker) and data is preloaded slightly beyond what's visible.
 *
 * `serviceArea` is required, not defaulted, so every caller must pass the runtime value
 * from `useServiceArea()` — there is no way to silently fall back to importing the
 * stale compile-time constant here. */
export function useKlashesInBbox(viewportBbox: Bbox | null, serviceArea: Bbox) {
  const queryBbox = viewportBbox
    ? clampBbox(roundBbox(expandBbox(viewportBbox, 0.25), 2), serviceArea)
    : null

  return useQuery({
    queryKey: queryBbox ? klashKeys.bbox(queryBbox) : klashKeys.all,
    queryFn: () => fetchKlashesInBbox(queryBbox!),
    enabled: queryBbox !== null,
    placeholderData: keepPreviousData,
  })
}
