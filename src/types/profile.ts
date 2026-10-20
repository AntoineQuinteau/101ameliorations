import { z } from 'zod'
import { Constants } from './database'

// Built from the generated database enum (src/types/database.ts), same
// rationale as klashStatusSchema etc. in src/types/klash.ts.
export const userRoleSchema = z.enum(Constants.public.Enums.user_role)
export type UserRole = z.infer<typeof userRoleSchema>

export const profileSchema = z.object({
  id: z.string(),
  displayName: z.string().nullable(),
  role: userRoleSchema,
  organization: z.string().nullable(),
  canManageCampaigns: z.boolean(),
  createdAt: z.string(),
})
export type Profile = z.infer<typeof profileSchema>

// Raw shape returned by Supabase (snake_case).
const profileRowSchema = z.object({
  id: z.string(),
  display_name: z.string().nullable(),
  role: userRoleSchema,
  organization: z.string().nullable(),
  can_manage_campaigns: z.boolean(),
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
    canManageCampaigns: parsed.can_manage_campaigns,
    createdAt: parsed.created_at,
  }
}
