import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { Spinner } from '../../components/Spinner'
import { useRole } from './useRole'

/** Route guard for `/campaigns` (spec §6.8): the campaign-manager right, or an
 * admin. Independent of the staff roles — a moderator without the right is
 * sent away, a plain `user` holding it gets in. Same waiting and redirect
 * rules as `RequireRole`. */
export function RequireCampaignManager({ children }: { children: ReactNode }) {
  const { isResolved, canManageCampaigns } = useRole()

  if (!isResolved) return <Spinner />
  if (!canManageCampaigns) return <Navigate to="/" replace />

  return children
}
