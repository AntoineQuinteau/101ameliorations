import { z } from 'zod'

export const klashPhotoSchema = z.object({
  id: z.string(),
  klashId: z.string(),
  authorId: z.string(),
  storagePath: z.string(),
  width: z.number().nullable(),
  height: z.number().nullable(),
  createdAt: z.string(),
})
export type KlashPhoto = z.infer<typeof klashPhotoSchema>

// Raw shape returned by Supabase (snake_case). klash_photos is a plain
// table, not a view, so unlike klashes_public these columns are only
// nullable where the schema actually allows it (width/height).
const klashPhotoRowSchema = z.object({
  id: z.string(),
  klash_id: z.string(),
  author_id: z.string(),
  storage_path: z.string(),
  width: z.number().nullable(),
  height: z.number().nullable(),
  created_at: z.string(),
})

/** Validates and maps one raw `klash_photos` row into the app's `KlashPhoto` shape. */
export function klashPhotoFromRow(row: unknown): KlashPhoto {
  const parsed = klashPhotoRowSchema.parse(row)
  return {
    id: parsed.id,
    klashId: parsed.klash_id,
    authorId: parsed.author_id,
    storagePath: parsed.storage_path,
    width: parsed.width,
    height: parsed.height,
    createdAt: parsed.created_at,
  }
}
