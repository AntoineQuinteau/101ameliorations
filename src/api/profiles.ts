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
