import { useRole } from './useRole'

/** Whether to show the links that lead to `/admin` (the map's shield button
 * and the one on `/me`): any staff role, on any device. `canAccessAdmin` is
 * false until the profile has loaded, so nothing flashes for visitors who
 * don't have the role.
 *
 * Purely cosmetic — the route guard (`RequireRole`) and RLS are what gate the
 * page, and the URL works regardless. */
export function useShowAdminEntryPoints(): boolean {
  return useRole().canAccessAdmin
}
