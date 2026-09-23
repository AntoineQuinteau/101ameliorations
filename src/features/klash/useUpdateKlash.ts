import { useMutation, useQueryClient } from '@tanstack/react-query'
import { updateKlash, type UpdateKlashInput } from '../../api/klashes'
import { klashKeys, adminKlashKeys } from '../../api/queryKeys'

/** Edits a klash's category/urgency/title/description/proposed solution
 * (spec §6.3 "Modifier" — author while `new`, or moderator/admin). */
export function useUpdateKlash(klashId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: UpdateKlashInput) => updateKlash(klashId, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: klashKeys.detail(klashId) })
      // Title/category/urgency drive map markers, /me and the duplicates
      // list; the admin table filters and displays them too.
      void queryClient.invalidateQueries({ queryKey: klashKeys.all })
      void queryClient.invalidateQueries({ queryKey: adminKlashKeys.all })
    },
  })
}
