import { env } from '../env'

// Visit measurement with Umami Cloud: cookieless, no cross-site tracking, no
// personal data (docs/campaign-tracking.md). Entirely optional: without
// VITE_UMAMI_WEBSITE_ID nothing is loaded. Campaign redirection and attribution
// do not depend on it.

const SCRIPT_URL = 'https://cloud.umami.is/script.js'

interface UmamiPayload {
  [key: string]: unknown
}
interface Umami {
  track: (payload: (props: UmamiPayload) => UmamiPayload) => void
}
declare global {
  interface Window {
    umami?: Umami
  }
}

const pending: Array<{ url: string; referrer: string }> = []
let started = false

function flush(): void {
  const umami = window.umami
  if (!umami) return
  for (const { url, referrer } of pending.splice(0)) {
    umami.track((props) => ({ ...props, url, referrer }))
  }
}

/** Loads the tracker once (auto-tracking off: pageviews are sent explicitly,
 * since this is a single-page app whose arrival URL is cleaned before React
 * starts). Honors the browser's Do Not Track setting. */
export function initAnalytics(): void {
  const websiteId = env.VITE_UMAMI_WEBSITE_ID
  if (started || !websiteId || !import.meta.env.PROD) return
  started = true
  const script = document.createElement('script')
  script.src = SCRIPT_URL
  script.defer = true
  script.dataset.websiteId = websiteId
  script.dataset.autoTrack = 'false'
  script.dataset.doNotTrack = 'true'
  script.addEventListener('load', flush)
  document.head.append(script)
}

export function trackPageview(url: string, referrer = ''): void {
  if (!started) return
  pending.push({ url, referrer })
  flush()
}
