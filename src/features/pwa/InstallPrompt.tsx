import { useState } from 'react'
import { fr } from '../../i18n/fr'
import { shouldShowIosInstallHint } from './iosInstall'
import { useInstallPrompt } from './useInstallPrompt'

const IOS_HINT_DISMISSED_KEY = '101ameliorations:ios-install-hint-dismissed'

function isRunningStandalone(): boolean {
  // 'standalone' is Safari-only and not in TS's Navigator type.
  const nav = window.navigator as Navigator & { standalone?: boolean }
  return window.matchMedia('(display-mode: standalone)').matches || nav.standalone === true
}

function wasIosHintDismissed(): boolean {
  try {
    return window.localStorage.getItem(IOS_HINT_DISMISSED_KEY) === '1'
  } catch {
    return false
  }
}

/** Discreet install banner (spec §7), mounted once in `src/App.tsx` so it
 * covers every route. Two independent paths, never shown together: the
 * native `beforeinstallprompt` flow (Android/desktop Chrome, Edge) takes
 * priority, and the iOS manual hint only appears when that one never fires. */
export function InstallPrompt() {
  const { canInstall, promptInstall, dismiss } = useInstallPrompt()
  const [iosHintDismissed, setIosHintDismissed] = useState(wasIosHintDismissed)

  function dismissIosHint() {
    setIosHintDismissed(true)
    try {
      window.localStorage.setItem(IOS_HINT_DISMISSED_KEY, '1')
    } catch {
      // Best-effort only, same reasoning as useInstallPrompt's own dismissal.
    }
  }

  const showIosHint =
    !iosHintDismissed &&
    !canInstall &&
    shouldShowIosInstallHint(
      window.navigator.userAgent,
      isRunningStandalone(),
      window.navigator.maxTouchPoints,
    )

  if (canInstall) {
    return (
      <div className="fixed inset-x-0 bottom-0 z-[2000] flex items-center justify-between gap-3 bg-neutral-900 px-4 py-3 text-sm text-white shadow-lg">
        <p>{fr.pwa.installPrompt}</p>
        <div className="flex shrink-0 items-center gap-3">
          <button
            type="button"
            onClick={promptInstall}
            className="rounded-md bg-teal-600 px-3 py-1.5 font-medium hover:bg-teal-500"
          >
            {fr.pwa.install}
          </button>
          <button
            type="button"
            onClick={dismiss}
            aria-label={fr.common.close}
            className="text-neutral-300"
          >
            ✕
          </button>
        </div>
      </div>
    )
  }

  if (showIosHint) {
    return (
      <div className="fixed inset-x-0 bottom-0 z-[2000] flex items-center justify-between gap-3 bg-neutral-900 px-4 py-3 text-sm text-white shadow-lg">
        <p>{fr.pwa.iosInstallHint}</p>
        <button
          type="button"
          onClick={dismissIosHint}
          aria-label={fr.common.close}
          className="shrink-0 text-neutral-300"
        >
          ✕
        </button>
      </div>
    )
  }

  return null
}
