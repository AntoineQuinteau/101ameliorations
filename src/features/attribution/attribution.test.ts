import { describe, expect, it } from 'vitest'
import { applyArrival, attributionPayload, cleanedSearch, type Arrival } from './attribution'

const T1 = new Date('2026-10-10T08:00:00Z')
const T2 = new Date('2026-10-12T08:00:00Z')

function arrival(search: string, overrides: Partial<Arrival> = {}): Arrival {
  return {
    search,
    pathname: '/',
    referrer: '',
    hostname: '101ameliorations.org',
    now: T1,
    ...overrides,
  }
}

const CPAM =
  '?utm_source=cpam&utm_medium=print&utm_campaign=lancement-2026-10&utm_content=papillon-velo'
const TXDO =
  '?utm_source=txdo&utm_medium=social&utm_campaign=lancement-2026-10&utm_content=facebook'

describe('applyArrival', () => {
  it('writes first and last touch on the first campaign arrival', () => {
    const state = applyArrival(null, arrival(CPAM))
    expect(state.firstSeenAt).toBe(T1.toISOString())
    expect(state.firstTouch).toMatchObject({
      source: 'cpam',
      medium: 'print',
      campaign: 'lancement-2026-10',
      content: 'papillon-velo',
      landingPath: '/',
      at: T1.toISOString(),
    })
    expect(state.lastTouch).toEqual(state.firstTouch)
  })

  it('never overwrites first touch but updates last touch', () => {
    const first = applyArrival(null, arrival(CPAM))
    const second = applyArrival(first, arrival(TXDO, { now: T2 }))
    expect(second.firstTouch?.source).toBe('cpam')
    expect(second.lastTouch?.source).toBe('txdo')
    expect(second.lastTouch?.at).toBe(T2.toISOString())
    expect(second.firstSeenAt).toBe(T1.toISOString())
  })

  it('keeps the external referrer host (not the URL) on a campaign touch', () => {
    const state = applyArrival(
      null,
      arrival(CPAM, { referrer: 'https://www.facebook.com/some/post?x=1' }),
    )
    expect(state.firstTouch?.referrerHost).toBe('www.facebook.com')
  })

  it('records a referrer-only touch when there is no utm', () => {
    const state = applyArrival(
      null,
      arrival('', { referrer: 'https://www.sudouest.fr/article-velo' }),
    )
    expect(state.firstTouch).toMatchObject({ source: null, referrerHost: 'www.sudouest.fr' })
    expect(state.lastTouch).toEqual(state.firstTouch)
  })

  it('ignores internal and non-http referrers', () => {
    expect(
      applyArrival(null, arrival('', { referrer: 'https://101ameliorations.org/k/1' })).firstTouch,
    ).toBeNull()
    expect(
      applyArrival(null, arrival('', { referrer: 'android-app://com.x' })).firstTouch,
    ).toBeNull()
  })

  it('a referrer-only arrival never replaces an existing touch', () => {
    const campaign = applyArrival(null, arrival(CPAM))
    const state = applyArrival(
      campaign,
      arrival('', { referrer: 'https://www.sudouest.fr/', now: T2 }),
    )
    expect(state).toEqual(campaign)
  })

  it('a campaign arrival after a referrer-only one updates last but not first', () => {
    const referral = applyArrival(null, arrival('', { referrer: 'https://www.sudouest.fr/' }))
    const state = applyArrival(referral, arrival(CPAM, { now: T2 }))
    expect(state.firstTouch?.source).toBeNull()
    expect(state.lastTouch?.source).toBe('cpam')
  })

  it('launch=pwa never modifies attribution', () => {
    const before = applyArrival(null, arrival(CPAM))
    const after = applyArrival(
      before,
      arrival(`?launch=pwa&utm_source=txdo&utm_medium=social`, {
        referrer: 'https://www.facebook.com/',
        now: T2,
      }),
    )
    expect(after).toEqual(before)
  })

  it('launch=pwa on empty storage only sets firstSeenAt', () => {
    expect(applyArrival(null, arrival('?launch=pwa'))).toEqual({
      firstSeenAt: T1.toISOString(),
      firstTouch: null,
      lastTouch: null,
    })
  })

  it('drops values outside the convention', () => {
    const bad = applyArrival(null, arrival('?utm_source=CPAM&utm_medium=print'))
    expect(bad.firstTouch).toBeNull()
    const badMedium = applyArrival(null, arrival('?utm_source=cpam&utm_medium=banner'))
    expect(badMedium.firstTouch).toBeNull()
    const partial = applyArrival(
      null,
      arrival('?utm_source=cpam&utm_medium=print&utm_campaign=Not%20OK&utm_content=a--b'),
    )
    expect(partial.firstTouch).toMatchObject({ source: 'cpam', campaign: null, content: null })
  })

  it('sets firstSeenAt once, on a visit without any attribution', () => {
    const first = applyArrival(null, arrival(''))
    expect(first.firstTouch).toBeNull()
    expect(applyArrival(first, arrival('', { now: T2 })).firstSeenAt).toBe(T1.toISOString())
  })
})

describe('cleanedSearch', () => {
  it('removes utm_* and launch and keeps the other parameters', () => {
    expect(cleanedSearch(`${CPAM}&launch=pwa&status=new`)).toBe('?status=new')
  })
  it('returns an empty string when nothing else remains', () => {
    expect(cleanedSearch(CPAM)).toBe('')
  })
  it('returns null when there is nothing to clean', () => {
    expect(cleanedSearch('?status=new')).toBeNull()
    expect(cleanedSearch('')).toBeNull()
  })
})

describe('attributionPayload', () => {
  it('sends only the fields the server reads', () => {
    const payload = attributionPayload(applyArrival(null, arrival(CPAM)))
    expect(payload.first_touch).toEqual({
      source: 'cpam',
      medium: 'print',
      campaign: 'lancement-2026-10',
      content: 'papillon-velo',
      referrer_host: null,
    })
    expect(payload.first_seen_at).toBe(T1.toISOString())
  })
})
