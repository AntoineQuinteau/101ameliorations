import { useMutation, useQueryClient } from '@tanstack/react-query'
import { confirmKlash, unconfirmKlash } from '../../api/confirmations'
import { confirmationKeys, klashKeys } from '../../api/queryKeys'
import { useAuth } from '../auth/useAuth'

/** Toggles a confirmation (+1) on a klash. Mirrors the current confirmed
 * state (from `useMyConfirmation`) to decide whether to insert or delete. */
export function useConfirmKlash(klashId: string, isCurrentlyConfirmed: boolean) {
  const { user } = useAuth()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: () => {
      if (!user) throw new Error('Cannot confirm a klash while signed out')
      return isCurrentlyConfirmed
        ? unconfirmKlash(klashId, user.id)
        : confirmKlash(klashId, user.id)
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: klashKeys.detail(klashId) })
      if (user) {
        void queryClient.invalidateQueries({
          queryKey: confirmationKeys.mine(klashId, user.id),
        })
      }
    },
  })
}
