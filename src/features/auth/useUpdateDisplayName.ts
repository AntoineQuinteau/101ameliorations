import { useMutation, useQueryClient } from '@tanstack/react-query'
import { updateDisplayName } from '../../api/profiles'
import { profileKeys } from '../../api/queryKeys'
import { useAuth } from './useAuth'

/** Updates the current user's pseudo and refreshes the cached profile. */
export function useUpdateDisplayName() {
  const { user } = useAuth()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (displayName: string) => {
      if (!user) throw new Error('Cannot update the display name while signed out')
      return updateDisplayName(user.id, displayName)
    },
    onSuccess: () => {
      if (user) void queryClient.invalidateQueries({ queryKey: profileKeys.detail(user.id) })
    },
  })
}
