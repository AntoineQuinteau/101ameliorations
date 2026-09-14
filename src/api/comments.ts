import { supabase } from '../lib/supabase'
import { commentFromRow, type Comment } from '../types/comment'

// Every read embeds the author's display_name via the comments_author_id_fkey
// relationship (profiles_select_all is `using (true)` and profiles holds no
// email, so this embed exposes nothing RLS wouldn't already allow directly).
const COMMENT_SELECT = '*, profiles!comments_author_id_fkey(display_name)'

/** Comments on a klash, oldest first (spec §6.3: chronological). RLS
 * (`comments_select_visible`) already excludes hidden comments for a
 * non-staff viewer, so no filter is needed here. */
export async function fetchComments(klashId: string): Promise<Comment[]> {
  const { data, error } = await supabase
    .from('comments')
    .select(COMMENT_SELECT)
    .eq('klash_id', klashId)
    .order('created_at', { ascending: true })
  if (error) throw error
  return data.map(commentFromRow)
}

/** Posts a new comment as `authorId` (must be the signed-in user's own id:
 * `comments_insert_own` rejects anything else). Also subject to
 * `enforce_comment_rate_limit()` (50 / 24h per user). */
export async function createComment(
  klashId: string,
  authorId: string,
  body: string,
): Promise<Comment> {
  const { data, error } = await supabase
    .from('comments')
    .insert({ klash_id: klashId, author_id: authorId, body })
    .select(COMMENT_SELECT)
    .single()
  if (error) throw error
  return commentFromRow(data)
}

/** Edits a comment's body. Only the comment's own author may call this in
 * practice (`comments_update_author_or_staff`); a moderator/admin could also
 * reach this policy, but hiding is a separate action (`hideComment` below,
 * step 7), not this one. */
export async function updateComment(commentId: string, body: string): Promise<Comment> {
  const { data, error } = await supabase
    .from('comments')
    .update({ body })
    .eq('id', commentId)
    .select(COMMENT_SELECT)
    .single()
  if (error) throw error
  return commentFromRow(data)
}

/** Deletes a comment. Allowed for its own author or staff
 * (`comments_delete_author_or_staff`); this app only ever calls it for the
 * signed-in user's own comment. */
export async function deleteComment(commentId: string): Promise<void> {
  const { error } = await supabase.from('comments').delete().eq('id', commentId)
  if (error) throw error
}
