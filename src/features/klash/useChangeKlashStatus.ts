import { useMutation, useQueryClient } from '@tanstack/react-query'
import { changeKlashStatus } from '../../api/statusChanges'
import { klashKeys, statusChangeKeys, adminKlashKeys } from '../../api/queryKeys'
import type { KlashStatus } from '../../types/klash'

/** Changes a klash's status, with an optional note (spec §3, §6.3). */
export function useChangeKlashStatus(klashId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ toStatus, note }: { toStatus: KlashStatus; note: string | null }) =>
      changeKlashStatus(klashId, toStatus, note),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: klashKeys.detail(klashId) })
      void queryClient.invalidateQueries({ queryKey: statusChangeKeys.byKlash(klashId) })
      // The map (bbox queries) and /me both show a klash's status, and the
      // admin table/triage queue filter on it — all affected by any change.
      void queryClient.invalidateQueries({ queryKey: klashKeys.all })
      void queryClient.invalidateQueries({ queryKey: adminKlashKeys.all })
    },
  })
}
