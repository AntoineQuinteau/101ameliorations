import { fr } from '../../i18n/fr'
import type { CampaignStat } from '../../types/campaign'
import { useCampaignSources } from './useCampaigns'

/** Display label of a source: the French label of src/i18n/fr.ts first (so the
 * historical and synthetic sources never change), then the label typed when
 * the emitter was created, then the key itself. */
export function resolveSourceLabel(
  source: string,
  dbLabels: ReadonlyMap<string, string | null> = new Map(),
): string {
  return (fr.campaigns.source as Record<string, string>)[source] ?? dbLabels.get(source) ?? source
}

/** Label resolver backed by the emitters list (React Query shares the request;
 * while it loads, labels fall back to fr.ts then the key). */
export function useSourceLabel(): (source: string) => string {
  const sources = useCampaignSources()
  const dbLabels = new Map((sources.data ?? []).map((s) => [s.source, s.label]))
  return (source) => resolveSourceLabel(source, dbLabels)
}

/** One line saying what a link is: emitter · medium · campaign · precision. */
export function linkDescription(row: CampaignStat, labelOf: (source: string) => string): string {
  const medium = row.medium
    ? ((fr.campaigns.medium as Record<string, string>)[row.medium] ?? row.medium)
    : null
  return [labelOf(row.source), medium, row.campaign, row.content || fr.campaigns.list.noContent]
    .filter(Boolean)
    .join(' · ')
}
