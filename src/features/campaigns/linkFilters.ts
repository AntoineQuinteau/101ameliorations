import type { CampaignStat } from '../../types/campaign'

export interface LinkFilters {
  /** '' = every campaign / every emitter. */
  campaign: string
  source: string
}

export const noLinkFilters: LinkFilters = { campaign: '', source: '' }

export function matchesLinkFilters(row: CampaignStat, filters: LinkFilters): boolean {
  return (
    (!filters.campaign || row.campaign === filters.campaign) &&
    (!filters.source || row.source === filters.source)
  )
}
