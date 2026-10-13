import { useEffect, useState, type ReactNode } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { fetchKlashById } from '../../api/klashes'
import { klashKeys } from '../../api/queryKeys'
import { Badge } from '../../components/Badge'
import { ErrorMessage } from '../../components/ErrorMessage'
import { Spinner } from '../../components/Spinner'
import { fr } from '../../i18n/fr'
import { canDeleteKlash, canEditKlash } from '../../lib/klashPermissions'
import { displayActor, statusTone, importanceTone } from '../../lib/klashPresentation'
import { allowedNextStatuses } from '../../lib/klashTransitions'
import { klashCategoryLabel, type KlashStatus } from '../../types/klash'
import type { NewKlashForm } from '../newKlash/newKlashSchemas'
import { formatDate } from '../../utils/formatDate'
import { useAuth } from '../auth/useAuth'
import { useRole } from '../auth/useRole'
import { ChangeStatusForm } from './ChangeStatusForm'
import { CommentList } from './CommentList'
import { EditKlashForm } from './EditKlashForm'
import { findKlashInMapCache } from './findKlashInMapCache'
import { KlashMiniMap } from './KlashMiniMap'
import { KlashPhotoGallery } from './KlashPhotoGallery'
import { KLASH_OVERLAY_STATE } from './klashOverlay'
import { StatusHistory } from './StatusHistory'
import { useChangeKlashStatus } from './useChangeKlashStatus'
import { useConfirmKlash } from './useConfirmKlash'
import { useDeleteKlash } from './useDeleteKlash'
import { useKlashAuthorContact } from './useKlashAuthorContact'
import { useMyConfirmation } from './useMyConfirmation'
import { useShareKlash } from './useShareKlash'
import { useUpdateKlash } from './useUpdateKlash'
import { Check } from 'lucide-react'

/** Maps an updateKlash failure to a French message: RLS turns a forbidden
 * edit (e.g. the klash left `new` mid-edit) into a distinguishable 'klash
 * update not permitted' error rather than a generic one — see updateKlash's
 * docblock — so that case gets its own, more informative message. */
function mapUpdateKlashError(error: unknown): string {
  const message = error instanceof Error ? error.message : ''
  return message.includes('klash update not permitted')
    ? fr.detail.edit.forbiddenError
    : fr.detail.edit.submitError
}

/** Klash detail content (spec §6.3), shared by the full page (`KlashDetailPage`) and the
 * modal over the map (`KlashDetailModal`): read-only content, the confirm (+1) button,
 * comments, the status history and the role-gated actions (change status, edit, delete).
 * From `lg` up it widens to two columns — klash content and status timeline on the left,
 * comments on the right — in CSS only; DOM order is the mobile order. Edit mode, loading
 * and not-found stay a single narrow column. */
