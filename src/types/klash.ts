import { z } from 'zod'

// Mirrors the database enums (src/types/database.ts, generated from
// supabase/migrations). Kept as a separate zod source of truth so klash
// objects coming back from Supabase can be validated, not just cast.
export const klashCategorySchema = z.enum([
  'category_1',
  'category_2',
  'category_3',
  'category_4',
  'category_5',
])
export type KlashCategory = z.infer<typeof klashCategorySchema>

export const klashUrgencySchema = z.enum(['low', 'medium', 'high'])
export type KlashUrgency = z.infer<typeof klashUrgencySchema>

export const klashStatusSchema = z.enum([
  'new',
  'acknowledged',
  'in_progress',
  'resolved',
  'rejected',
  'duplicate',
])
export type KlashStatus = z.infer<typeof klashStatusSchema>

// `klashes_public` (and the `klashes_in_bbox` RPC built on it) is a Postgres
// view, so every column is nullable in the generated types even though only
// `author_display_name`/`author_organization` can actually be null in
// practice (author_id, category, etc. come from NOT NULL columns joined on
// their primary key). This schema asserts and narrows that at the boundary
// instead of trusting the loose generated type everywhere the data is used.
export const klashSchema = z.object({
  id: z.string(),
  authorId: z.string(),
  lat: z.number(),
  lng: z.number(),
  category: klashCategorySchema,
  urgency: klashUrgencySchema,
  status: klashStatusSchema,
  title: z.string(),
  description: z.string().nullable(),
  duplicateOf: z.string().nullable(),
  confirmationsCount: z.number(),
  commentsCount: z.number(),
  createdAt: z.string(),
  updatedAt: z.string(),
  resolvedAt: z.string().nullable(),
  authorDisplayName: z.string().nullable(),
  authorOrganization: z.string().nullable(),
})
export type Klash = z.infer<typeof klashSchema>

// Raw shape returned by Supabase (snake_case, all-nullable per the view).
// `klashFromRow` below maps and validates it into `Klash`.
const klashRowSchema = z.object({
  id: z.string(),
  author_id: z.string(),
  lat: z.number(),
  lng: z.number(),
  category: klashCategorySchema,
  urgency: klashUrgencySchema,
  status: klashStatusSchema,
  title: z.string(),
  description: z.string().nullable(),
  duplicate_of: z.string().nullable(),
  confirmations_count: z.number(),
  comments_count: z.number(),
  created_at: z.string(),
  updated_at: z.string(),
  resolved_at: z.string().nullable(),
  author_display_name: z.string().nullable(),
  author_organization: z.string().nullable(),
})

/** Validates and maps one raw `klashes_public` row into the app's `Klash` shape. */
export function klashFromRow(row: unknown): Klash {
  const parsed = klashRowSchema.parse(row)
  return {
    id: parsed.id,
    authorId: parsed.author_id,
    lat: parsed.lat,
    lng: parsed.lng,
    category: parsed.category,
    urgency: parsed.urgency,
    status: parsed.status,
    title: parsed.title,
    description: parsed.description,
    duplicateOf: parsed.duplicate_of,
    confirmationsCount: parsed.confirmations_count,
    commentsCount: parsed.comments_count,
    createdAt: parsed.created_at,
    updatedAt: parsed.updated_at,
    resolvedAt: parsed.resolved_at,
    authorDisplayName: parsed.author_display_name,
    authorOrganization: parsed.author_organization,
  }
}
