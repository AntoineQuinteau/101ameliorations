import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ErrorMessage } from '../../components/ErrorMessage'
import { fr } from '../../i18n/fr'
import { useAuth } from '../auth/useAuth'
import { useProfile } from '../auth/useProfile'
import { useUpdateDisplayName } from '../auth/useUpdateDisplayName'
import { DisplayNameForm } from './DisplayNameForm'
import { MyKlashList } from './MyKlashList'
import { useDeleteMyAccount } from './useDeleteMyAccount'

/** Spec §6.5: my klashs, my pseudo, sign-out, and — since step 9 — RGPD
 * account deletion. "My confirmations" is deferred to a later step (see
 * the step-3 plan); it was never picked up since. */
export function MePage() {
  const { user, signOut } = useAuth()
  const { data: profile } = useProfile()
  const updateDisplayName = useUpdateDisplayName()
  const deleteAccountMutation = useDeleteMyAccount()
  const navigate = useNavigate()
  const [savedNotice, setSavedNotice] = useState(false)
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false)

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

  async function handleDeleteAccount() {
    // The RPC itself deletes auth.users, which already ends the session
    // server-side — signOut() here clears the client-side session state
    // (and, via SIGNED_OUT, the query cache) the same way MePage's own
    // sign-out does, and navigates away exactly once that has happened, for
    // the same reason handleSignOut navigates first: this component
    // (and the mutation with it) must not unmount before the request lands.
    await deleteAccountMutation.mutateAsync()
    navigate('/', { replace: true })
    await signOut()
  }

  if (!user) return null

  return (
    <div className="mx-auto max-w-xl px-4 py-4">
      <Link to="/" className="text-sm font-medium text-teal-700 hover:underline">
        {fr.common.backToMap}
      </Link>

      <h1 className="mt-2 text-xl font-semibold text-neutral-900">{fr.me.title}</h1>

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

      <section className="mt-8 rounded-xl border border-red-200 bg-red-50/50 p-4">
        <h2 className="text-sm font-semibold text-red-900">{fr.me.deleteAccount.title}</h2>
        <p className="mt-1 text-sm text-red-800">{fr.me.deleteAccount.body}</p>

        {isConfirmingDelete ? (
          <div className="mt-3 flex flex-col gap-2">
            <p className="text-sm font-medium text-red-900">{fr.me.deleteAccount.confirmPrompt}</p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void handleDeleteAccount()}
                disabled={deleteAccountMutation.isPending}
                className="inline-flex items-center justify-center rounded-md bg-red-700 px-3 py-2 text-sm font-medium text-white hover:bg-red-800 disabled:opacity-60"
              >
                {deleteAccountMutation.isPending
                  ? fr.me.deleteAccount.deleting
                  : fr.me.deleteAccount.confirm}
              </button>
              <button
                type="button"
                onClick={() => setIsConfirmingDelete(false)}
                disabled={deleteAccountMutation.isPending}
                className="inline-flex items-center justify-center rounded-md border border-neutral-300 px-3 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50 disabled:opacity-60"
              >
                {fr.me.deleteAccount.cancel}
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setIsConfirmingDelete(true)}
            className="mt-3 text-sm font-medium text-red-700 hover:underline"
          >
            {fr.me.deleteAccount.trigger}
          </button>
        )}

        {deleteAccountMutation.isError && (
          <div className="mt-2">
            <ErrorMessage message={fr.me.deleteAccount.error} />
          </div>
        )}
      </section>
    </div>
  )
}
