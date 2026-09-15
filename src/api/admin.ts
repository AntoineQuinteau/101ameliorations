import { supabase } from '../lib/supabase'
import { klashFromRow, type Klash, type KlashCategory, type KlashStatus } from '../types/klash'
import { profileFromRow, type Profile } from '../types/profile'
import type { UserRole } from '../types/profile'

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
  if (error) throw error
  return { klashes: data.map(klashFromRow), totalCount: count ?? 0 }
}

/** Klashs stuck in `new` for more than 7 days (spec §6.6 "file à trier").
 * Public read (same RLS as the rest of klashes_public); this app only
 * surfaces it to staff. */
export async function fetchTriageQueue(): Promise<Klash[]> {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
  const { data, error } = await supabase
    .from('klashes_public')
    .select('*')
    .eq('status', 'new')
    .lt('created_at', sevenDaysAgo)
    .order('created_at', { ascending: true })
  if (error) throw error
  return data.map(klashFromRow)
}

/** Finds a profile by its account email, for `/admin`'s role management
 * (spec §6.6, admin only) via the `find_profile_by_email` RPC — the email
 * itself lives in `auth.users`, unreachable from the client directly.
 * Returns `null` when no account matches. */
export async function findProfileByEmail(email: string): Promise<Profile | null> {
  const { data, error } = await supabase.rpc('find_profile_by_email', { email })
  if (error) throw error
  return data[0] ? profileFromRow(data[0]) : null
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
