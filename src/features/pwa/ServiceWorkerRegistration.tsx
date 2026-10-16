import { useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { useRegisterSW } from 'virtual:pwa-register/react'
import { isUpdateReloadPoint } from './updateReload'

/** Registers the service worker (spec §7, `registerType: 'autoUpdate'`).
 * A new version installs and takes over in the background, but the page is
 * never reloaded under the visitor: the new code loads on the next page load,
 * or earlier on the next in-app page change (see `isUpdateReloadPoint`).
 * Renders nothing. */
export function ServiceWorkerRegistration() {
  const [registration, setRegistration] = useState<ServiceWorkerRegistration>()
  const [isUpdateActive, setIsUpdateActive] = useState(false)
  useRegisterSW({
    onRegisteredSW: (_swUrl, registered) => setRegistration(registered),
    // Replaces the plugin's own immediate window.location.reload().
    onNeedReload: () => setIsUpdateActive(true),
  })

  // The browser only looks for a new sw.js on page loads, and an installed app
  // on a phone is mostly resumed from memory rather than reloaded: check again
  // whenever the app comes back to the foreground.
  useEffect(() => {
    if (!registration) return
    const checkForUpdate = () => {
      if (document.visibilityState !== 'visible') return
      // Offline or a transient network error: the next return retries.
      registration.update().catch(() => {})
    }
    document.addEventListener('visibilitychange', checkForUpdate)
    return () => document.removeEventListener('visibilitychange', checkForUpdate)
  }, [registration])

  const location = useLocation()
  const previousLocation = useRef(location)
  useEffect(() => {
    const from = previousLocation.current
    previousLocation.current = location
    if (isUpdateActive && isUpdateReloadPoint(from, location)) window.location.reload()
  }, [location, isUpdateActive])

  return null
}
