import { useQuery } from '@tanstack/react-query'
import { fetchMyConfirmation } from '../../api/confirmations'
import { confirmationKeys } from '../../api/queryKeys'
import { useAuth } from '../auth/useAuth'

/** Whether the signed-in user has already confirmed the given klash. `false`
 * (not loading) while signed out, since there's nothing to confirm as. */
export function useMyConfirmation(klashId: string) {
  const { user } = useAuth()

  return useQuery({
    queryKey: confirmationKeys.mine(klashId, user?.id ?? ''),
    queryFn: () => fetchMyConfirmation(klashId, user!.id),
    enabled: Boolean(user) && Boolean(klashId),
  })
}
