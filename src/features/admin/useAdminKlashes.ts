import { useQuery } from '@tanstack/react-query'
import {
  fetchAdminKlashes,
  fetchTriageCount,
  fetchTriageQueue,
  type AdminKlashFilters,
} from '../../api/admin'
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

/** The "à trier" queue: klashs `new` for more than 7 days (spec §6.6). */
export function useTriageQueue() {
  return useQuery({
    queryKey: adminKlashKeys.triage(),
    queryFn: fetchTriageQueue,
  })
}

/** How many klashs are in the "à trier" queue, without loading them. `enabled`
 * lets the map's staff shortcut keep the query idle when it isn't shown. */
export function useTriageCount({ enabled }: { enabled: boolean }) {
  return useQuery({
    queryKey: adminKlashKeys.triageCount(),
    queryFn: fetchTriageCount,
    enabled,
  })
}
