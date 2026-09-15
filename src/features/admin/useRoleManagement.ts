import { useMutation, useQueryClient } from '@tanstack/react-query'
import { findProfileByEmail, updateProfileRoleAndOrganization } from '../../api/admin'
import { profileKeys } from '../../api/queryKeys'
import type { UserRole } from '../../types/profile'

/** Looks up a profile by its account email (spec §6.6, admin only). Modelled
 * as a mutation rather than a query: it's an on-demand search action, not
 * data the page loads on mount, and a query would need an artificial "has
 * the user searched yet" gate to avoid firing on every keystroke. */
export function useFindProfileByEmail() {
  return useMutation({
    mutationFn: (email: string) => findProfileByEmail(email),
  })
}

/** Updates a profile's role and organization (admin only, spec §6.6).
 * Invalidates that profile's own query — if the admin edits their own
 * account, useRole/useProfile must see the change (e.g. losing admin access
 * to this very page). */
export function useUpdateProfileRoleAndOrganization() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      profileId,
      role,
      organization,
    }: {
      profileId: string
      role: UserRole
      organization: string | null
    }) => updateProfileRoleAndOrganization(profileId, role, organization),
    onSuccess: (_data, { profileId }) => {
      void queryClient.invalidateQueries({ queryKey: profileKeys.detail(profileId) })
    },
  })
}
