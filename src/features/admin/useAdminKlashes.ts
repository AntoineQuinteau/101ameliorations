import { useQuery } from '@tanstack/react-query'
import { fetchAdminKlashes, fetchTriageQueue, type AdminKlashFilters } from '../../api/admin'
import { adminKlashKeys } from '../../api/queryKeys'

function filtersKey(filters: AdminKlashFilters): string {
  return JSON.stringify(filters)
}

/** Paginated, filtered klash listing for the admin table (spec §6.6). */
export function useAdminKlashes(filters: AdminKlashFilters, page: number) {
  return useQuery({
    queryKey: adminKlashKeys.list(filtersKey(filters), page),
    queryFn: () => fetchAdminKlashes(filters, page),
  })
}

/** The "à trier" queue: klashs `new` for more than 7 days (spec §6.6).
 * `enabled` lets a caller outside `/admin` (the map's staff shortcut) keep
 * the query idle for visitors who may not open it; the cache entry is shared
 * with the "À trier" tab either way. */
export function useTriageQueue({ enabled = true }: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: adminKlashKeys.triage(),
    queryFn: fetchTriageQueue,
    enabled,
  })
}
