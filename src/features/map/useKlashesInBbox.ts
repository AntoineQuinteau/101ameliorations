import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { fetchKlashesInBbox } from '../../api/klashes'
import { klashKeys } from '../../api/queryKeys'
import { SERVICE_AREA_BBOX } from '../../config/serviceArea'
import { clampBbox, expandBbox, roundBbox, type Bbox } from '../../utils/bbox'

/** Loads klashs for a map viewport. The viewport is padded 25% and rounded to 2 decimals
 * before becoming the query key/argument: small pans reuse the same cache entry (no
 * refetch, no flicker) and data is preloaded slightly beyond what's visible. */
export function useKlashesInBbox(viewportBbox: Bbox | null) {
  const queryBbox = viewportBbox
    ? clampBbox(roundBbox(expandBbox(viewportBbox, 0.25), 2), SERVICE_AREA_BBOX)
    : null

  return useQuery({
    queryKey: queryBbox ? klashKeys.bbox(queryBbox) : klashKeys.all,
    queryFn: () => fetchKlashesInBbox(queryBbox!),
    enabled: queryBbox !== null,
    placeholderData: keepPreviousData,
  })
}
