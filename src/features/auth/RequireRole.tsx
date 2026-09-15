import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { Spinner } from '../../components/Spinner'
import type { UserRole } from '../../types/profile'
import { useAuth } from './useAuth'
import { useRole } from './useRole'

/** Route guard for staff-only pages (e.g. `/admin`, spec §6.6). Unlike
 * `RequireAuth`, this must wait on *two* resolutions — auth **and** the
 * profile query — before deciding: a signed-in moderator whose profile is
 * still loading has a role of `null` for a moment, and deciding on that
 * alone would flash "forbidden" at a legitimate staff member. Redirects
 * signed-out visitors to `/login`, and anyone whose role isn't allowed to
 * `/` (not a login prompt — logging in again wouldn't grant them access). */
export function RequireRole({
  allow,
  children,
}: {
  allow: readonly UserRole[]
  children: ReactNode
}) {
  const { user } = useAuth()
  const { role, isResolved } = useRole()

  if (!isResolved) return <Spinner />

  if (!user) return <Navigate to="/login" replace />

  if (!role || !allow.includes(role)) return <Navigate to="/" replace />

  return children
}
