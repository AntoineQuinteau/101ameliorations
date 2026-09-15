import { useQuery } from '@tanstack/react-query'
import { fetchStatusHistory } from '../../api/statusChanges'
import { statusChangeKeys } from '../../api/queryKeys'

/** Status history for a klash's detail page (spec §6.3). Public read, same
 * as comments — no auth gating needed. */
export function useStatusHistory(klashId: string) {
  return useQuery({
    queryKey: statusChangeKeys.byKlash(klashId),
    queryFn: () => fetchStatusHistory(klashId),
  })
}
