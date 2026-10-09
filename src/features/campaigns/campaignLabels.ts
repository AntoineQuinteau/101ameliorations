import { fr } from '../../i18n/fr'

/** French label of a source, falling back to its key for a source added by a
 * migration before its label reaches src/i18n/fr.ts. */
export function sourceLabel(source: string): string {
  return (fr.campaigns.source as Record<string, string>)[source] ?? source
}
