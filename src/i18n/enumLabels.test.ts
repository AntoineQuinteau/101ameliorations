import { describe, expect, it } from 'vitest'
import { Constants } from '../types/database'
import { fr } from './fr'

// Every value of a database enum needs a French label, and a label for a
// value that no longer exists is dead text: the keys must match exactly.
const labelled = {
  klash_category: fr.category,
  klash_importance: fr.importance,
  klash_status: fr.status,
  user_role: fr.role,
  campaign_medium: fr.campaigns.medium,
} as const

describe('enum labels in fr.ts', () => {
  it.each(Object.entries(labelled))('%s has exactly one label per value', (name, labels) => {
    const values = Constants.public.Enums[name as keyof typeof labelled]
    expect(Object.keys(labels).sort()).toEqual([...values].sort())
  })
})
