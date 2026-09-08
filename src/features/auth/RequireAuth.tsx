import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { Spinner } from '../../components/Spinner'
import { useAuth } from './useAuth'

/** Route guard for pages that require a session (e.g. `/me`). Shows a
 * neutral spinner while auth is still resolving — never a flash of "logged
 * out" — then redirects to `/login?next=<current path>` if there's no user. */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { user, isInitializing } = useAuth()
  const location = useLocation()

  if (isInitializing) return <Spinner />

  if (!user) {
    const next = encodeURIComponent(location.pathname + location.search)
    return <Navigate to={`/login?next=${next}`} replace />
  }

  return children
}
