import { useQuery } from '@tanstack/react-query'
import { fetchProfile } from '../../api/profiles'
import { profileKeys } from '../../api/queryKeys'
import { useAuth } from './useAuth'

/** The signed-in user's profile. Enabled only once auth has resolved and a
 * user exists, and keyed on the user id so switching accounts can never show
 * the previous user's cached pseudo. */
export function useProfile() {
  const { user, isInitializing } = useAuth()

  return useQuery({
    queryKey: profileKeys.detail(user?.id ?? ''),
    queryFn: () => fetchProfile(user!.id),
    enabled: !isInitializing && Boolean(user),
    staleTime: 5 * 60_000,
  })
}
