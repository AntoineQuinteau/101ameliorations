import { describe, expect, it } from 'vitest'
import { isKlashOverlayState, KLASH_OVERLAY_STATE } from './klashOverlay'

describe('isKlashOverlayState', () => {
  it('accepts the overlay state', () => {
    expect(isKlashOverlayState(KLASH_OVERLAY_STATE)).toBe(true)
  })

  it.each([null, undefined, {}, { klashOverlay: false }, 'klashOverlay'])('rejects %j', (state) => {
    expect(isKlashOverlayState(state)).toBe(false)
  })
})
