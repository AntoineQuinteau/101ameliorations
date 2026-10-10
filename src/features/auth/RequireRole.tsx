import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { Spinner } from '../../components/Spinner'
import type { UserRole } from '../../types/profile'
import { useRole } from './useRole'

/** Route guard for staff-only pages (e.g. `/admin`, spec §6.6). Unlike
 * `RequireAuth`, this must wait on *two* resolutions — auth **and** the
 * profile query — before deciding: a signed-in moderator whose profile is
 * still loading has a role of `null` for a moment, and deciding on that
 * alone would flash "forbidden" at a legitimate staff member. `useRole`'s
 * `isResolved` handles the signed-out case, where the profile query is
 * disabled and so never settles.
 *
 * Everyone unauthorized goes to `/`, signed out or not: `/admin` is gated
 * on a role, not on having a session, so sending an anonymous visitor to
 * `/login` would imply that signing in grants access. */
export function RequireRole({
  allow,
  orCampaignManager = false,
  children,
}: {
  allow: readonly UserRole[]
  /** Also let in an account with the campaign-manager right, whatever its role. */
  orCampaignManager?: boolean
  children: ReactNode
}) {
  const { role, isResolved, canManageCampaigns } = useRole()

  if (!isResolved) return <Spinner />

  const allowed =
    (role !== null && allow.includes(role)) || (orCampaignManager && canManageCampaigns)
  if (!allowed) return <Navigate to="/" replace />

  return children
}
