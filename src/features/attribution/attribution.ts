import { z } from 'zod'

// Campaign attribution (docs/campaign-tracking.md). Pure logic only: reading
// the URL, storage and history live in captureOnLoad.ts / attributionStorage.ts
// so everything here is unit-testable.

/** Same rule as public.is_campaign_token() in the database: lowercase ASCII
 * words joined by single hyphens, 64 characters at most. The server re-checks
 * everything; this only keeps junk out of the browser's storage. */
export const CAMPAIGN_TOKEN_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/
const MAX_TOKEN_LENGTH = 64

/** Closed list, mirrors the `campaign_medium` enum. */
export const campaignMediumSchema = z.enum(['social', 'email', 'print', 'press'])

function isToken(value: string): boolean {
  return value.length <= MAX_TOKEN_LENGTH && CAMPAIGN_TOKEN_PATTERN.test(value)
}

const tokenSchema = z.string().refine(isToken)

/** One arrival. A campaign touch has `source` + `medium` (+ `campaign`,
 * `content`); a referrer-only touch (no utm, external referrer) has them all
 * null and only `referrerHost`. */
export const touchSchema = z.object({
  source: tokenSchema.nullable(),
  medium: campaignMediumSchema.nullable(),
  campaign: tokenSchema.nullable(),
  content: tokenSchema.nullable(),
  /** Hostname only, never a full URL. */
  referrerHost: z.string().max(253).nullable(),
  landingPath: z.string().max(200),
  at: z.string().max(40),
})
export type Touch = z.infer<typeof touchSchema>

export const attributionSchema = z.object({
  firstSeenAt: z.string().max(40),
  firstTouch: touchSchema.nullable(),
  lastTouch: touchSchema.nullable(),
})
export type Attribution = z.infer<typeof attributionSchema>

export interface Arrival {
  /** `location.search` of the landing URL. */
  search: string
  /** `location.pathname`. */
  pathname: string
  /** `document.referrer` (may be empty). */
  referrer: string
  /** `location.hostname`, to recognise internal referrers. */
  hostname: string
  now: Date
}

const UTM_PARAMS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content'] as const
/** Removed from the address bar after capture. `launch` is the PWA marker. */
const CLEANED_PARAMS = [...UTM_PARAMS, 'utm_term', 'launch'] as const

function optionalToken(value: string | null): string | null {
  return value !== null && isToken(value) ? value : null
}

function externalReferrerHost(referrer: string, ownHostname: string): string | null {
  if (!referrer) return null
  try {
    const { protocol, hostname } = new URL(referrer)
    if (protocol !== 'http:' && protocol !== 'https:') return null
    return hostname === ownHostname || hostname.length > 253 ? null : hostname
  } catch {
    return null
  }
}

/** The campaign touch carried by the URL, or `null` when it has no usable
 * utm_source + utm_medium (an unknown medium or a malformed source is dropped
 * rather than stored). */
function campaignTouch(params: URLSearchParams, arrival: Arrival): Touch | null {
  const source = optionalToken(params.get('utm_source'))
  const medium = campaignMediumSchema.safeParse(params.get('utm_medium'))
  if (!source || !medium.success) return null
  return {
    source,
    medium: medium.data,
    campaign: optionalToken(params.get('utm_campaign')),
    content: optionalToken(params.get('utm_content')),
    referrerHost: externalReferrerHost(arrival.referrer, arrival.hostname),
    landingPath: arrival.pathname.slice(0, 200),
    at: arrival.now.toISOString(),
  }
}

/** The attribution rule, in one place:
 * - `launch=pwa` never touches first/last touch (an installed app launching
 *   is not an acquisition channel); it only guarantees `firstSeenAt`.
 * - A campaign arrival writes `firstTouch` once (never overwritten) and
 *   replaces `lastTouch` every time.
 * - No campaign but an external referrer (e.g. a press article publishing the
 *   bare address) fills whichever touch is still empty, and never replaces
 *   one that exists. */
export function applyArrival(previous: Attribution | null, arrival: Arrival): Attribution {
  const params = new URLSearchParams(arrival.search)
  const state: Attribution = previous ?? {
    firstSeenAt: arrival.now.toISOString(),
    firstTouch: null,
    lastTouch: null,
  }

  if (params.get('launch') === 'pwa') return state

  const campaign = campaignTouch(params, arrival)
  if (campaign) {
    return { ...state, firstTouch: state.firstTouch ?? campaign, lastTouch: campaign }
  }

  const referrerHost = externalReferrerHost(arrival.referrer, arrival.hostname)
  if (referrerHost && (!state.firstTouch || !state.lastTouch)) {
    const touch: Touch = {
      source: null,
      medium: null,
      campaign: null,
      content: null,
      referrerHost,
      landingPath: arrival.pathname.slice(0, 200),
      at: arrival.now.toISOString(),
    }
    return {
      ...state,
      firstTouch: state.firstTouch ?? touch,
      lastTouch: state.lastTouch ?? touch,
    }
  }

  return state
}

/** `search` with utm_* and launch removed (every other parameter, e.g. the
 * map filters, is kept), or `null` when there was nothing to remove. */
export function cleanedSearch(search: string): string | null {
  const params = new URLSearchParams(search)
  let changed = false
  for (const key of CLEANED_PARAMS) {
    if (params.has(key)) {
      params.delete(key)
      changed = true
    }
  }
  if (!changed) return null
  const next = params.toString()
  return next ? `?${next}` : ''
}

/** What the server receives at sign-up (snake_case, the fields its
 * sanitizer reads). The server validates again: none of this is trusted. */
export function attributionPayload(state: Attribution) {
  const touch = (t: Touch | null) =>
    t && {
      source: t.source,
      medium: t.medium,
      campaign: t.campaign,
      content: t.content,
      referrer_host: t.referrerHost,
    }
  return {
    first_seen_at: state.firstSeenAt,
    first_touch: touch(state.firstTouch),
    last_touch: touch(state.lastTouch),
  }
}
