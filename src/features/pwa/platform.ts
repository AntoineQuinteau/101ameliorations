import { shouldShowIosInstallHint } from './iosInstall'

export type InstallPlatform = 'android' | 'ios' | 'desktop'

/** True when the app runs as an installed PWA. 'standalone' is Safari-only
 * and not in TS's Navigator type. */
export function isRunningStandalone(): boolean {
  const nav = window.navigator as Navigator & { standalone?: boolean }
  return window.matchMedia('(display-mode: standalone)').matches || nav.standalone === true
}

/** Whether the device is an iPhone/iPad, installed or not (the install hint
 * helper answers false once standalone, so it is asked as if not installed). */
export function isIosDevice(): boolean {
  return shouldShowIosInstallHint(
    window.navigator.userAgent,
    false,
    window.navigator.maxTouchPoints,
  )
}

export function installPlatform(): InstallPlatform {
  if (isIosDevice()) return 'ios'
  return /android/i.test(window.navigator.userAgent) ? 'android' : 'desktop'
}
