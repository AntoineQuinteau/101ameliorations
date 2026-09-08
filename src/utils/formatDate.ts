// Timezone pinned to Europe/Paris (the app's only audience, spec §1) so the
// rendered date does not depend on the viewer's or the server's local clock.
const dateFormatter = new Intl.DateTimeFormat('fr-FR', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  timeZone: 'Europe/Paris',
})

/** Formats an ISO timestamp as a French long date (e.g. "8 septembre 2026"). */
export function formatDate(isoDate: string): string {
  return dateFormatter.format(new Date(isoDate))
}
