import { useMutation, useQueryClient } from '@tanstack/react-query'
import { deleteKlashPhoto, uploadKlashPhoto } from '../../api/klashPhotos'
import { klashKeys } from '../../api/queryKeys'
import type { KlashPhoto } from '../../types/klashPhoto'
import { mapWithConcurrency } from '../../utils/mapWithConcurrency'
import type { CompressedPhoto } from '../../utils/photoCompression'
import { useAuth } from '../auth/useAuth'

// Same reasoning and value as KlashFormStep's PHOTO_CONCURRENCY / NewKlashPage's
// PHOTO_UPLOAD_CONCURRENCY: bounded so several uploads don't all race the network at once.
const PHOTO_UPLOAD_CONCURRENCY = 4

/** Adds photos to an existing klash from the edit form (spec §6.3
 * "Modifier"), immediately — not staged behind the form's save button (see
 * EditKlashForm's docblock for why). A failed upload doesn't fail the
 * others: each is caught individually and the settled count is returned,
 * same pattern as NewKlashPage's photo upload step. */
export function useAddKlashPhotos(klashId: string) {
  const { user } = useAuth()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (photos: CompressedPhoto[]): Promise<{ failedCount: number }> => {
      if (!user) throw new Error('Cannot add photos while signed out')
      const results = await mapWithConcurrency(photos, PHOTO_UPLOAD_CONCURRENCY, async (photo) => {
        try {
          await uploadKlashPhoto(klashId, user.id, photo)
          return { status: 'fulfilled' } as const
        } catch {
          return { status: 'rejected' } as const
        }
      })
      return { failedCount: results.filter((result) => result.status === 'rejected').length }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: klashKeys.photos(klashId) })
    },
  })
}

/** Deletes one photo from the edit form (spec §6.3 "Modifier"): the
 * klash's own author, the photo's own author, or staff. Immediate, like
 * useAddKlashPhotos — see EditKlashForm's docblock. */
export function useDeleteKlashPhoto(klashId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (photo: Pick<KlashPhoto, 'id' | 'storagePath'>) => deleteKlashPhoto(photo),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: klashKeys.photos(klashId) })
    },
  })
}
