import { useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  adminTabFromSearchParams,
  adminTabToSearchParams,
  type AdminTab,
} from './adminFilterParams'
import { fr } from '../../i18n/fr'
import { useRole } from '../auth/useRole'
import { AdminKlashTable } from './AdminKlashTable'
import { RoleManagement } from './RoleManagement'
import { CampaignsTab } from '../campaigns/CampaignsTab'
import { canAccessAdmin } from '../../lib/klashPermissions'
import { TriageQueue } from './TriageQueue'
import { BackLink } from '../../components/BackLink'

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
  const { role, isResolved, canManageCampaigns } = useRole()
  const isAdmin = role === 'admin'
  const isStaff = canAccessAdmin(role)
  const [searchParams, setSearchParams] = useSearchParams()
  const tab = useMemo(() => adminTabFromSearchParams(searchParams), [searchParams])

  // Which tabs this account may use: moderation tabs for staff roles, roles
  // for admins, campaigns for campaign managers (a manager may have no staff
  // role at all). A `?tab=` link to a tab the account lacks (or while the
  // role hasn't resolved) would otherwise render an empty panel, so it falls
  // back to the first available one. Derived here instead of corrected in an
  // effect: an effect would still render the empty panel for one frame.
  // Waits on `isResolved` so a reload on /admin?tab=roles isn't bounced for
  // the instant before the role has loaded. The stale `?tab=` in the URL is
  // simply overwritten the next time the user switches tabs.
  const availableTabs: AdminTab[] = [
    ...(isStaff ? (['klashes', 'triage'] as const) : []),
    ...(isAdmin ? (['roles'] as const) : []),
    ...(canManageCampaigns ? (['campaigns'] as const) : []),
  ]
  const effectiveTab: AdminTab =
    !isResolved || availableTabs.includes(tab) ? tab : (availableTabs[0] ?? 'klashes')

  function changeTab(next: AdminTab) {
    setSearchParams((current) => adminTabToSearchParams(current, next), { replace: true })
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-4">
      <BackLink />

      <h1 className="mt-2 text-xl font-semibold text-neutral-900">{fr.admin.title}</h1>

      <div className="mt-4 flex gap-1 overflow-x-auto border-b border-neutral-200">
        {isStaff && (
          <>
            <TabButton active={effectiveTab === 'klashes'} onClick={() => changeTab('klashes')}>
              {fr.admin.tabs.klashes}
            </TabButton>
            <TabButton active={effectiveTab === 'triage'} onClick={() => changeTab('triage')}>
              {fr.admin.tabs.triage}
            </TabButton>
          </>
        )}
        {isAdmin && (
          <TabButton active={effectiveTab === 'roles'} onClick={() => changeTab('roles')}>
            {fr.admin.tabs.roles}
          </TabButton>
        )}
        {canManageCampaigns && (
          <TabButton active={effectiveTab === 'campaigns'} onClick={() => changeTab('campaigns')}>
            {fr.admin.tabs.campaigns}
          </TabButton>
        )}
      </div>

      <div className="mt-4">
        {effectiveTab === 'klashes' && isStaff && <AdminKlashTable />}
        {effectiveTab === 'triage' && isStaff && <TriageQueue />}
        {effectiveTab === 'roles' && isAdmin && <RoleManagement />}
        {effectiveTab === 'campaigns' && canManageCampaigns && <CampaignsTab />}
      </div>
    </div>
  )
}

// The focus ring is drawn inset: the tab row scrolls horizontally, which clips
// an outline painted outside the button (same reason as the map controls, see
// `mapControlButtonClassName`).
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
      className={`min-h-11 border-b-2 px-3 py-2 text-sm font-medium whitespace-nowrap focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-teal-700 ${
        active
          ? 'border-teal-700 text-teal-700'
          : 'border-transparent text-neutral-500 hover:text-neutral-700'
      }`}
    >
      {children}
    </button>
  )
}
