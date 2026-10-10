import type { UserRole } from '../../types/profile'
import { canAccessAdmin } from '../../lib/klashPermissions'
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
  /** May open `/admin`: moderator, authority or admin (spec §6.6). */
  canAccessAdmin: boolean
  /** May create campaign links and read their statistics (admin, or the
   * separate `can_manage_campaigns` right). */
  canManageCampaigns: boolean
}

/** Derives role-based permissions from the signed-in user's profile (spec
 * §2). `moderator`/`admin` can sort (`new` <-> `rejected`/`duplicate`) and
 * moderate content; `authority`/`admin` can run the processing pipeline. */
export function useRole(): RoleInfo {
  const { user, isInitializing } = useAuth()
  const profileQuery = useProfile()

  const role = profileQuery.data?.role ?? null
  const canManageCampaigns = role === 'admin' || profileQuery.data?.canManageCampaigns === true
  // A signed-out visitor is fully resolved as soon as auth settles: their
  // profile query is `enabled: false`, and a disabled query stays `pending`
  // forever — waiting on it would hang the guard on an answer that never
  // comes (this is what made /admin spin indefinitely for anonymous
  // visitors instead of redirecting them).
  const isResolved = !isInitializing && (!user || !profileQuery.isPending)

  return {
    role,
    isResolved,
    isStaff: role === 'moderator' || role === 'admin',
    canModerate: role === 'moderator' || role === 'admin',
    canProcess: role === 'authority' || role === 'admin',
    // /admin also opens for a campaign manager who has no staff role (they
    // only get the Campagnes tab, see AdminPage).
    canAccessAdmin: canAccessAdmin(role) || canManageCampaigns,
    canManageCampaigns,
  }
}
