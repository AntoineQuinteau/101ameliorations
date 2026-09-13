import { z } from 'zod'
import {
  klashCategorySchema,
  klashUrgencySchema,
  type KlashCategory,
  type KlashUrgency,
} from '../../types/klash'

// Mirrors the DB CHECK constraints on klashes.title/description.
export const klashTitleSchema = z.string().trim().min(5).max(120)
export const klashDescriptionSchema = z.string().trim().max(2000)

export const newKlashFormSchema = z.object({
  category: klashCategorySchema,
  urgency: klashUrgencySchema,
  title: klashTitleSchema,
  description: klashDescriptionSchema.nullable(),
})
export type NewKlashForm = z.infer<typeof newKlashFormSchema>

// The raw, not-yet-validated form fields as the user types them. Lives in
// NewKlashPage (not KlashFormStep's own state) so it survives the step being
// unmounted when a photo's EXIF GPS position sends the flow back through the
// duplicates step (spec §6.2 step 3) — see NewKlashPage's docblock.
export interface KlashFormDraft {
  category: KlashCategory
  urgency: KlashUrgency
  title: string
  description: string
}

export const emptyKlashFormDraft: KlashFormDraft = {
  category: 'category_1',
  urgency: 'medium',
  title: '',
  description: '',
}
