import { isIosDevice, isRunningStandalone } from '../pwa/platform'
import { launchParams, type Attribution } from './attribution'

const IOS_MANIFEST_PATH = '/ios-manifest.webmanifest'

/** On iOS Safari only, points <link rel="manifest"> at the Worker-generated
 * manifest whose start_url embeds the current attribution, so "Add to Home
 * Screen" carries it into the installed app's separate storage. Everywhere
 * else the static manifest is left alone. */
export function syncIosManifest(attribution: Attribution): void {
  try {
    if (!isIosDevice() || isRunningStandalone()) return
    const params = launchParams(attribution)
    if (params.size === 0) return
    document
      .querySelector<HTMLLinkElement>('link[rel="manifest"]')
      ?.setAttribute('href', `${IOS_MANIFEST_PATH}?${params.toString()}`)
  } catch {
    // Cosmetic for attribution only; never break the page load.
  }
}
