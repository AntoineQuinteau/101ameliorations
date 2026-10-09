const STORAGE_KEY = 'login-email-draft'

/** The email typed on the login form, kept in sessionStorage (never in the URL, which
 * would leak it through history, referrers and shared links) so a round trip to another
 * page, e.g. the privacy policy linked from the form, does not lose it. Scoped to the tab
 * and cleared once the user is signed in. Every access is wrapped: storage can be
 * unavailable (private mode, blocked site data) and the form must work without it. */
export function readLoginEmailDraft(): string {
  try {
    return sessionStorage.getItem(STORAGE_KEY) ?? ''
  } catch {
    return ''
  }
}

export function writeLoginEmailDraft(email: string): void {
  try {
    if (email === '') sessionStorage.removeItem(STORAGE_KEY)
    else sessionStorage.setItem(STORAGE_KEY, email)
  } catch {
    // Nothing to persist to, and nothing to do about it.
  }
}

export function clearLoginEmailDraft(): void {
  writeLoginEmailDraft('')
}
