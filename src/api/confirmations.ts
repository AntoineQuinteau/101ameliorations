import { supabase } from '../lib/supabase'

/** Whether the given user has already confirmed this klash. RLS
 * (`confirmations_select_all`) allows reading any row, so this simply checks
 * for existence of the (klash_id, user_id) pair. */
export async function fetchMyConfirmation(klashId: string, userId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('confirmations')
    .select('klash_id')
    .eq('klash_id', klashId)
    .eq('user_id', userId)
    .maybeSingle()
  if (error) throw error
  return data !== null
}

/** Confirms a klash (+1, spec §6.3). The `confirmations_insert_self` policy
 * rejects this for the klash's own author — the UI disables the button for
 * them, but the DB is the real guard. */
export async function confirmKlash(klashId: string, userId: string): Promise<void> {
  const { error } = await supabase
    .from('confirmations')
    .insert({ klash_id: klashId, user_id: userId })
  if (error) throw error
}

/** Removes a confirmation (toggle off). */
export async function unconfirmKlash(klashId: string, userId: string): Promise<void> {
  const { error } = await supabase
    .from('confirmations')
    .delete()
    .eq('klash_id', klashId)
    .eq('user_id', userId)
  if (error) throw error
}
