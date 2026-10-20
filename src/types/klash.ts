import { z } from 'zod'
import { Constants, type Database } from './database'
import { userRoleSchema } from './profile'
import { fr } from '../i18n/fr'

// zod schemas for the database enums, so klash objects coming back from
// Supabase can be validated, not just cast. Importance and status are built
// from the generated enums (src/types/database.ts, generated from
// supabase/migrations): the Postgres type is the single source of truth.
// The category list keeps a hand-written display order, see below.
// Display order of the categories (picker, filters), which is not the enum
// order: 'category_7' ("Autre") stays last although 'category_8' was added
// after it, and a Postgres enum cannot be reordered. A new category is placed
// here by hand; the checks below make the typecheck fail (and a unit test
// too) when this list and the database enum disagree in either direction.
export const CATEGORY_DISPLAY_ORDER = [
  'category_1',
  'category_2',
  'category_3',
  'category_4',
  'category_5',
  'category_6',
  'category_8',
  'category_7',
] as const

type DatabaseCategory = Database['public']['Enums']['klash_category']
type Assert<T extends true> = T
export type CategoriesAllListed = Assert<
  [Exclude<DatabaseCategory, (typeof CATEGORY_DISPLAY_ORDER)[number]>] extends [never]
    ? true
    : false
>
export type CategoriesAllKnown = Assert<
  [Exclude<(typeof CATEGORY_DISPLAY_ORDER)[number], DatabaseCategory>] extends [never]
    ? true
    : false
>

export const klashCategorySchema = z.enum(CATEGORY_DISPLAY_ORDER)
export type KlashCategory = z.infer<typeof klashCategorySchema>

// The special "Autre (préciser)" category: the only one paired with a
// free-text categoryOther, and the one kept last in the picker regardless of
// where new categories are inserted above.
export const CATEGORY_OTHER: KlashCategory = 'category_7'

export const klashImportanceSchema = z.enum(Constants.public.Enums.klash_importance)
export type KlashImportance = z.infer<typeof klashImportanceSchema>

export const klashStatusSchema = z.enum(Constants.public.Enums.klash_status)
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
  categoryOther: z.string().nullable(),
  importance: klashImportanceSchema,
  status: klashStatusSchema,
  title: z.string(),
  description: z.string().nullable(),
  proposedSolution: z.string().nullable(),
  duplicateOf: z.string().nullable(),
  confirmationsCount: z.number(),
  commentsCount: z.number(),
  createdAt: z.string(),
  updatedAt: z.string(),
  resolvedAt: z.string().nullable(),
  communeName: z.string().nullable(),
  authorDisplayName: z.string().nullable(),
  authorOrganization: z.string().nullable(),
  authorRole: userRoleSchema,
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
  category_other: z.string().nullable(),
  importance: klashImportanceSchema,
  status: klashStatusSchema,
  title: z.string(),
  description: z.string().nullable(),
  proposed_solution: z.string().nullable(),
  duplicate_of: z.string().nullable(),
  confirmations_count: z.number(),
  comments_count: z.number(),
  created_at: z.string(),
  updated_at: z.string(),
  resolved_at: z.string().nullable(),
  commune_name: z.string().nullable(),
  author_display_name: z.string().nullable(),
  author_organization: z.string().nullable(),
  author_role: userRoleSchema,
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
    categoryOther: parsed.category_other,
    importance: parsed.importance,
    status: parsed.status,
    title: parsed.title,
    description: parsed.description,
    proposedSolution: parsed.proposed_solution,
    duplicateOf: parsed.duplicate_of,
    confirmationsCount: parsed.confirmations_count,
    commentsCount: parsed.comments_count,
    createdAt: parsed.created_at,
    updatedAt: parsed.updated_at,
    resolvedAt: parsed.resolved_at,
    communeName: parsed.commune_name,
    authorDisplayName: parsed.author_display_name,
    authorOrganization: parsed.author_organization,
    authorRole: parsed.author_role,
  }
}

// Row shape for the public export (spec §6.7): the same `klashes_public`
// view, but selected without any author column — `klashFromRow` above can't
// be reused for it, since `klashRowSchema` requires `author_id`/`author_role`
// to be present. A separate, narrower schema is the same pattern
// `foundProfileRowSchema` uses in src/api/admin.ts for the same reason.
const exportKlashRowSchema = z.object({
  id: z.string(),
  lat: z.number(),
  lng: z.number(),
  insee_code: z.string().nullable(),
  commune_name: z.string().nullable(),
  epci_siren: z.string().nullable(),
  epci_name: z.string().nullable(),
  category: klashCategorySchema,
  importance: klashImportanceSchema,
  status: klashStatusSchema,
  title: z.string(),
  description: z.string().nullable(),
  duplicate_of: z.string().nullable(),
  confirmations_count: z.number(),
  comments_count: z.number(),
  created_at: z.string(),
  updated_at: z.string(),
  resolved_at: z.string().nullable(),
})

export const exportKlashSchema = z.object({
  id: z.string(),
  lat: z.number(),
  lng: z.number(),
  inseeCode: z.string().nullable(),
  communeName: z.string().nullable(),
  epciSiren: z.string().nullable(),
  epciName: z.string().nullable(),
  category: klashCategorySchema,
  importance: klashImportanceSchema,
  status: klashStatusSchema,
  title: z.string(),
  description: z.string().nullable(),
  duplicateOf: z.string().nullable(),
  confirmationsCount: z.number(),
  commentsCount: z.number(),
  createdAt: z.string(),
  updatedAt: z.string(),
  resolvedAt: z.string().nullable(),
})
export type ExportKlash = z.infer<typeof exportKlashSchema>

/** Validates and maps one raw export row (no author columns) into `ExportKlash`. */
export function exportKlashFromRow(row: unknown): ExportKlash {
  const parsed = exportKlashRowSchema.parse(row)
  return {
    id: parsed.id,
    lat: parsed.lat,
    lng: parsed.lng,
    inseeCode: parsed.insee_code,
    communeName: parsed.commune_name,
    epciSiren: parsed.epci_siren,
    epciName: parsed.epci_name,
    category: parsed.category,
    importance: parsed.importance,
    status: parsed.status,
    title: parsed.title,
    description: parsed.description,
    duplicateOf: parsed.duplicate_of,
    confirmationsCount: parsed.confirmations_count,
    commentsCount: parsed.comments_count,
    createdAt: parsed.created_at,
    updatedAt: parsed.updated_at,
    resolvedAt: parsed.resolved_at,
  }
}

/** The category label to display for a klash: the reporter's own precision for
 * 'category_7' ("Autre (préciser)") when there is one, the fixed i18n label
 * otherwise. Centralises the rule so every badge (map, detail, duplicates, admin)
 * renders it the same way. */
export function klashCategoryLabel(klash: Pick<Klash, 'category' | 'categoryOther'>): string {
  if (klash.category === CATEGORY_OTHER && klash.categoryOther) return klash.categoryOther
  return fr.category[klash.category]
}
