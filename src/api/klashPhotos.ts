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
