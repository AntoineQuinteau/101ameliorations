import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { fetchKlashById } from '../../api/klashes'
import { klashKeys } from '../../api/queryKeys'
import { Badge } from '../../components/Badge'
import { ErrorMessage } from '../../components/ErrorMessage'
import { Spinner } from '../../components/Spinner'
import { fr } from '../../i18n/fr'
import { displayActor, statusTone, urgencyTone } from '../../lib/klashPresentation'
import { allowedNextStatuses } from '../../lib/klashTransitions'
import { klashCategoryLabel, type KlashStatus } from '../../types/klash'
import { formatDate } from '../../utils/formatDate'
import { useAuth } from '../auth/useAuth'
import { useRole } from '../auth/useRole'
import { ChangeStatusForm } from './ChangeStatusForm'
import { CommentList } from './CommentList'
import { KlashMiniMap } from './KlashMiniMap'
import { KlashPhotoGallery } from './KlashPhotoGallery'
import { StatusHistory } from './StatusHistory'
import { useChangeKlashStatus } from './useChangeKlashStatus'
import { useConfirmKlash } from './useConfirmKlash'
import { useDeleteKlash } from './useDeleteKlash'
import { useMyConfirmation } from './useMyConfirmation'
import { useShareKlash } from './useShareKlash'

/** Detail page (spec §6.3): read-only content, the confirm (+1) button
 * (step 4), comments (step 6), and — since step 7 — the status history and
 * the role-gated actions (change status, edit, delete). */
