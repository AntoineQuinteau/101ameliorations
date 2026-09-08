import { supabase } from '../lib/supabase'
import { klashFromRow, type Klash } from '../types/klash'

/** All klashs authored by the given user, most recent first — including
 * rejected/duplicate/old-resolved ones (unlike the map's bbox RPC): on `/me`
 * the user should see everything they filed. */
export async function fetchKlashesByAuthor(authorId: string): Promise<Klash[]> {
  const { data, error } = await supabase
    .from('klashes_public')
    .select('*')
    .eq('author_id', authorId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data.map(klashFromRow)
}
