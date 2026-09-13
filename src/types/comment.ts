import { z } from 'zod'

export const commentSchema = z.object({
  id: z.string(),
  klashId: z.string(),
  authorId: z.string(),
  authorDisplayName: z.string().nullable(),
  body: z.string(),
  hidden: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
})
export type Comment = z.infer<typeof commentSchema>

// Raw shape returned by Supabase (snake_case). `comments` is a plain table,
// not a view, so unlike klashes_public these columns are only nullable
// where the schema actually allows it. `author_display_name` comes from a
// PostgREST embed of profiles (comments_author_id_fkey), not a column on
// comments itself — profiles_select_all is `using (true)` and profiles
// holds no email, so no dedicated view is needed to expose it safely.
const commentRowSchema = z.object({
  id: z.string(),
  klash_id: z.string(),
  author_id: z.string(),
  body: z.string(),
  hidden: z.boolean(),
  created_at: z.string(),
  updated_at: z.string(),
  profiles: z.object({ display_name: z.string().nullable() }).nullable(),
})

/** Validates and maps one raw `comments` row (with its embedded author
 * profile) into the app's `Comment` shape. */
export function commentFromRow(row: unknown): Comment {
  const parsed = commentRowSchema.parse(row)
  return {
    id: parsed.id,
    klashId: parsed.klash_id,
    authorId: parsed.author_id,
    authorDisplayName: parsed.profiles?.display_name ?? null,
    body: parsed.body,
    hidden: parsed.hidden,
    createdAt: parsed.created_at,
    updatedAt: parsed.updated_at,
  }
}
