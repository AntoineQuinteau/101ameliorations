import { describe, expect, it } from 'vitest'
import { CATEGORY_DISPLAY_ORDER, CATEGORY_OTHER } from './klash'
import { Constants } from './database'

describe('CATEGORY_DISPLAY_ORDER', () => {
  it('lists every klash_category value exactly once', () => {
    expect([...CATEGORY_DISPLAY_ORDER].sort()).toEqual(
      [...Constants.public.Enums.klash_category].sort(),
    )
  })

  it('keeps the "Autre" category last', () => {
    expect(CATEGORY_DISPLAY_ORDER.at(-1)).toBe(CATEGORY_OTHER)
  })
})
