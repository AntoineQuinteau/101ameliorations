import { z } from 'zod'
import {
  klashCategorySchema,
  klashImportanceSchema,
  type Klash,
  type KlashCategory,
  type KlashImportance,
} from '../../types/klash'
import { fr } from '../../i18n/fr'

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
    importance: klashImportanceSchema,
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
  importance: KlashImportance
  title: string
  description: string
  proposedSolution: string
}

export const emptyKlashFormDraft: KlashFormDraft = {
  category: '',
  categoryOther: '',
  importance: 'medium',
  title: '',
  description: '',
  proposedSolution: '',
}

/** The edit form's starting draft: an existing klash's editable fields,
 * mapped back to the raw string shape the form's inputs work with
 * (`null` → `''`, mirroring how `handleSubmit` normalises the other way). */
export function klashFormDraftFromKlash(klash: Klash): KlashFormDraft {
  return {
    category: klash.category,
    categoryOther: klash.categoryOther ?? '',
    importance: klash.importance,
    title: klash.title,
    description: klash.description ?? '',
    proposedSolution: klash.proposedSolution ?? '',
  }
}

/** Maps a failed `newKlashFormSchema` validation to the French message for
 * its first issue's field — shared by KlashFormStep (creation) and
 * EditKlashForm (edit) so the two forms report the same errors the same
 * way. */
export function messageForKlashFormIssue(field: PropertyKey | undefined): string {
  switch (field) {
    case 'category':
      return fr.newKlash.form.invalidCategory
    case 'categoryOther':
      return fr.newKlash.form.invalidCategoryOther
    case 'description':
      return fr.newKlash.form.invalidDescription
    case 'proposedSolution':
      return fr.newKlash.form.invalidProposedSolution
    default:
      return fr.newKlash.form.invalidTitle
  }
}
