import { z } from 'zod'

// Mirrors the database enum (src/types/database.ts, generated from
// supabase/migrations). Kept as a separate zod source of truth, same
// rationale as klashCategorySchema etc. in src/types/klash.ts.
export const userRoleSchema = z.enum(['user', 'moderator', 'authority', 'admin'])
export type UserRole = z.infer<typeof userRoleSchema>

export const profileSchema = z.object({
  id: z.string(),
  displayName: z.string().nullable(),
  role: userRoleSchema,
  organization: z.string().nullable(),
  createdAt: z.string(),
})
export type Profile = z.infer<typeof profileSchema>

// Raw shape returned by Supabase (snake_case).
const profileRowSchema = z.object({
  id: z.string(),
  display_name: z.string().nullable(),
  role: userRoleSchema,
  organization: z.string().nullable(),
  created_at: z.string(),
})

/** Validates and maps one raw `profiles` row into the app's `Profile` shape. */
export function profileFromRow(row: unknown): Profile {
  const parsed = profileRowSchema.parse(row)
  return {
    id: parsed.id,
    displayName: parsed.display_name,
    role: parsed.role,
    organization: parsed.organization,
    createdAt: parsed.created_at,
  }
}
