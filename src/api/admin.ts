import { z } from 'zod'
import { supabase } from '../lib/supabase'
import { klashFromRow, type Klash, type KlashCategory, type KlashStatus } from '../types/klash'
import { profileFromRow, userRoleSchema, type Profile } from '../types/profile'
import type { UserRole } from '../types/profile'
import { daysAgoIso } from '../utils/formatDate'

// find_profile_by_email() (unlike a plain `profiles` row) deliberately
// returns only what's needed to act on the account — no created_at, no
// email — so it gets its own schema rather than reusing profileFromRow's,
// which requires created_at.
export const foundProfileSchema = z.object({
  id: z.string(),
  displayName: z.string().nullable(),
  role: userRoleSchema,
  organization: z.string().nullable(),
})
export type FoundProfile = z.infer<typeof foundProfileSchema>

const foundProfileRowSchema = z.object({
  id: z.string(),
  display_name: z.string().nullable(),
  role: userRoleSchema,
  organization: z.string().nullable(),
})

function foundProfileFromRow(row: unknown): FoundProfile {
  const parsed = foundProfileRowSchema.parse(row)
  return {
    id: parsed.id,
    displayName: parsed.display_name,
    role: parsed.role,
    organization: parsed.organization,
  }
}

export const ADMIN_PAGE_SIZE = 25

export interface AdminKlashFilters {
  status: KlashStatus | null
  category: KlashCategory | null
  /** Klashs created on or after this ISO date, or null for no lower bound. */
  since: string | null
  /** Case-insensitive substring match against the title. */
  searchText: string
}

export interface AdminKlashPage {
  klashes: Klash[]
  totalCount: number
  /** The page actually served — can differ from the requested `page` when
   * the request was out of range (see the PGRST103 handling below). */
  page: number
}

/** Paginated, filtered, searchable klash listing for `/admin` (spec §6.6).
 * Reads `klashes_public` directly rather than through `klashes_in_bbox`:
 * that RPC excludes rejected/duplicate/old-resolved klashs, which is
 * exactly what moderation needs to see. `{ count: 'exact' }` is used
 * instead of a second query for the total: at admin-table volumes (a few
 * thousand rows) this is simpler than maintaining a separate count RPC. */
export async function fetchAdminKlashes(
  filters: AdminKlashFilters,
  page: number,
): Promise<AdminKlashPage> {
  let query = supabase
    .from('klashes_public')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })

  if (filters.status) query = query.eq('status', filters.status)
  if (filters.category) query = query.eq('category', filters.category)
  if (filters.since) query = query.gte('created_at', filters.since)
  if (filters.searchText.trim().length > 0) {
    query = query.ilike('title', `%${filters.searchText.trim()}%`)
  }

  const from = page * ADMIN_PAGE_SIZE
  const { data, error, count } = await query.range(from, from + ADMIN_PAGE_SIZE - 1)
  if (error) {
    // PostgREST rejects a range whose start is beyond the total row count
    // (PGRST103) rather than returning an empty page — a stale or
    // hand-edited `?page=` link would otherwise fail forever, since
    // "Réessayer" repeats the same out-of-range request. Recover by
    // serving page 0 instead; the caller reconciles the URL to the page
    // actually served. Recursion is bounded to depth 1: the recursive call
    // always passes page 0, and the guard requires page > 0.
    if (error.code === 'PGRST103' && page > 0) return fetchAdminKlashes(filters, 0)
    throw error
  }
  return { klashes: data.map(klashFromRow), totalCount: count ?? 0, page }
}

/** Klashs stuck in `new` for more than 7 days (spec §6.6 "file à trier").
 * Public read (same RLS as the rest of klashes_public); this app only
 * surfaces it to staff. */
export async function fetchTriageQueue(): Promise<Klash[]> {
  const { data, error } = await supabase
    .from('klashes_public')
    .select('*')
    .eq('status', 'new')
    .lt('created_at', daysAgoIso(7))
    .order('created_at', { ascending: true })
  if (error) throw error
  return data.map(klashFromRow)
}

/** Finds a profile by its account email, for `/admin`'s role management
 * (spec §6.6, admin only) via the `find_profile_by_email` RPC — the email
 * itself lives in `auth.users`, unreachable from the client directly.
 * Returns `null` when no account matches. */
export async function findProfileByEmail(email: string): Promise<FoundProfile | null> {
  const { data, error } = await supabase.rpc('find_profile_by_email', { email })
  if (error) throw error
  return data[0] ? foundProfileFromRow(data[0]) : null
}

/** Updates a profile's role and/or organization (admin only —
 * `profiles_update_admin` grants this unrestricted; `profiles_guard_role`
 * additionally allows only an admin to touch either column at all). */
export async function updateProfileRoleAndOrganization(
  profileId: string,
  role: UserRole,
  organization: string | null,
): Promise<Profile> {
  const { data, error } = await supabase
    .from('profiles')
    .update({ role, organization })
    .eq('id', profileId)
    .select('*')
    .single()
  if (error) throw error
  return profileFromRow(data)
}
