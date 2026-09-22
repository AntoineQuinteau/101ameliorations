import { useEffect, useRef } from 'react'
import { saveDraftPhotos } from './draftPhotoStore'
import {
  clearStoredDraft,
  isDraftWorthKeeping,
  writeStoredDraft,
  type DraftStep,
} from './draftStorage'
import type { KlashFormDraft } from './newKlashSchemas'
import type { PendingPhoto } from './KlashFormStep'

// Debounces localStorage writes while the user is actively typing — nothing
// visible depends on the save landing faster than this, and a klash report
// is a short-lived interaction, not a document where every keystroke needs
// to survive a crash mid-word.
const SAVE_DEBOUNCE_MS = 500

/** Auto-saves the in-progress report (position, form fields, photos) so it
 * survives an accidental navigation, tab close or reload — see
 * `docs/plans/ameliorations-3-brouillon.md`. Lives in `NewKlashPage`
 * alongside the state it watches, the same way the draft state itself does
 * (see that component's docblock): it needs the full picture across steps,
 * not just what one step renders.
 *
 * `enabled` is false once the flow has moved past 'form' (submitting or
 * done) — from that point the draft either becomes a real klash (and is
 * cleared explicitly by the caller) or stays whatever was last saved before
 * submit, which is exactly what a failed submit should restore. */
export function useDraftAutosave({
  enabled,
  lat,
  lng,
  step,
  form,
  photos,
}: {
  enabled: boolean
  lat: number
  lng: number
  step: DraftStep
  form: KlashFormDraft
  photos: PendingPhoto[]
}): void {
  // Only re-runs the (comparatively expensive) IndexedDB write when the set
  // of photo ids actually changes — typing in the description shouldn't
  // re-serialize several megabytes of compressed photos on every keystroke.
  const savedPhotoIdsRef = useRef<string>('')

  useEffect(() => {
    if (!enabled) return
    const timeoutId = window.setTimeout(() => {
      if (!isDraftWorthKeeping(form, photos.length)) {
        clearStoredDraft()
        savedPhotoIdsRef.current = ''
        return
      }
      writeStoredDraft({
        version: 1,
        savedAt: new Date().toISOString(),
        lat,
        lng,
        step,
        form,
        photos: photos.map((photo) => ({
          id: photo.id,
          width: photo.compressed.width,
          height: photo.compressed.height,
          gps: photo.gps,
        })),
      })

      const photoIdsKey = photos.map((photo) => photo.id).join(',')
      if (photoIdsKey !== savedPhotoIdsRef.current) {
        savedPhotoIdsRef.current = photoIdsKey
        void saveDraftPhotos(photos.map((photo) => ({ id: photo.id, file: photo.compressed.file })))
      }
    }, SAVE_DEBOUNCE_MS)
    return () => window.clearTimeout(timeoutId)
  }, [enabled, lat, lng, step, form, photos])
}
