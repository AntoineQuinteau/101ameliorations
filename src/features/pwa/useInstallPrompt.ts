import { useCallback, useEffect, useState } from 'react'

const DISMISSED_KEY = '101ameliorations:install-prompt-dismissed'

// Not yet in TS's DOM lib (still a draft spec). Minimal shape actually used here.
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

/** Wraps the native `beforeinstallprompt` flow (spec §7, Android/desktop
 * Chrome/Edge): the browser fires the event once its own install-eligibility
 * checks pass, then expects `event.prompt()` to be called later, from an
 * actual user gesture — so it's captured here and replayed by our own
 * banner's button instead of the browser's default mini-infobar.
 *
 * A dismissal is remembered in localStorage so the banner doesn't reappear
 * on every visit. This is a per-viewer convenience, not app state that needs
 * to survive anything in particular, so a best-effort try/catch around
 * storage access is enough. */
export function useInstallPrompt() {
  const [deferredEvent, setDeferredEvent] = useState<BeforeInstallPromptEvent | null>(null)

  useEffect(() => {
    function onBeforeInstallPrompt(event: Event) {
      event.preventDefault()
      if (wasDismissed()) return
      setDeferredEvent(event as BeforeInstallPromptEvent)
    }
    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt)
    return () => window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt)
  }, [])

  const promptInstall = useCallback(() => {
    if (!deferredEvent) return
    void deferredEvent
      .prompt()
      .then(() => deferredEvent.userChoice)
      .then(() => setDeferredEvent(null))
  }, [deferredEvent])

  const dismiss = useCallback(() => {
    setDeferredEvent(null)
    rememberDismissal()
  }, [])

  return { canInstall: deferredEvent !== null, promptInstall, dismiss }
}

function wasDismissed(): boolean {
  try {
    return window.localStorage.getItem(DISMISSED_KEY) === '1'
  } catch {
    return false
  }
}

function rememberDismissal(): void {
  try {
    window.localStorage.setItem(DISMISSED_KEY, '1')
  } catch {
    // Best-effort only — see the docblock above.
  }
}
