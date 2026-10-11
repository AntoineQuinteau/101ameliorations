import { fr } from '../../i18n/fr'
import type { CampaignStat } from '../../types/campaign'

/** French label of a source, falling back to its key for a source added by a
 * migration before its label reaches src/i18n/fr.ts. */
export function sourceLabel(source: string): string {
  return (fr.campaigns.source as Record<string, string>)[source] ?? source
}

/** One line saying what a link is: emitter · medium · campaign · precision. */
export function linkDescription(row: CampaignStat): string {
  const medium = row.medium
    ? ((fr.campaigns.medium as Record<string, string>)[row.medium] ?? row.medium)
    : null
  return [sourceLabel(row.source), medium, row.campaign, row.content || fr.campaigns.list.noContent]
    .filter(Boolean)
    .join(' · ')
}
