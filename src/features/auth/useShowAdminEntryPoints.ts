import { useDesktopLayout } from '../../hooks/useDesktopLayout'
import { useRole } from './useRole'

/** Whether to show the links that lead to `/admin` (the map's shield button
 * and the one on `/me`): a staff role (`canAccessAdmin`, once it has resolved,
 * so nothing flashes for visitors who don't have it) on a desktop layout.
 *
 * The desktop condition is temporary: `/admin` isn't laid out for touch devices
 * yet, so the follow-up that does that lifts it here, in this one place.
 * Purely cosmetic — the route guard (`RequireRole`) and RLS are what gate the
 * page, and the URL still works everywhere. */
export function useShowAdminEntryPoints(): boolean {
  const { isResolved, canAccessAdmin } = useRole()
  const isDesktopLayout = useDesktopLayout()
  return isResolved && canAccessAdmin && isDesktopLayout
}
