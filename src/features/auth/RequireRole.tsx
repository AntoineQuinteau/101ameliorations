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
  children,
}: {
  allow: readonly UserRole[]
  children: ReactNode
}) {
  const { role, isResolved } = useRole()

  if (!isResolved) return <Spinner />

  if (!role || !allow.includes(role)) return <Navigate to="/" replace />

  return children
}
