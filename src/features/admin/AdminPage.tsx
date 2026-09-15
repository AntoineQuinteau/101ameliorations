import { useState } from 'react'
import { Link } from 'react-router-dom'
import { fr } from '../../i18n/fr'
import { useRole } from '../auth/useRole'
import { AdminKlashTable } from './AdminKlashTable'
import { RoleManagement } from './RoleManagement'
import { TriageQueue } from './TriageQueue'

type Tab = 'klashes' | 'triage' | 'roles'

/** `/admin` (spec §6.6, rôles ≥ moderator). Scoped for this step to a
 * paginated/filtered klash table, the "à trier" queue, and role management
 * for admins — batch actions and statistics are explicitly deferred to a
 * later step. A thin orchestrator, like MePage: each tab's content is a
 * self-contained component that owns its own query. */
export function AdminPage() {
  const { role } = useRole()
  const isAdmin = role === 'admin'
  const [tab, setTab] = useState<Tab>('klashes')

  return (
    <div className="mx-auto max-w-5xl px-4 py-4">
      <Link to="/" className="text-sm font-medium text-teal-700 hover:underline">
        {fr.common.backToMap}
      </Link>

      <h1 className="mt-2 text-xl font-semibold text-neutral-900">{fr.admin.title}</h1>

      <div className="mt-4 flex gap-1 border-b border-neutral-200">
        <TabButton active={tab === 'klashes'} onClick={() => setTab('klashes')}>
          {fr.admin.tabs.klashes}
        </TabButton>
        <TabButton active={tab === 'triage'} onClick={() => setTab('triage')}>
          {fr.admin.tabs.triage}
        </TabButton>
        {isAdmin && (
          <TabButton active={tab === 'roles'} onClick={() => setTab('roles')}>
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
