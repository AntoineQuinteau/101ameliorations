import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { fr } from '../../i18n/fr'
import { useAuth } from '../auth/useAuth'
import { useProfile } from '../auth/useProfile'
import { useUpdateDisplayName } from '../auth/useUpdateDisplayName'
import { DisplayNameForm } from './DisplayNameForm'
import { MyKlashList } from './MyKlashList'

/** Spec §6.5. Scoped to my klashes + pseudo + sign-out for this step — "my
 * confirmations" is deferred to step 6 (alongside comments), and account
 * deletion to step 9 (RGPD anonymization), per the step-3 plan. */
export function MePage() {
  const { user, signOut } = useAuth()
  const { data: profile } = useProfile()
  const updateDisplayName = useUpdateDisplayName()
  const navigate = useNavigate()
  const [savedNotice, setSavedNotice] = useState(false)

  async function handleSignOut() {
    // Navigate away first: RequireAuth (wrapping this route) reacts to
    // `user` becoming null by redirecting to `/login?next=/me`, which would
    // otherwise race the explicit redirect to `/` below and win.
    navigate('/', { replace: true })
    await signOut()
  }

  async function handleDisplayNameSubmit(displayName: string) {
    await updateDisplayName.mutateAsync(displayName)
    setSavedNotice(true)
  }

  if (!user) return null

  return (
    <div className="mx-auto max-w-xl px-4 py-4">
      <h1 className="text-xl font-semibold text-neutral-900">{fr.me.title}</h1>

      <section className="mt-4 rounded-xl bg-white p-4 shadow-lg ring-1 ring-black/5">
        <DisplayNameForm
          initialValue={profile?.displayName ?? ''}
          submitLabel={fr.me.pseudoSave}
          isSubmitting={updateDisplayName.isPending}
          onSubmit={(displayName) => void handleDisplayNameSubmit(displayName)}
        />
        {savedNotice && (
          <p role="status" className="mt-2 text-sm text-teal-700">
            {fr.me.pseudoSaved}
          </p>
        )}
      </section>

      <h2 className="mt-6 mb-2 text-lg font-semibold text-neutral-900">{fr.me.myKlashes}</h2>
      <MyKlashList userId={user.id} />

      <button
        type="button"
        onClick={() => void handleSignOut()}
        className="mt-6 rounded-md border border-neutral-300 px-3 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
      >
        {fr.me.signOut}
      </button>
    </div>
  )
}
