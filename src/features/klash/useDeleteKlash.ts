import { useMutation, useQueryClient } from '@tanstack/react-query'
import { deleteKlash } from '../../api/klashes'
import { klashKeys, adminKlashKeys } from '../../api/queryKeys'

/** Deletes a klash (author while `new`, or staff — spec §2). Invalidates
 * every klash list (map bbox, /me, /admin) since the deleted klash could
 * appear in any of them. */
export function useDeleteKlash() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) => deleteKlash(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: klashKeys.all })
      void queryClient.invalidateQueries({ queryKey: adminKlashKeys.all })
    },
  })
}