export function KlashDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { user } = useAuth()
  const { role, isStaff } = useRole()
  const navigate = useNavigate()
  const [isChangingStatus, setIsChangingStatus] = useState(false)

  const {
    data: klash,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: klashKeys.detail(id ?? ''),
    queryFn: () => fetchKlashById(id as string),
    enabled: Boolean(id),
  })

  const { data: hasConfirmed = false } = useMyConfirmation(id ?? '')
  const confirmMutation = useConfirmKlash(id ?? '', hasConfirmed)
  const changeStatusMutation = useChangeKlashStatus(id ?? '')
  const deleteMutation = useDeleteKlash()
  const { share, feedback: shareFeedback } = useShareKlash(klash)
  const isAuthor = Boolean(user) && user?.id === klash?.authorId
  const canDelete = isAuthor && klash?.status === 'new' ? true : isStaff
  const nextStatuses = role && klash ? allowedNextStatuses(role, klash.status) : []

  function handleChangeStatus(toStatus: KlashStatus, note: string | null) {
    changeStatusMutation.mutate({ toStatus, note }, { onSuccess: () => setIsChangingStatus(false) })
  }

  function handleDelete() {
    if (!klash || !window.confirm(fr.detail.deleteKlashConfirm)) return
    // Navigate only once the delete has actually succeeded. Navigating
    // first unmounts this page and with it the mutation, so the request
    // never completed and any failure was invisible — the klash silently
    // stayed put. (MePage navigates before signOut() for the opposite
    // reason: signOut lives on the auth context, which outlives the page.)
    deleteMutation.mutate(klash.id, {
      onSuccess: () => navigate('/', { replace: true }),
    })
  }

  return (
    <div className="mx-auto max-w-xl px-4 py-4">
      <div className="flex items-center justify-between">
        <Link to="/" className="text-sm font-medium text-teal-700 hover:underline">
          {fr.common.backToMap}
        </Link>
        <Link
          to={user ? '/me' : '/login'}
          className="text-sm font-medium text-teal-700 hover:underline"
        >
          {user ? fr.auth.mySpace : fr.auth.signIn}
        </Link>
      </div>

      {isLoading && <Spinner />}

      {isError && <ErrorMessage message={fr.detail.loadError} onRetry={() => refetch()} />}

      {!isLoading && !isError && !klash && (
        <div className="mt-6 text-center">
          <h1 className="text-lg font-semibold text-neutral-900">{fr.detail.notFoundTitle}</h1>
          <p className="mt-1 text-sm text-neutral-500">{fr.detail.notFoundBody}</p>
        </div>
      )}

      {klash && (
        <article className="mt-4 flex flex-col gap-4">
          <KlashMiniMap klash={klash} />

          <KlashPhotoGallery klashId={klash.id} />

          <div className="flex flex-wrap gap-1.5">
            <Badge label={klashCategoryLabel(klash)} tone="gray" />
            <Badge label={fr.urgency[klash.urgency]} tone={urgencyTone(klash.urgency)} />
            <Badge label={fr.status[klash.status]} tone={statusTone(klash.status)} />
          </div>

          <h1 className="text-xl font-semibold text-neutral-900">{klash.title}</h1>

          {klash.description && (
            <p className="text-sm whitespace-pre-wrap text-neutral-700">{klash.description}</p>
          )}

          {klash.proposedSolution && (
            <div>
              <h2 className="text-sm font-medium text-neutral-700">
                {fr.detail.proposedSolutionLabel}
              </h2>
              <p className="text-sm whitespace-pre-wrap text-neutral-700">
                {klash.proposedSolution}
              </p>
            </div>
          )}

          {klash.status === 'duplicate' && klash.duplicateOf && (
            <p className="text-sm text-neutral-500">
              {fr.detail.duplicateOfNotice}{' '}
              <Link
                to={`/k/${klash.duplicateOf}`}
                className="font-medium text-teal-700 hover:underline"
              >
                {fr.map.viewDetail}
              </Link>
            </p>
          )}

          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            <div>
              <dt className="text-neutral-500">{fr.detail.reportedBy}</dt>
              <dd className="font-medium text-neutral-900">
                {displayActor(klash.authorRole, klash.authorDisplayName, klash.authorOrganization)}
              </dd>
            </div>
            <div>
              <dt className="text-neutral-500">{fr.detail.confirmations}</dt>
              <dd className="font-medium text-neutral-900">{klash.confirmationsCount}</dd>
            </div>
          </dl>

          <div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                disabled={!user || isAuthor || confirmMutation.isPending}
                aria-busy={confirmMutation.isPending}
                onClick={() => confirmMutation.mutate()}
                className="inline-flex items-center justify-center rounded-md bg-teal-700 px-3 py-2 text-sm font-medium text-white hover:bg-teal-800 disabled:opacity-60"
              >
                {hasConfirmed ? fr.detail.confirmed : fr.detail.confirm}
              </button>
              <button
                type="button"
                onClick={() => void share()}
                className="inline-flex items-center justify-center rounded-md border border-neutral-300 px-3 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
              >
                {fr.detail.share}
              </button>
            </div>
            {confirmMutation.isError && <ErrorMessage message={fr.detail.confirmError} />}
            {shareFeedback === 'copied' && (
              <p role="status" className="mt-1 text-xs text-neutral-500">
                {fr.detail.linkCopied}
              </p>
            )}
            {shareFeedback === 'error' && (
              <p role="alert" className="mt-1 text-xs text-red-700">
                {fr.detail.shareError}
              </p>
            )}
          </div>

          <p className="text-xs text-neutral-500">
            {klash.status === 'resolved' && klash.resolvedAt
              ? fr.detail.resolvedOn(formatDate(klash.resolvedAt))
              : fr.detail.updatedOn(formatDate(klash.updatedAt))}
          </p>

          {(nextStatuses.length > 0 || canDelete) && (
            <div className="flex flex-col gap-2 rounded-md border border-neutral-200 p-3">
              {isChangingStatus ? (
                <ChangeStatusForm
                  options={nextStatuses}
                  isSubmitting={changeStatusMutation.isPending}
                  submitErrorMessage={
                    changeStatusMutation.isError ? fr.detail.lifecycle.submitError : null
                  }
                  onSubmit={handleChangeStatus}
                  onCancel={() => setIsChangingStatus(false)}
                />
              ) : (
                <div className="flex flex-wrap gap-3">
                  {nextStatuses.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setIsChangingStatus(true)}
                      className="text-sm font-medium text-teal-700 hover:underline"
                    >
                      {fr.detail.lifecycle.changeStatusTitle}
                    </button>
                  )}
                  {canDelete && (
                    <button
                      type="button"
                      onClick={handleDelete}
                      disabled={deleteMutation.isPending}
                      className="text-sm font-medium text-red-700 hover:underline disabled:opacity-60"
                    >
                      {deleteMutation.isPending ? fr.detail.deleting : fr.detail.deleteKlash}
                    </button>
                  )}
                </div>
              )}
              {deleteMutation.isError && (
                <p role="alert" className="text-sm text-red-700">
                  {fr.detail.deleteKlashError}
                </p>
              )}
            </div>
          )}

          <StatusHistory klashId={klash.id} />

          <CommentList klashId={klash.id} />
        </article>
      )}
    </div>
  )
}
