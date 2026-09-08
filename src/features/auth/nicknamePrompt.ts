const STORAGE_KEY_PREFIX = 'pseudo-prompt-skipped:'

/** Namespaced per user id: skipping the pseudo prompt on one account must not
 * silence it for a different account on a shared device. */
export function pseudoPromptStorageKey(userId: string): string {
  return `${STORAGE_KEY_PREFIX}${userId}`
}

/** Pure decision: prompt for a pseudo only when the profile doesn't have one
 * yet and the user hasn't already dismissed the prompt on this device. There
 * is no "skipped" column in the DB (it's a display preference, not domain
 * data) — callers read `hasSkipped` from localStorage and pass it in. */
export function shouldPromptForPseudo(displayName: string | null, hasSkipped: boolean): boolean {
  return displayName === null && !hasSkipped
}
