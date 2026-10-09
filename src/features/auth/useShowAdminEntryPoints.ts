import { useDesktopLayout } from '../../hooks/useDesktopLayout'
import { useRole } from './useRole'

/** Whether to show the links that lead to `/admin` (the map's shield button
 * and the one on `/me`): a staff role on a desktop layout. `canAccessAdmin` is
 * false until the profile has loaded, so nothing flashes for visitors who
 * don't have the role.
 *
 * The desktop condition is temporary: `/admin` isn't laid out for touch devices
 * yet, so the follow-up that does that lifts it here, in this one place.
 * Purely cosmetic — the route guard (`RequireRole`) and RLS are what gate the
 * page, and the URL still works everywhere. */
export function useShowAdminEntryPoints(): boolean {
  const { canAccessAdmin } = useRole()
  const isDesktopLayout = useDesktopLayout()
  return canAccessAdmin && isDesktopLayout
}
