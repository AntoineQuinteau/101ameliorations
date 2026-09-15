import { useState } from 'react'
import { fr } from '../../i18n/fr'
import type { UserRole } from '../../types/profile'
import { userRoleSchema } from '../../types/profile'
import { useAuth } from '../auth/useAuth'
import { useFindProfileByEmail, useUpdateProfileRoleAndOrganization } from './useRoleManagement'

const ROLE_OPTIONS = userRoleSchema.options

/** Role management (spec §6.6, admin only): search an account by email,
 * then change its role and, for `authority`, its public organization name.
 * `admin`-gating happens at the route (RequireRole) and the tab that hosts
 * this component; this component assumes it's already reachable only by an
 * admin. */
export function RoleManagement() {
  const { user } = useAuth()
  const [email, setEmail] = useState('')
  const [selectedRole, setSelectedRole] = useState<UserRole>('user')
  const [organization, setOrganization] = useState('')
  const [saved, setSaved] = useState(false)

  const findProfile = useFindProfileByEmail()
  const updateRole = useUpdateProfileRoleAndOrganization()

  function handleSearch(event: React.FormEvent) {
    event.preventDefault()
    setSaved(false)
    findProfile.mutate(email.trim(), {
      onSuccess: (profile) => {
        setSelectedRole(profile?.role ?? 'user')
        setOrganization(profile?.organization ?? '')
      },
    })
  }

  function handleSave(event: React.FormEvent) {
    event.preventDefault()
    const profile = findProfile.data
    if (!profile) return
    setSaved(false)
    updateRole.mutate(
      {
        profileId: profile.id,
        role: selectedRole,
        organization: organization.trim().length > 0 ? organization.trim() : null,
      },
      { onSuccess: () => setSaved(true) },
    )
  }

  const profile = findProfile.data
  const isSelf = Boolean(profile) && profile?.id === user?.id
  const isSelfDemotion = isSelf && selectedRole !== 'admin'

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-neutral-500">{fr.admin.roles.body}</p>

      <form onSubmit={handleSearch} className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-sm text-neutral-700">
          {fr.admin.roles.searchLabel}
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder={fr.admin.roles.searchPlaceholder}
            className="rounded-md border border-neutral-300 px-3 py-2 text-sm focus:border-teal-700 focus:ring-1 focus:ring-teal-700 focus:outline-none"
          />
        </label>
        <button
          type="submit"
          disabled={findProfile.isPending || email.trim().length === 0}
          aria-busy={findProfile.isPending}
          className="inline-flex items-center justify-center rounded-md bg-teal-700 px-3 py-2 text-sm font-medium text-white hover:bg-teal-800 disabled:opacity-60"
        >
          {findProfile.isPending ? fr.admin.roles.searching : fr.admin.roles.search}
        </button>
      </form>

      {findProfile.isError && (
        <p role="alert" className="text-sm text-red-700">
          {fr.admin.roles.searchError}
        </p>
      )}
      {findProfile.isSuccess && !findProfile.data && (
        <p className="text-sm text-neutral-500">{fr.admin.roles.notFound}</p>
      )}

      {profile && (
        <form
          onSubmit={handleSave}
          className="flex flex-col gap-3 rounded-md border border-neutral-200 p-3"
        >
          <p className="text-sm font-medium text-neutral-900">
            {profile.displayName ?? fr.common.anonymousAuthor}
          </p>

          <label className="flex flex-col gap-1 text-sm text-neutral-700">
            {fr.admin.roles.roleLabel}
            <select
              value={selectedRole}
              onChange={(event) => setSelectedRole(event.target.value as UserRole)}
              className="rounded-md border border-neutral-300 px-3 py-2 text-sm focus:border-teal-700 focus:ring-1 focus:ring-teal-700 focus:outline-none"
            >
              {ROLE_OPTIONS.map((role) => (
                <option key={role} value={role}>
                  {fr.role[role]}
                </option>
              ))}
            </select>
          </label>

          {selectedRole === 'authority' && (
            <label className="flex flex-col gap-1 text-sm text-neutral-700">
              {fr.admin.roles.organizationLabel}
              <input
                type="text"
                value={organization}
                onChange={(event) => setOrganization(event.target.value)}
                placeholder={fr.admin.roles.organizationPlaceholder}
                className="rounded-md border border-neutral-300 px-3 py-2 text-sm focus:border-teal-700 focus:ring-1 focus:ring-teal-700 focus:outline-none"
              />
            </label>
          )}

          {isSelfDemotion && (
            <p role="alert" className="text-sm text-amber-700">
              {fr.admin.roles.selfDemoteWarning}
            </p>
          )}

          {updateRole.isError && (
            <p role="alert" className="text-sm text-red-700">
              {fr.admin.roles.saveError}
            </p>
          )}
          {saved && (
            <p role="status" className="text-sm text-teal-700">
              {fr.admin.roles.saved}
            </p>
          )}

          <button
            type="submit"
            disabled={updateRole.isPending}
            aria-busy={updateRole.isPending}
            className="inline-flex items-center justify-center rounded-md bg-teal-700 px-3 py-2 text-sm font-medium text-white hover:bg-teal-800 disabled:opacity-60"
          >
            {updateRole.isPending ? fr.admin.roles.saving : fr.admin.roles.save}
          </button>
        </form>
      )}
    </div>
  )
}
