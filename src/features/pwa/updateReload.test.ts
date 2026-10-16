import { KLASH_OVERLAY_STATE } from '../klash/klashOverlay'
import { isUpdateReloadPoint } from './updateReload'

describe('isUpdateReloadPoint', () => {
  it('reloads when the page changes', () => {
    expect(
      isUpdateReloadPoint({ pathname: '/', state: null }, { pathname: '/new', state: null }),
    ).toBe(true)
    expect(
      isUpdateReloadPoint({ pathname: '/new', state: null }, { pathname: '/', state: null }),
    ).toBe(true)
    expect(
      isUpdateReloadPoint({ pathname: '/', state: null }, { pathname: '/k/42', state: null }),
    ).toBe(true)
  })

  it('does not reload while staying on the same page', () => {
    expect(
      isUpdateReloadPoint({ pathname: '/', state: null }, { pathname: '/', state: null }),
    ).toBe(false)
  })

  it('does not reload when the klash modal opens or closes over the map', () => {
    expect(
      isUpdateReloadPoint(
        { pathname: '/', state: null },
        { pathname: '/k/42', state: KLASH_OVERLAY_STATE },
      ),
    ).toBe(false)
    expect(
      isUpdateReloadPoint(
        { pathname: '/k/42', state: KLASH_OVERLAY_STATE },
        { pathname: '/', state: null },
      ),
    ).toBe(false)
    expect(
      isUpdateReloadPoint(
        { pathname: '/k/42', state: KLASH_OVERLAY_STATE },
        { pathname: '/k/7', state: KLASH_OVERLAY_STATE },
      ),
    ).toBe(false)
  })
})