export function KlashDetail({
  klashId,
  header,
  onDeleted,
  inOverlay = false,
}: {
  klashId: string
  /** Rendered at the top of the content (the page's back link row). Omitted in the modal. */
  header?: ReactNode
  /** Called once the klash has actually been deleted. */
  onDeleted: () => void
  /** True inside the map modal: in-content klash links must stay in the modal. */
  inOverlay?: boolean
}) {
  const { user } = useAuth()
  const { role } = useRole()
  const queryClient = useQueryClient()
  const [isChangingStatus, setIsChangingStatus] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [editFeedback, setEditFeedback] = useState<'saved' | null>(null)

  const {
    data: klash,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: klashKeys.detail(klashId),
    queryFn: () => fetchKlashById(klashId),
    // Opened from the map, the klash is already in its cache: start from that
    // copy, dated as it is, so it refetches here only once stale.
    initialData: () => findKlashInMapCache(queryClient, klashId)?.klash,
    initialDataUpdatedAt: () => findKlashInMapCache(queryClient, klashId)?.updatedAt,
  })

  // KlashDetailPage stays mounted across a navigation from one klash to
  // another on this same route — including its own "duplicate of" link to
  // /k/${klash.duplicateOf} — so none of this component's useState resets
  // on its own. Without this, editing and saving klash A leaves
  // editFeedback/isEditing/isChangingStatus set when the user clicks
  // through to klash B: "Modifications enregistrées." would show for a
  // klash never touched, and worse, a still-open EditKlashForm would stay
  // mounted with its value state still initialised from klash A while its
  // onSubmit now targets klash B's id. Resetting isEditing also unmounts
  // EditKlashForm, clearing its own internal state for free.
  useEffect(() => {
    setIsEditing(false)
    setEditFeedback(null)
    setIsChangingStatus(false)
  }, [klashId])

  const { data: hasConfirmed = false } = useMyConfirmation(klashId)
  const confirmMutation = useConfirmKlash(klashId, hasConfirmed)
  const changeStatusMutation = useChangeKlashStatus(klashId)
  const updateMutation = useUpdateKlash(klashId)
  const deleteMutation = useDeleteKlash()
  const { share, feedback: shareFeedback } = useShareKlash(klash)
  const authorContactMutation = useKlashAuthorContact()
  const isAuthor = Boolean(user) && user?.id === klash?.authorId
  const canDelete = klash ? canDeleteKlash(role, isAuthor, klash.status) : false
  const canEdit = klash ? canEditKlash(role, isAuthor, klash.status) : false
  const canSeeAuthorContact = role === 'moderator' || role === 'authority' || role === 'admin'
  const nextStatuses = role && klash ? allowedNextStatuses(role, klash.status) : []

  function handleChangeStatus(toStatus: KlashStatus, note: string | null) {
    changeStatusMutation.mutate({ toStatus, note }, { onSuccess: () => setIsChangingStatus(false) })
  }

  function handleSaveEdit(form: NewKlashForm) {
    updateMutation.mutate(form, {
      onSuccess: () => {
        setIsEditing(false)
        setEditFeedback('saved')
      },
    })
  }

  function handleDelete() {
    if (!klash || !window.confirm(fr.detail.deleteKlashConfirm)) return
    // Navigate only once the delete has actually succeeded. Navigating
    // first unmounts this page and with it the mutation, so the request
    // never completed and any failure was invisible — the klash silently
    // stayed put. (MePage navigates before signOut() for the opposite
    // reason: signOut lives on the auth context, which outlives the page.)
    deleteMutation.mutate(klash.id, {
      onSuccess: () => onDeleted(),
    })
  }

  return (
    <div className={`mx-auto max-w-xl px-4 py-4 ${klash && !isEditing ? 'lg:max-w-5xl' : ''}`}>
      {header}

      {isLoading && <Spinner />}

      {isError && <ErrorMessage message={fr.detail.loadError} onRetry={() => refetch()} />}

      {!isLoading && !isError && !klash && (
        <div className="mt-6 text-center">
          <h1 className="text-lg font-semibold text-neutral-900">{fr.detail.notFoundTitle}</h1>
          <p className="mt-1 text-sm text-neutral-500">{fr.detail.notFoundBody}</p>
        </div>
      )}

      {klash && isEditing && (
        <div className="mt-4">
          <EditKlashForm
            klash={klash}
            isSubmitting={updateMutation.isPending}
            submitErrorMessage={
              updateMutation.isError ? mapUpdateKlashError(updateMutation.error) : null
            }
            onSubmit={handleSaveEdit}
            onCancel={() => setIsEditing(false)}
          />
        </div>
      )}

      {klash && !isEditing && (
        <article
          className={`${header ? 'mt-4' : ''} flex flex-col gap-4 lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,24rem)] lg:items-start lg:gap-6`}
        >
          <div className="flex min-w-0 flex-col gap-4">
            <KlashMiniMap klash={klash} />

            <KlashPhotoGallery klashId={klash.id} />

            <div role="group" aria-label={fr.detail.badgesLabel} className="flex flex-wrap gap-1.5">
              <Badge label={klashCategoryLabel(klash)} tone="gray" />
              <Badge
                label={fr.importanceBadge[klash.importance]}
                tone={importanceTone(klash.importance)}
              />
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
                  {...(inOverlay ? { state: KLASH_OVERLAY_STATE, replace: true } : {})}
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
                  {displayActor(
                    klash.authorRole,
                    klash.authorDisplayName,
                    klash.authorOrganization,
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-neutral-500">{fr.detail.confirmations}</dt>
                <dd className="font-medium text-neutral-900">{klash.confirmationsCount}</dd>
              </div>
            </dl>

            {canSeeAuthorContact && (
              <div className="text-sm">
                {authorContactMutation.data ? (
                  <p className="font-medium text-neutral-900">{authorContactMutation.data}</p>
                ) : (
                  <button
                    type="button"
                    onClick={() => authorContactMutation.mutate(klash.id)}
                    disabled={authorContactMutation.isPending}
                    className="font-medium text-teal-700 hover:underline disabled:opacity-60"
                  >
                    {authorContactMutation.isPending
                      ? fr.detail.authorContact.loading
                      : fr.detail.authorContact.reveal}
                  </button>
                )}
                {authorContactMutation.isError && (
                  <p role="alert" className="mt-1 text-xs text-red-700">
                    {fr.detail.authorContact.error}
                  </p>
                )}
                {authorContactMutation.data && (
                  <p className="mt-1 text-xs text-neutral-500">{fr.detail.authorContact.notice}</p>
                )}
              </div>
            )}

            <div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  disabled={!user || isAuthor || confirmMutation.isPending}
                  aria-busy={confirmMutation.isPending}
                  onClick={() => confirmMutation.mutate()}
                  className="inline-flex items-center justify-center gap-1 rounded-md bg-teal-700 px-3 py-2 text-sm font-medium text-white hover:bg-teal-800 disabled:opacity-60"
                >
                  {hasConfirmed ? (
                    <>
                      <Check className="size-4" />
                      {fr.detail.confirmed}
                    </>
                  ) : (
                    fr.detail.confirm
                  )}
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

            {editFeedback === 'saved' && (
              <p role="status" className="text-sm text-teal-800">
                {fr.detail.edit.saved}
              </p>
            )}

            {(nextStatuses.length > 0 || canEdit || canDelete) && (
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
                    {canEdit && (
                      <button
                        type="button"
                        onClick={() => {
                          setEditFeedback(null)
                          updateMutation.reset()
                          setIsEditing(true)
                        }}
                        className="text-sm font-medium text-teal-700 hover:underline"
                      >
                        {fr.detail.editKlash}
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

            <StatusHistory klash={klash} />
          </div>

          {/* A light rule sets the comments apart from the klash; stretched so it
              runs the full height of the taller column. */}
          <div className="lg:self-stretch lg:border-l lg:border-neutral-200 lg:pl-6">
            <CommentList klashId={klash.id} />
          </div>
        </article>
      )}
    </div>
  )
}
