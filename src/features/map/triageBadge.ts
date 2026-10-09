const MAX_DISPLAYED_COUNT = 9

/** The text of the staff shortcut's triage badge: the count itself up to 9,
 * "9+" beyond, and `null` (no badge at all) when nothing is waiting. */
export function triageBadgeText(count: number): string | null {
  if (count <= 0) return null
  return count > MAX_DISPLAYED_COUNT ? `${MAX_DISPLAYED_COUNT}+` : String(count)
}
