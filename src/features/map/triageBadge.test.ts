import { describe, expect, it } from 'vitest'
import { triageBadgeText } from './triageBadge'

describe('triageBadgeText', () => {
  it('hides the badge when nothing is waiting', () => {
    expect(triageBadgeText(0)).toBeNull()
  })

  it('shows the exact count up to 9', () => {
    expect(triageBadgeText(1)).toBe('1')
    expect(triageBadgeText(9)).toBe('9')
  })

  it('caps the count at "9+"', () => {
    expect(triageBadgeText(10)).toBe('9+')
    expect(triageBadgeText(240)).toBe('9+')
  })
})
