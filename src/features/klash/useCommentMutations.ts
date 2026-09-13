import { useMutation, useQueryClient } from '@tanstack/react-query'
import { createComment, deleteComment, updateComment } from '../../api/comments'
import { commentKeys, klashKeys } from '../../api/queryKeys'
import { useAuth } from '../auth/useAuth'

/** Invalidates both the comment list and the klash detail: `comments_count`
 * lives on the klash row, so a comment write also affects the detail query. */
function invalidateComments(queryClient: ReturnType<typeof useQueryClient>, klashId: string) {
  void queryClient.invalidateQueries({ queryKey: commentKeys.byKlash(klashId) })
  void queryClient.invalidateQueries({ queryKey: klashKeys.detail(klashId) })
}

/** Posts a new comment on a klash as the signed-in user. */
export function useCreateComment(klashId: string) {
  const { user } = useAuth()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (body: string) => {
      if (!user) throw new Error('Cannot comment while signed out')
      return createComment(klashId, user.id, body)
    },
    onSuccess: () => invalidateComments(queryClient, klashId),
  })
}

/** Edits one of the signed-in user's own comments. */
export function useUpdateComment(klashId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ commentId, body }: { commentId: string; body: string }) =>
      updateComment(commentId, body),
    onSuccess: () => invalidateComments(queryClient, klashId),
  })
}

/** Deletes one of the signed-in user's own comments. */
export function useDeleteComment(klashId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (commentId: string) => deleteComment(commentId),
    onSuccess: () => invalidateComments(queryClient, klashId),
  })
}
