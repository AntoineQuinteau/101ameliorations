import { useMemo } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import {
  adminTabFromSearchParams,
  adminTabToSearchParams,
  type AdminTab,
} from './adminFilterParams'
import { fr } from '../../i18n/fr'
import { useRole } from '../auth/useRole'
import { AdminKlashTable } from './AdminKlashTable'
import { RoleManagement } from './RoleManagement'
import { TriageQueue } from './TriageQueue'

/** `/admin` (spec §6.6, rôles ≥ moderator). Scoped for this step to a
 * paginated/filtered klash table, the "à trier" queue, and role management
 * for admins — batch actions and statistics are explicitly deferred to a
 * later step. A thin orchestrator, like MePage: each tab's content is a
 * self-contained component that owns its own query.
 *
 * The active tab is reflected in the URL (`?tab=`), alongside the klash
 * table's own filters/page — see `adminFilterParams.ts`. Derived from the
 * URL on every render rather than mirrored into a `useState` (same
 * rationale as `AdminKlashTable`'s `params`), so browser back/forward
 * across tabs is picked up automatically. */
export function AdminPage() {
  const { role, isResolved } = useRole()
  const isAdmin = role === 'admin'
  const [searchParams, setSearchParams] = useSearchParams()
  const tab = useMemo(() => adminTabFromSearchParams(searchParams), [searchParams])

  // A `?tab=roles` link opened by a non-admin (or while the role hasn't
  // resolved yet) would otherwise render an empty panel — the roles tab's
  // content is only rendered for `isAdmin`. Derived here instead of
  // corrected in an effect: an effect would still render that empty panel
  // for one frame before redirecting. Waits on `isResolved` so an admin
  // reloading /admin?tab=roles isn't bounced to "Signalements" for the
  // instant before their own role has loaded. The stale `?tab=roles` in
  // the URL is simply overwritten the next time the user switches tabs.
  const effectiveTab: AdminTab = tab === 'roles' && isResolved && !isAdmin ? 'klashes' : tab

  function changeTab(next: AdminTab) {
    setSearchParams((current) => adminTabToSearchParams(current, next), { replace: true })
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-4">
      <Link to="/" className="text-sm font-medium text-teal-700 hover:underline">
        {fr.common.backToMap}
      </Link>

      <h1 className="mt-2 text-xl font-semibold text-neutral-900">{fr.admin.title}</h1>

      <div className="mt-4 flex gap-1 border-b border-neutral-200">
        <TabButton active={effectiveTab === 'klashes'} onClick={() => changeTab('klashes')}>
          {fr.admin.tabs.klashes}
        </TabButton>
        <TabButton active={effectiveTab === 'triage'} onClick={() => changeTab('triage')}>
          {fr.admin.tabs.triage}
        </TabButton>
        {isAdmin && (
          <TabButton active={effectiveTab === 'roles'} onClick={() => changeTab('roles')}>
            {fr.admin.tabs.roles}
          </TabButton>
        )}
      </div>

      <div className="mt-4">
        {effectiveTab === 'klashes' && <AdminKlashTable />}
        {effectiveTab === 'triage' && <TriageQueue />}
        {effectiveTab === 'roles' && isAdmin && <RoleManagement />}
      </div>
    </div>
  )
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`border-b-2 px-3 py-2 text-sm font-medium ${
        active
          ? 'border-teal-700 text-teal-700'
          : 'border-transparent text-neutral-500 hover:text-neutral-700'
      }`}
    >
      {children}
    </button>
  )
}
