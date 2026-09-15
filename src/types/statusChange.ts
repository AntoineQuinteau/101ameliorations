import { z } from 'zod'
import { klashStatusSchema } from './klash'
import { userRoleSchema } from './profile'

export const statusChangeSchema = z.object({
  id: z.string(),
  klashId: z.string(),
  changedById: z.string(),
  changedByDisplayName: z.string().nullable(),
  changedByOrganization: z.string().nullable(),
  changedByRole: userRoleSchema,
  fromStatus: klashStatusSchema,
  toStatus: klashStatusSchema,
  note: z.string().nullable(),
  createdAt: z.string(),
})
export type StatusChange = z.infer<typeof statusChangeSchema>

// Raw shape returned by Supabase (snake_case). `status_changes` is a plain
// table, not a view, so these columns are only nullable where the schema
// actually allows it. `changed_by_*` come from a PostgREST embed of
// profiles (status_changes_changed_by_fkey), the same pattern comments.ts
// uses for its author — profiles_select_all is `using (true)` and profiles
// holds no email, so no dedicated view is needed to expose it safely.
const statusChangeRowSchema = z.object({
  id: z.string(),
  klash_id: z.string(),
  changed_by: z.string(),
  from_status: klashStatusSchema,
  to_status: klashStatusSchema,
  note: z.string().nullable(),
  created_at: z.string(),
  profiles: z
    .object({
      display_name: z.string().nullable(),
      organization: z.string().nullable(),
      role: userRoleSchema,
    })
    .nullable(),
})

/** Validates and maps one raw `status_changes` row (with its embedded actor
 * profile) into the app's `StatusChange` shape. */
export function statusChangeFromRow(row: unknown): StatusChange {
  const parsed = statusChangeRowSchema.parse(row)
  return {
    id: parsed.id,
    klashId: parsed.klash_id,
    changedById: parsed.changed_by,
    changedByDisplayName: parsed.profiles?.display_name ?? null,
    changedByOrganization: parsed.profiles?.organization ?? null,
    changedByRole: parsed.profiles?.role ?? 'user',
    fromStatus: parsed.from_status,
    toStatus: parsed.to_status,
    note: parsed.note,
    createdAt: parsed.created_at,
  }
}
