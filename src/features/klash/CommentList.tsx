import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ErrorMessage } from '../../components/ErrorMessage'
import { Spinner } from '../../components/Spinner'
import { fr } from '../../i18n/fr'
import { formatDate } from '../../utils/formatDate'
import { useAuth } from '../auth/useAuth'
import { CommentForm } from './CommentForm'
import { mapCommentError } from './commentSchemas'
import { useCreateComment, useDeleteComment, useUpdateComment } from './useCommentMutations'
import { useComments } from './useComments'
import type { Comment } from '../../types/comment'

/** Comment list + posting form for a klash's detail page (spec §6.3):
 * chronological, with edit/delete of one's own comments. Moderator hiding
 * is a step-7 concern (it needs role-aware UI); this page never reads a
 * role, it only ever acts on the signed-in user's own comments. */
export function CommentList({ klashId }: { klashId: string }) {
  const { user } = useAuth()
  const { data: comments, isLoading, isError, refetch } = useComments(klashId)
  const createComment = useCreateComment(klashId)

  function handlePost(body: string) {
    createComment.mutate(body, { onSuccess: () => createComment.reset() })
  }

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-sm font-semibold text-neutral-900">{fr.comments.title}</h2>

      {isLoading && <Spinner />}
      {isError && <ErrorMessage message={fr.comments.loadError} onRetry={() => refetch()} />}

      {comments && comments.length === 0 && (
        <p className="text-sm text-neutral-500">{fr.comments.empty}</p>
      )}

      {comments && comments.length > 0 && (
        <ul className="flex flex-col gap-3">
          {comments.map((comment) => (
            <li key={comment.id}>
              <CommentItem
                klashId={klashId}
                comment={comment}
                isOwn={comment.authorId === user?.id}
              />
            </li>
          ))}
        </ul>
      )}

      {user ? (
        <CommentForm
          key={createComment.isSuccess ? 'posted' : 'draft'}
          submitLabel={fr.comments.submit}
          submittingLabel={fr.comments.submitting}
          isSubmitting={createComment.isPending}
          submitErrorMessage={
            createComment.isError
              ? mapCommentError(
                  createComment.error,
                  fr.comments.submitError,
                  fr.comments.rateLimitError,
                )
              : null
          }
          onSubmit={handlePost}
        />
      ) : (
        <p className="text-sm text-neutral-500">
          <Link to="/login" className="font-medium text-teal-700 hover:underline">
            {fr.comments.loginPrompt}
          </Link>
        </p>
      )}
    </section>
  )
}

function CommentItem({
  klashId,
  comment,
  isOwn,
}: {
  klashId: string
  comment: Comment
  isOwn: boolean
}) {
  const [isEditing, setIsEditing] = useState(false)
  const updateComment = useUpdateComment(klashId)
  const deleteComment = useDeleteComment(klashId)

  function handleSave(body: string) {
    updateComment.mutate({ commentId: comment.id, body }, { onSuccess: () => setIsEditing(false) })
  }

  function handleDelete() {
    if (!window.confirm(fr.comments.deleteConfirm)) return
    deleteComment.mutate(comment.id)
  }

  if (isEditing) {
    return (
      <CommentForm
        initialValue={comment.body}
        submitLabel={fr.comments.save}
        submittingLabel={fr.comments.saving}
        isSubmitting={updateComment.isPending}
        submitErrorMessage={
          updateComment.isError
            ? mapCommentError(
                updateComment.error,
                fr.comments.saveError,
                fr.comments.rateLimitError,
              )
            : null
        }
        onSubmit={handleSave}
        onCancel={() => setIsEditing(false)}
      />
    )
  }

  return (
    <div className="flex flex-col gap-1 rounded-md border border-neutral-200 p-3">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-sm font-medium text-neutral-900">
          {comment.authorDisplayName ?? fr.common.anonymousAuthor}
        </span>
        <span className="text-xs text-neutral-500">
          {formatDate(comment.createdAt)}
          {comment.updatedAt !== comment.createdAt && ` · ${fr.comments.editedNotice}`}
        </span>
      </div>
      <p className="text-sm whitespace-pre-wrap text-neutral-700">{comment.body}</p>
      {isOwn && (
        <div className="mt-1 flex gap-3">
          <button
            type="button"
            onClick={() => setIsEditing(true)}
            className="text-xs font-medium text-teal-700 hover:underline"
          >
            {fr.comments.edit}
          </button>
          <button
            type="button"
            onClick={handleDelete}
            disabled={deleteComment.isPending}
            className="text-xs font-medium text-red-700 hover:underline disabled:opacity-60"
          >
            {deleteComment.isPending ? fr.comments.deleting : fr.comments.delete}
          </button>
          {deleteComment.isError && (
            <span role="alert" className="text-xs text-red-700">
              {fr.comments.deleteError}
            </span>
          )}
        </div>
      )}
    </div>
  )
}
