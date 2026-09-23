import { useEffect, useRef } from 'react'
import { clearDraftPhotos, saveDraftPhotos } from './draftPhotoStore'
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

interface DraftAutosaveParams {
  enabled: boolean
  lat: number
  lng: number
  step: DraftStep
  form: KlashFormDraft
  photos: PendingPhoto[]
}

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
 * submit, which is exactly what a failed submit should restore.
 *
 * Returns `suppressPendingSave`: a caller that's intentionally ending the
 * draft's life (discarding it, or a successful submit) must call it right
 * before clearing storage — otherwise the unmount that follows (navigating
 * away) would flush the still-current form state right back into storage,
 * resurrecting what was just cleared. */
export function useDraftAutosave({ enabled, lat, lng, step, form, photos }: DraftAutosaveParams): {
  suppressPendingSave: () => void
} {
  // Only re-runs the (comparatively expensive) IndexedDB write when the set
  // of photo ids actually changes — typing in the description shouldn't
  // re-serialize the compressed photos on every keystroke.
  const savedPhotoIdsRef = useRef<string>('')
  // Always the latest params, independent of the debounce timer below — so
  // flush() (called from pagehide/visibilitychange/unmount) writes what the
  // user actually last saw, not whatever the most recently *fired* debounce
  // happened to capture.
  const latestRef = useRef<DraftAutosaveParams>({ enabled, lat, lng, step, form, photos })
  latestRef.current = { enabled, lat, lng, step, form, photos }
  // One-way: once a caller has decided the draft's life is over (discarded,
  // or turned into a real klash), nothing should write it back.
  const suppressedRef = useRef(false)

  function flush() {
    if (suppressedRef.current) return
    const { enabled, lat, lng, step, form, photos } = latestRef.current
    if (!enabled) return
    if (!isDraftWorthKeeping(form, photos.length)) {
      clearStoredDraft()
      void clearDraftPhotos()
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
  }

  useEffect(() => {
    if (!enabled) return
    const timeoutId = window.setTimeout(flush, SAVE_DEBOUNCE_MS)
    return () => window.clearTimeout(timeoutId)
  }, [enabled, lat, lng, step, form, photos])

  // Mount-once: flushes the latest pending state on the events that would
  // otherwise silently drop it — the exact scenarios ("back navigation, a
  // tap elsewhere, an accidental close") this hook exists to survive. The
  // debounce effect above only clears its timer on unmount; nothing else
  // was making sure that last, not-yet-fired save actually landed.
  useEffect(() => {
    function handlePageHide() {
      flush()
    }
    function handleVisibilityChange() {
      if (document.visibilityState === 'hidden') flush()
    }
    window.addEventListener('pagehide', handlePageHide)
    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => {
      window.removeEventListener('pagehide', handlePageHide)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      flush()
    }
  }, [])

  return {
    suppressPendingSave: () => {
      suppressedRef.current = true
    },
  }
}
