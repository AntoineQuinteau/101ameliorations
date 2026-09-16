import { useRegisterSW } from 'virtual:pwa-register/react'

/** Registers the service worker (spec §7, `registerType: 'autoUpdate'`).
 * Renders nothing: autoUpdate mode reloads the page itself once a new
 * version has activated, so this component only exists to call
 * `useRegisterSW()` as a side effect — unlike the install flow (see
 * `InstallPrompt`), no banner is needed to ask before updating. */
export function ServiceWorkerRegistration() {
  useRegisterSW()
  return null
}
