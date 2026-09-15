import type { UserRole } from '../../types/profile'
import { useAuth } from './useAuth'
import { useProfile } from './useProfile'

export interface RoleInfo {
  /** `null` while unresolved, or for a signed-out visitor. */
  role: UserRole | null
  /** True once both auth and the profile query have settled — the point at
   * which `role` can be trusted for a permission decision. Checking only
   * `useAuth().isInitializing` isn't enough: a signed-in user's profile can
   * still be loading, which would show a legitimate staff member a flash of
   * "forbidden" before their role arrives. */
  isResolved: boolean
  isStaff: boolean
  canModerate: boolean
  canProcess: boolean
}

/** Derives role-based permissions from the signed-in user's profile (spec
 * §2). `moderator`/`admin` can sort (`new` <-> `rejected`/`duplicate`) and
 * moderate content; `authority`/`admin` can run the processing pipeline. */
export function useRole(): RoleInfo {
  const { isInitializing } = useAuth()
  const profileQuery = useProfile()

  const role = profileQuery.data?.role ?? null
  const isResolved = !isInitializing && !profileQuery.isPending

  return {
    role,
    isResolved,
    isStaff: role === 'moderator' || role === 'admin',
    canModerate: role === 'moderator' || role === 'admin',
    canProcess: role === 'authority' || role === 'admin',
  }
}
