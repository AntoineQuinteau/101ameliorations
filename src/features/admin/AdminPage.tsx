import { useEffect, useState } from 'react'
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
 * table's own filters/page — see `adminFilterParams.ts`. */
export function AdminPage() {
  const { role, isResolved } = useRole()
  const isAdmin = role === 'admin'
  const [searchParams, setSearchParams] = useSearchParams()
  const [tab, setTab] = useState<AdminTab>(() => adminTabFromSearchParams(searchParams))

  function changeTab(next: AdminTab) {
    setTab(next)
    setSearchParams((current) => adminTabToSearchParams(current, next), { replace: true })
  }

  // A `?tab=roles` link opened by a non-admin (or while the role hasn't
  // resolved yet) would otherwise render nothing, since the roles tab's
  // content is only rendered `isAdmin && tab === 'roles'` below — fall back
  // to the klash table once the role is known to not be admin. Waits on
  // `isResolved` so an admin reloading /admin?tab=roles isn't bounced to
  // "Signalements" for the instant before their own role has loaded.
  useEffect(() => {
    if (tab === 'roles' && isResolved && !isAdmin) changeTab('klashes')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, isResolved, isAdmin])

  return (
    <div className="mx-auto max-w-5xl px-4 py-4">
      <Link to="/" className="text-sm font-medium text-teal-700 hover:underline">
        {fr.common.backToMap}
      </Link>

      <h1 className="mt-2 text-xl font-semibold text-neutral-900">{fr.admin.title}</h1>

      <div className="mt-4 flex gap-1 border-b border-neutral-200">
        <TabButton active={tab === 'klashes'} onClick={() => changeTab('klashes')}>
          {fr.admin.tabs.klashes}
        </TabButton>
        <TabButton active={tab === 'triage'} onClick={() => changeTab('triage')}>
          {fr.admin.tabs.triage}
        </TabButton>
        {isAdmin && (
          <TabButton active={tab === 'roles'} onClick={() => changeTab('roles')}>
            {fr.admin.tabs.roles}
          </TabButton>
        )}
      </div>

      <div className="mt-4">
        {tab === 'klashes' && <AdminKlashTable />}
        {tab === 'triage' && <TriageQueue />}
        {tab === 'roles' && isAdmin && <RoleManagement />}
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
