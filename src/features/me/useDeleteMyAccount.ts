import { useMutation } from '@tanstack/react-query'
import { deleteMyAccount } from '../../api/profiles'

/** RGPD account deletion (spec §6.5). No query invalidation on success:
 * `delete_my_account()` also deletes the caller's `auth.users` row, so the
 * very next `SIGNED_OUT` auth event (from the page's own `signOut()` call,
 * made right after this succeeds) already clears the whole query cache —
 * see AuthProvider's `onAuthStateChange` handler. */
export function useDeleteMyAccount() {
  return useMutation({
    mutationFn: () => deleteMyAccount(),
  })
}
