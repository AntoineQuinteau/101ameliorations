import { z } from 'zod'
import {
  klashCategorySchema,
  klashUrgencySchema,
  type KlashCategory,
  type KlashUrgency,
} from '../../types/klash'

// Mirrors the DB CHECK constraints on klashes.title/description/proposed_solution.
export const klashTitleSchema = z.string().trim().min(5).max(120)
export const klashDescriptionSchema = z.string().trim().max(2000)
export const klashProposedSolutionSchema = z.string().trim().max(2000)
// Mirrors klashes_category_other_required_check: non-empty when category is
// 'category_7' ("Autre (préciser)"), absent otherwise.
export const klashCategoryOtherSchema = z.string().trim().min(1).max(120)

export const newKlashFormSchema = z
  .object({
    category: klashCategorySchema,
    categoryOther: klashCategoryOtherSchema.nullable(),
    urgency: klashUrgencySchema,
    title: klashTitleSchema,
    description: klashDescriptionSchema.nullable(),
    proposedSolution: klashProposedSolutionSchema.nullable(),
  })
  .refine((value) => (value.category === 'category_7') === (value.categoryOther !== null), {
    message: 'categoryOther is required for category_7 and forbidden otherwise',
    path: ['categoryOther'],
  })
export type NewKlashForm = z.infer<typeof newKlashFormSchema>

// The raw, not-yet-validated form fields as the user types them. Lives in
// NewKlashPage (not KlashFormStep's own state) so it survives the step being
// unmounted when a photo's EXIF GPS position sends the flow back through the
// duplicates step (spec §6.2 step 3) — see NewKlashPage's docblock.
//
// `category` is `KlashCategory | ''`, not defaulted to a real category: the
// picker is a required select with no pre-selected option (spec decision),
// and '' is what lets the <select> render with nothing chosen.
export interface KlashFormDraft {
  category: KlashCategory | ''
  categoryOther: string
  urgency: KlashUrgency
  title: string
  description: string
  proposedSolution: string
}

export const emptyKlashFormDraft: KlashFormDraft = {
  category: '',
  categoryOther: '',
  urgency: 'medium',
  title: '',
  description: '',
  proposedSolution: '',
}
