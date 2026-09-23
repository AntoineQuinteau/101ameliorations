import { supabase } from '../lib/supabase'
import type { Bbox } from '../utils/bbox'
import { klashFromRow, type Klash, type KlashCategory, type KlashUrgency } from '../types/klash'
import { removeKlashPhotoObjects } from './klashPhotos'

/** Klashs visible in a map viewport, via the `klashes_in_bbox` RPC (already excludes
 * rejected/duplicate and resolved-over-90-days — see the migration). */
export async function fetchKlashesInBbox(bbox: Bbox): Promise<Klash[]> {
  const { data, error } = await supabase.rpc('klashes_in_bbox', {
    min_lat: bbox.minLat,
    min_lng: bbox.minLng,
    max_lat: bbox.maxLat,
    max_lng: bbox.maxLng,
  })
  if (error) throw error
  return data.map(klashFromRow)
}

/** A single klash for the detail page, or `null` if it doesn't exist (or isn't visible
 * to the current viewer under RLS). */
export async function fetchKlashById(id: string): Promise<Klash | null> {
  const { data, error } = await supabase
    .from('klashes_public')
    .select('*')
    .eq('id', id)
    .maybeSingle()
  if (error) throw error
  return data ? klashFromRow(data) : null
}

/** Active klashs within `radiusM` metres of a point, for duplicate detection
 * (spec §6.2 step 2). Excludes rejected/duplicate and resolved-over-30-days,
 * per the `klashes_nearby` RPC. */
export async function fetchKlashesNearby(
  lat: number,
  lng: number,
  radiusM: number,
): Promise<Klash[]> {
  const { data, error } = await supabase.rpc('klashes_nearby', {
    origin_lat: lat,
    origin_lng: lng,
    radius_m: radiusM,
  })
  if (error) throw error
  return data.map(klashFromRow)
}

export interface CreateKlashInput {
  lat: number
  lng: number
  category: KlashCategory
  categoryOther: string | null
  urgency: KlashUrgency
  title: string
  description: string | null
  proposedSolution: string | null
}

/** Creates a klash via the `create_klash` RPC (builds the PostGIS point
 * server-side and hands back the row shaped like `klashes_public`, since a
 * plain insert on `klashes` can do neither — see the migration). */
export async function createKlash(input: CreateKlashInput): Promise<Klash> {
  const { data, error } = await supabase.rpc('create_klash', {
    lat: input.lat,
    lng: input.lng,
    category: input.category,
    urgency: input.urgency,
    title: input.title,
    // The generated type has `description: string` (gen_types doesn't mark a
    // plain `text` SQL parameter as nullable), but the column and the RPC's
    // plpgsql body both accept null — the DB, not this type, is authoritative.
    // Same reasoning for category_other and proposed_solution below.
    description: input.description as string,
    category_other: input.categoryOther as string,
    proposed_solution: input.proposedSolution as string,
  })
  if (error) throw error
  return klashFromRow(data)
}

export interface UpdateKlashInput {
  category: KlashCategory
  categoryOther: string | null
  urgency: KlashUrgency
  title: string
  description: string | null
  proposedSolution: string | null
}

/** Updates a klash's editable fields (spec §6.3 "Modifier"): category,
 * urgency, title, description, proposed solution — never position or
 * status, which have their own dedicated paths (create_klash builds the
 * PostGIS point; change_klash_status is the only way status moves).
 *
 * Writes to the `klashes` table directly, not the `klashes_public` view
 * (the view joins `profiles`, isn't auto-updatable, and exposes lat/lng
 * instead of the `location` column). `UpdateKlashInput` names exactly the
 * six editable columns — never spread a whole `Klash` here, or
 * `guard_klash_system_columns` rejects the write for touching
 * author_id/created_at/the counters.
 *
 * RLS (klashes_update_author_new / klashes_update_staff) turns a forbidden
 * update into a silent 0-row no-op, not an error — e.g. an author whose
 * klash left `new` mid-edit. `.select('id')` plus this length check is what
 * turns that into a reported failure instead of a false "saved". */
export async function updateKlash(id: string, input: UpdateKlashInput): Promise<Klash | null> {
  const { data, error } = await supabase
    .from('klashes')
    .update({
      category: input.category,
      category_other: input.categoryOther,
      urgency: input.urgency,
      title: input.title,
      description: input.description,
      proposed_solution: input.proposedSolution,
    })
    .eq('id', id)
    .select('id')

  if (error) throw error
  if (data.length === 0) throw new Error('klash update not permitted')

  // The table row doesn't carry lat/lng or the author_* columns
  // klashFromRow expects — re-read through the public view instead. By
  // this point the update already committed (data.length > 0 above), so a
  // null re-read is not a failed save — e.g. the klash's author profile
  // disappeared mid-account-anonymisation, dropping the row out of
  // klashes_public's inner join on profiles. Resolving with null rather
  // than throwing matters: nothing downstream reads this function's
  // return value (useUpdateKlash and KlashDetailPage's onSuccess both
  // only react to success vs. failure), so throwing here would report a
  // committed edit as a failed one — mapUpdateKlashError has no way to
  // tell "saved, couldn't confirm" apart from "rejected" once it's
  // reached as a mutation error either way.
  return await fetchKlashById(id)
}

/** Deletes a klash. Allowed for its own author while `new`, or for staff
 * (`klashes_delete_author_or_staff`); this app only ever calls it from
 * `/k/:id`'s role-gated action bar. Deleting the row cascades klash_photos,
 * confirmations, comments and status_changes in the database.
 *
 * The Storage objects have to be removed first, from here: they are not
 * reachable from SQL (Supabase rejects direct deletes on storage.objects),
 * so a trigger cannot do it. Their removal is best-effort — if it fails,
 * the klash is still deleted rather than becoming undeletable, leaving
 * unreferenced objects behind, which is the pre-existing known gap. */
export async function deleteKlash(id: string): Promise<void> {
  try {
    await removeKlashPhotoObjects(id)
  } catch {
    // Deliberately swallowed: see the docblock above.
  }

  const { error } = await supabase.from('klashes').delete().eq('id', id)
  if (error) throw error
}

/** Looks up a klash author's email, for `moderator`/`authority`/`admin` to
 * recontact them (spec §2 line 39) via the `get_klash_author_contact` RPC —
 * the email itself lives in `auth.users`, unreachable from the client
 * directly. Every call is journalised server-side (an
 * `author_contact_lookups` row), which is why this is never called eagerly
 * on page load: only from an explicit "voir l'email de l'auteur" action, so
 * opening a klash's page alone never logs a lookup. */
export async function getKlashAuthorContact(klashId: string): Promise<string> {
  const { data, error } = await supabase.rpc('get_klash_author_contact', { klash_id: klashId })
  if (error) throw error
  return data
}
