// Also seeded by playwright.config.ts (`use.storageState`) so that every e2e
// context but e2e/welcome.spec.ts starts with the welcome dialog already seen.
export const WELCOME_SEEN_KEY = '101ameliorations:welcome-seen'

/** Whether the first-visit welcome dialog (spec §6.1) was already closed on this
 * device. Exported as a pure function, like `readStoredMapLayer`, since this
 * project has no `@testing-library/react` to render a hook with. A storage
 * failure (Safari private browsing) reads as "not seen": the dialog shows, and
 * closing it still hides it for as long as the page stays open. */
export function readWelcomeSeen(): boolean {
  try {
    return localStorage.getItem(WELCOME_SEEN_KEY) === '1'
  } catch {
    return false
  }
}

export function writeWelcomeSeen(): void {
  try {
    localStorage.setItem(WELCOME_SEEN_KEY, '1')
  } catch {
    // Best-effort only: the dialog would just show again on the next visit.
  }
}

/** The dialog opens by itself only for a signed-out visitor who hasn't seen it,
 * and only once the restored session (if any) is known — otherwise it would
 * flash for a signed-in user while auth is still initializing. */
export function shouldAutoShowWelcome({
  seen,
  isInitializing,
  isSignedIn,
}: {
  seen: boolean
  isInitializing: boolean
  isSignedIn: boolean
}): boolean {
  return !seen && !isInitializing && !isSignedIn
}
