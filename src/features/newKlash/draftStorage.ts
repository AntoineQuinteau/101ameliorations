import { z } from 'zod'
import type { KlashFormDraft } from './newKlashSchemas'
import { klashCategorySchema, klashUrgencySchema } from '../../types/klash'

const STORAGE_KEY = 'klash-draft'
const DRAFT_VERSION = 1
// A stale draft (phone forgotten for weeks) is more likely to point at a
// position/category the user no longer remembers than to be worth
// resurrecting — silently expiring it is safer than surfacing something
// that confuses more than it helps.
const DRAFT_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000

export type DraftStep = 'position' | 'duplicates' | 'form'

export interface StoredDraftPhoto {
  id: string
  width: number
  height: number
  gps: { lat: number; lng: number } | null
}

export interface StoredKlashDraft {
  version: typeof DRAFT_VERSION
  savedAt: string
  lat: number
  lng: number
  step: DraftStep
  form: KlashFormDraft
  photos: StoredDraftPhoto[]
}

// Deliberately laxer than newKlashSchemas' validated schemas: a draft is by
// definition incomplete (that's the whole point of saving it before
// submit), so it must accept an empty title, a missing category, etc. — it
// only needs to reject a corrupted or foreign shape, not an incomplete one.
const draftGpsSchema = z.object({ lat: z.number(), lng: z.number() }).nullable()

const draftPhotoSchema = z.object({
  id: z.string(),
  width: z.number(),
  height: z.number(),
  gps: draftGpsSchema,
})

const draftFormSchema: z.ZodType<KlashFormDraft> = z.object({
  category: klashCategorySchema.or(z.literal('')),
  categoryOther: z.string(),
  urgency: klashUrgencySchema,
  title: z.string(),
  description: z.string(),
  proposedSolution: z.string(),
})

const storedDraftSchema = z.object({
  version: z.literal(DRAFT_VERSION),
  savedAt: z.string(),
  lat: z.number(),
  lng: z.number(),
  step: z.enum(['position', 'duplicates', 'form']),
  form: draftFormSchema,
  photos: z.array(draftPhotoSchema),
})

/** Reads the saved draft, if any — `null` on a missing, corrupted, wrong-version
 * or expired one (purging it in the last three cases), and on any
 * `localStorage` read failure (thrown in Safari private browsing, where
 * nothing was actually stored to purge). Takes `now` as a parameter so age
 * expiry is testable without mocking the clock.
 *
 * The read and the JSON.parse are in separate try/catch blocks on purpose:
 * a read failure means there is nothing to clear, but corrupted JSON is
 * still sitting in localStorage and must be purged the same as a
 * schema-invalid or expired draft — otherwise it would keep failing to
 * parse (and keep reporting "no draft") forever instead of self-healing. */
export function readStoredDraft(now: number = Date.now()): StoredKlashDraft | null {
  let raw: string | null
  try {
    raw = localStorage.getItem(STORAGE_KEY)
  } catch {
    return null
  }
  if (!raw) return null

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    clearStoredDraft()
    return null
  }

  const result = storedDraftSchema.safeParse(parsed)
  if (!result.success) {
    clearStoredDraft()
    return null
  }
  const draft = result.data
  const age = now - new Date(draft.savedAt).getTime()
  if (!Number.isFinite(age) || age > DRAFT_MAX_AGE_MS) {
    clearStoredDraft()
    return null
  }
  return draft
}

export function writeStoredDraft(draft: StoredKlashDraft): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(draft))
  } catch {
    // Safari private browsing throws on write, and a quota can be exceeded
    // by a run of large photos — losing the draft is a degraded experience,
    // not a broken one, so this stays silent like writeStoredMapLayer.
  }
}

export function clearStoredDraft(): void {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    // Same reasoning as writeStoredDraft.
  }
}

/** Cheap synchronous check for the map's "déclaration en cours" chip — avoids
 * parsing the whole draft just to know whether to render it. Still runs the
 * full `readStoredDraft` so an expired/corrupted draft doesn't light up the
 * chip for something that won't actually restore. */
export function hasStoredDraft(now: number = Date.now()): boolean {
  return readStoredDraft(now) !== null
}

/** Whether a draft is worth persisting at all — an empty form at the default
 * urgency and no photos is what `/new` looks like on first render, not
 * something the user typed; saving it would make the chip appear on every
 * visit to the report flow. `category`/`urgency` alone don't count either:
 * `urgency` always has a value (defaults to 'medium') and picking a category
 * with nothing else filled in isn't yet a report worth resurrecting. */
export function isDraftWorthKeeping(form: KlashFormDraft, photoCount: number): boolean {
  if (photoCount > 0) return true
  return (
    form.title.trim() !== '' ||
    form.description.trim() !== '' ||
    form.proposedSolution.trim() !== '' ||
    form.categoryOther.trim() !== '' ||
    form.category !== ''
  )
}
