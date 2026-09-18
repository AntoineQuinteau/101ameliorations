import { supabase } from '../lib/supabase'
import { profileFromRow, type Profile } from '../types/profile'

/** The current user's profile, or `null` if it doesn't exist yet (the
 * `handle_new_user` trigger runs in the same transaction as the auth.users
 * insert, so this should be rare — but the UI tolerates it, falling back to
 * `fr.common.anonymousAuthor`, rather than erroring). */
export async function fetchProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle()
  if (error) throw error
  return data ? profileFromRow(data) : null
}

/** Updates the current user's pseudo. RLS (`profiles_update_own`) restricts
 * this to the caller's own row; the DB CHECK constraint enforces 2-40 chars. */
export async function updateDisplayName(userId: string, displayName: string): Promise<Profile> {
  const { data, error } = await supabase
    .from('profiles')
    .update({ display_name: displayName })
    .eq('id', userId)
    .select('*')
    .single()
  if (error) throw error
  return profileFromRow(data)
}

/** RGPD account deletion (spec §6.5): anonymises the caller's klashs, photos,
 * comments and status_changes to the "compte supprimé" sentinel, withdraws
 * their confirmations, then deletes their `auth.users` row — see the
 * `delete_my_account` RPC for why that ordering is forced by foreign keys,
 * not chosen.
 *
 * Storage photos are NOT removed by the RPC (SQL cannot reach
 * `storage.objects` — see the migration), so any caller of this function
 * that wants the caller's photo *files* gone must call
 * `removeKlashPhotoObjects` for each of the caller's klashs first. The
 * default here is to keep them: spec §6.5 preserves the collective data by
 * design, and a kept photo stays attached to the now-anonymised klash. */
export async function deleteMyAccount(): Promise<void> {
  const { error } = await supabase.rpc('delete_my_account')
  if (error) throw error
}
