import { supabase } from '../lib/supabase'
import { klashPhotoFromRow, type KlashPhoto } from '../types/klashPhoto'
import type { CompressedPhoto } from '../utils/photoCompression'

// The only place the bucket name is spelled out — every other file works
// with a klash_photos.storage_path that's already relative to this bucket.
const PHOTOS_BUCKET = 'klash-photos'

/** Photos for a klash, oldest first (upload order), for the detail page
 * gallery (spec §6.3). */
export async function fetchKlashPhotos(klashId: string): Promise<KlashPhoto[]> {
  const { data, error } = await supabase
    .from('klash_photos')
    .select('*')
    .eq('klash_id', klashId)
    .order('created_at', { ascending: true })
  if (error) throw error
  return data.map(klashPhotoFromRow)
}

/** Public URL for a stored photo. `storagePath` is relative to the
 * klash-photos bucket (e.g. `{klash_id}/{uuid}.jpg`), never prefixed with
 * the bucket name itself. */
export function klashPhotoPublicUrl(storagePath: string): string {
  const {
    data: { publicUrl },
  } = supabase.storage.from(PHOTOS_BUCKET).getPublicUrl(storagePath)
  return publicUrl
}

/** Uploads one already-compressed photo to Storage and records it in
 * `klash_photos` (spec §6.2 step 4: insert klash, then upload photos, then
 * insert klash_photos rows). If the row insert fails after a successful
 * upload, the orphaned object is removed so a failed photo doesn't silently
 * leave unreferenced storage behind. */
export async function uploadKlashPhoto(
  klashId: string,
  authorId: string,
  photo: CompressedPhoto,
): Promise<KlashPhoto> {
  const storagePath = `${klashId}/${crypto.randomUUID()}.jpg`

  const { error: uploadError } = await supabase.storage
    .from(PHOTOS_BUCKET)
    .upload(storagePath, photo.file, { contentType: photo.file.type || 'image/jpeg' })
  if (uploadError) throw uploadError

  const { data, error: insertError } = await supabase
    .from('klash_photos')
    .insert({
      klash_id: klashId,
      author_id: authorId,
      storage_path: storagePath,
      width: photo.width,
      height: photo.height,
    })
    .select('*')
    .single()

  if (insertError) {
    await supabase.storage.from(PHOTOS_BUCKET).remove([storagePath])
    throw insertError
  }

  return klashPhotoFromRow(data)
}

/** Deletes one photo from the edit form (spec §6.3 "Modifier"): the klash's
 * own author, the photo's own author, or staff (klash_photos_delete_author_
 * or_staff — supabase/migrations/20260922090000_klash_edit_photos.sql).
 *
 * Row first, object second — the opposite order from
 * removeKlashPhotoObjects, and deliberately so: that function must read
 * every path before deleteKlash's cascade destroys the rows, but here the
 * path is already in hand. The failure modes are also asymmetric: a row
 * that outlives its object renders a broken <img> in KlashPhotoGallery,
 * while an object that outlives its (now-deleted) row is simply invisible
 * — so the row delete is the one that must be verified, the object removal
 * stays best-effort like removeKlashPhotoObjects.
 *
 * RLS makes a forbidden delete a silent 0-row no-op rather than an error;
 * the length check below is what turns that into a reported failure. */
export async function deleteKlashPhoto(
  photo: Pick<KlashPhoto, 'id' | 'storagePath'>,
): Promise<void> {
  const { data, error } = await supabase
    .from('klash_photos')
    .delete()
    .eq('id', photo.id)
    .select('id')
  if (error) throw error
  if (data.length === 0) throw new Error('photo delete not permitted')

  // Best-effort, same reasoning as removeKlashPhotoObjects: the row is
  // already gone, so a failure here leaves an orphaned object that's
  // unreferenced, not user-visible — not worth failing the delete over.
  await supabase.storage.from(PHOTOS_BUCKET).remove([photo.storagePath])
}

/** Removes every Storage object belonging to a klash, for use just before
 * deleting the klash itself (deleting the row cascades its `klash_photos`
 * rows, but Storage objects are not reachable from SQL: Supabase guards
 * `storage.objects` with a trigger that rejects direct deletes and demands
 * the Storage API — see
 * supabase/migrations/20260916001117_drop_klash_photo_objects_trigger.sql).
 *
 * Best-effort by design: a failure here is reported to the caller, which
 * deletes the klash anyway rather than leaving a klash nobody can remove
 * because its photos are stuck. Leftover objects are unreferenced, not
 * user-visible. */
export async function removeKlashPhotoObjects(klashId: string): Promise<void> {
  const photos = await fetchKlashPhotos(klashId)
  if (photos.length === 0) return

  const { error } = await supabase.storage
    .from(PHOTOS_BUCKET)
    .remove(photos.map((photo) => photo.storagePath))
  if (error) throw error
}
