import type { QueryClient } from '@tanstack/react-query'
import { klashKeys } from '../../api/queryKeys'
import type { Klash } from '../../types/klash'

/** The klash as the map last loaded it, with when — `klashes_in_bbox` returns the same
 * rows as the detail read (`klashes_public`), so a klash opened from the map can show at
 * once instead of behind a spinner. The most recently fetched copy wins. */
export function findKlashInMapCache(
  queryClient: QueryClient,
  klashId: string,
): { klash: Klash; updatedAt: number } | undefined {
  let found: { klash: Klash; updatedAt: number } | undefined
  for (const query of queryClient.getQueryCache().findAll({ queryKey: klashKeys.bboxes() })) {
    const klash = (query.state.data as Klash[] | undefined)?.find((item) => item.id === klashId)
    if (klash && (!found || query.state.dataUpdatedAt > found.updatedAt)) {
      found = { klash, updatedAt: query.state.dataUpdatedAt }
    }
  }
  return found
}
