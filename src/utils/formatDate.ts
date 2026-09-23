// Timezone pinned to Europe/Paris (the app's only audience, spec §1) so the
// rendered date does not depend on the viewer's or the server's local clock.
const dateFormatter = new Intl.DateTimeFormat('fr-FR', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  timeZone: 'Europe/Paris',
})

const dateTimeFormatter = new Intl.DateTimeFormat('fr-FR', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'Europe/Paris',
})

/** Formats an ISO timestamp as a French long date (e.g. "8 septembre 2026"). */
export function formatDate(isoDate: string): string {
  return dateFormatter.format(new Date(isoDate))
}

/** Same as `formatDate`, with the time appended (e.g. "8 septembre 2026 à
 * 14:32") — used for the draft-resume prompt, where "when was this saved"
 * matters more than it does for a klash's creation date. */
export function formatDateTime(isoDate: string): string {
  return dateTimeFormatter.format(new Date(isoDate))
}

/** ISO timestamp for `days` days before now — shared by the admin table's
 * period filter (`adminFilterParams.ts`'s `sinceForPeriod`) and the triage
 * queue's 7-day cutoff (`api/admin.ts`'s `fetchTriageQueue`), so the two
 * can't silently diverge. */
export function daysAgoIso(days: number): string {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()
}
