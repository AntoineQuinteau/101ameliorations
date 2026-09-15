import { supabase } from '../lib/supabase'
import type { KlashStatus } from '../types/klash'
import { klashFromRow, type Klash } from '../types/klash'
import { statusChangeFromRow, type StatusChange } from '../types/statusChange'

// Every read embeds the actor's display_name/organization/role via the
// status_changes_changed_by_fkey relationship, the same pattern
// comments.ts uses for COMMENT_SELECT.
const STATUS_CHANGE_SELECT =
  '*, profiles!status_changes_changed_by_fkey(display_name, organization, role)'

/** Status history for a klash, oldest first, for the "Historique des
 * statuts" section on `/k/:id` (spec §6.3). RLS (`status_changes_select_all`)
 * is public, so this is safe to call for any visitor. */
export async function fetchStatusHistory(klashId: string): Promise<StatusChange[]> {
  const { data, error } = await supabase
    .from('status_changes')
    .select(STATUS_CHANGE_SELECT)
    .eq('klash_id', klashId)
    .order('created_at', { ascending: true })
  if (error) throw error
  return data.map(statusChangeFromRow)
}

/** Moves a klash to `toStatus`, with an optional note (spec §3, §6.3), via
 * the `change_klash_status` RPC — the only supported way to do this: the
 * database has no other path that both validates the role/transition graph
 * and writes the status_changes history row (that table has no INSERT
 * policy; the RPC is SECURITY DEFINER for exactly that write). */
export async function changeKlashStatus(
  klashId: string,
  toStatus: KlashStatus,
  note: string | null,
): Promise<Klash> {
  const { data, error } = await supabase.rpc('change_klash_status', {
    klash_id: klashId,
    to_status: toStatus,
    // The generated type has `note: string | undefined` (gen_types doesn't
    // mark a `default null` SQL parameter as nullable), but the RPC's
    // plpgsql body treats a null note the same as an absent one — the DB,
    // not this type, is authoritative (same idiom as createKlash's
    // `description` cast in src/api/klashes.ts).
    note: note as string | undefined,
  })
  if (error) throw error
  return klashFromRow(data)
}
