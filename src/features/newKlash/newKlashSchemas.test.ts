import { describe, expect, it } from 'vitest'
import {
  emptyKlashFormDraft,
  klashFormDraftFromKlash,
  klashFormInputFromDraft,
  messageForKlashFormIssue,
  newKlashFormSchema,
} from './newKlashSchemas'
import { fr } from '../../i18n/fr'
import type { Klash } from '../../types/klash'

const baseKlash: Klash = {
  id: 'klash-1',
  authorId: 'author-1',
  lat: 43.49,
  lng: -1.47,
  category: 'category_2',
  categoryOther: null,
  importance: 'medium',
  status: 'new',
  title: 'Nid de poule dangereux',
  description: null,
  proposedSolution: null,
  duplicateOf: null,
  confirmationsCount: 0,
  commentsCount: 0,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  resolvedAt: null,
  authorDisplayName: "Quelqu'un",
  authorOrganization: null,
  authorRole: 'user',
}

describe('klashFormDraftFromKlash', () => {
  it('maps a klash with no optional fields to empty strings, not null', () => {
    expect(klashFormDraftFromKlash(baseKlash)).toEqual({
      category: 'category_2',
      categoryOther: '',
      importance: 'medium',
      title: 'Nid de poule dangereux',
      description: '',
      proposedSolution: '',
    })
  })

  it("keeps a category_7 klash's categoryOther precision", () => {
    const klash: Klash = {
      ...baseKlash,
      category: 'category_7',
      categoryOther: 'Trottoir bloqué par des poubelles',
    }
    expect(klashFormDraftFromKlash(klash).categoryOther).toBe('Trottoir bloqué par des poubelles')
  })

  it('carries description and proposedSolution through when present', () => {
    const klash: Klash = {
      ...baseKlash,
      description: 'Un grand trou au milieu de la piste.',
      proposedSolution: "Reboucher avant l'hiver.",
    }
    const draft = klashFormDraftFromKlash(klash)
    expect(draft.description).toBe('Un grand trou au milieu de la piste.')
    expect(draft.proposedSolution).toBe("Reboucher avant l'hiver.")
  })

  it('round-trips through newKlashFormSchema for a realistic klash', () => {
    // Proves the edit form can never open on a klash it would then refuse
    // to save: every field the database already accepted must still pass
    // validation once mapped back through the draft and normalised.
    const result = newKlashFormSchema.safeParse(
      klashFormInputFromDraft(klashFormDraftFromKlash(baseKlash)),
    )
    expect(result.success).toBe(true)
  })

  it('round-trips a category_7 klash, categoryOther included', () => {
    const klash: Klash = { ...baseKlash, category: 'category_7', categoryOther: 'Autre chose' }
    const result = newKlashFormSchema.safeParse(
      klashFormInputFromDraft(klashFormDraftFromKlash(klash)),
    )
    expect(result.success).toBe(true)
  })
})

describe('klashFormInputFromDraft', () => {
  // Backs the submit handlers and KlashFormStep's live "Continuer" gating —
  // both must agree on what counts as a valid draft.
  it('rejects the empty draft', () => {
    expect(newKlashFormSchema.safeParse(klashFormInputFromDraft(emptyKlashFormDraft)).success).toBe(
      false,
    )
  })

  it('accepts a category plus a 5-character title', () => {
    const draft = { ...emptyKlashFormDraft, category: 'category_2' as const, title: 'Trou!' }
    expect(newKlashFormSchema.safeParse(klashFormInputFromDraft(draft)).success).toBe(true)
  })

  it('rejects category_7 ("Autre") with no precision typed', () => {
    const draft = { ...emptyKlashFormDraft, category: 'category_7' as const, title: 'Trou dans le sol' }
    expect(newKlashFormSchema.safeParse(klashFormInputFromDraft(draft)).success).toBe(false)
  })

  it('accepts category_7 once a precision is typed', () => {
    const draft = {
      ...emptyKlashFormDraft,
      category: 'category_7' as const,
      categoryOther: 'Poteau mal placé',
      title: 'Trou dans le sol',
    }
    expect(newKlashFormSchema.safeParse(klashFormInputFromDraft(draft)).success).toBe(true)
  })

  it("doesn't count leading/trailing whitespace toward the title's minimum length", () => {
    const draft = { ...emptyKlashFormDraft, category: 'category_2' as const, title: '  Ab  ' }
    expect(newKlashFormSchema.safeParse(klashFormInputFromDraft(draft)).success).toBe(false)
  })
})

describe('emptyKlashFormDraft', () => {
  it('has no category preselected', () => {
    expect(emptyKlashFormDraft.category).toBe('')
  })
})

describe('messageForKlashFormIssue', () => {
  it('maps each known field to its own French message', () => {
    expect(messageForKlashFormIssue('category')).toBe(fr.newKlash.form.invalidCategory)
    expect(messageForKlashFormIssue('categoryOther')).toBe(fr.newKlash.form.invalidCategoryOther)
    expect(messageForKlashFormIssue('description')).toBe(fr.newKlash.form.invalidDescription)
    expect(messageForKlashFormIssue('proposedSolution')).toBe(
      fr.newKlash.form.invalidProposedSolution,
    )
  })

  it('falls back to the title message for title or an unknown field', () => {
    expect(messageForKlashFormIssue('title')).toBe(fr.newKlash.form.invalidTitle)
    expect(messageForKlashFormIssue(undefined)).toBe(fr.newKlash.form.invalidTitle)
  })
})
