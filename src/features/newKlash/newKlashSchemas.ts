import { z } from 'zod'
import { klashCategorySchema, klashUrgencySchema } from '../../types/klash'

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
