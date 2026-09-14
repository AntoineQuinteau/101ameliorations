import { z } from 'zod'

// Mirrors the DB CHECK constraint on comments.body (char_length between 1
// and 1000).
export const commentBodySchema = z.string().trim().min(1).max(1000)

/** Maps a comment mutation failure to a French message. Mirrors
 * NewKlashPage's `mapSubmitError`: the DB's exact exception text (matched
 * literally by pgTAP, see supabase/tests/comments_rls_test.sql) is the
 * source of truth, not a Postgres error code. */
export function mapCommentError(error: unknown, fallback: string, rateLimited: string): string {
  const message = error instanceof Error ? error.message : ''
  if (message.includes('rate limit exceeded')) return rateLimited
  return fallback
}
