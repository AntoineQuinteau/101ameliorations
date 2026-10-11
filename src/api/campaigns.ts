import { supabase } from '../lib/supabase'
import {
  campaignLinkFromRow,
  campaignStatFromRow,
  type AttributionTouch,
  type CampaignLink,
  type CampaignMedium,
  type CampaignStat,
} from '../types/campaign'

/** Per-link and per-attribution counters (campaign managers only, enforced by
 * the RPC). `touch` picks whether sign-ups and installs are credited to the
 * first or the last channel that brought the person. */
export async function fetchCampaignStats(touch: AttributionTouch): Promise<CampaignStat[]> {
  const { data, error } = await supabase.rpc('campaign_stats', { p_touch: touch })
  if (error) throw error
  return data.map(campaignStatFromRow)
}

export async function fetchCampaignSources(): Promise<string[]> {
  const { data, error } = await supabase.from('campaign_sources').select('source').order('source')
  if (error) throw error
  return data.map((row) => row.source)
}

/** Creates a link; the database normalizes campaign and content, generates the
 * slug and refuses a duplicate. */
export async function createCampaignLink(input: {
  source: string
  medium: CampaignMedium
  campaign: string
  content: string
}): Promise<CampaignLink> {
  const { data, error } = await supabase.rpc('create_campaign_link', {
    p_source: input.source,
    p_medium: input.medium,
    p_campaign: input.campaign,
    p_content: input.content,
  })
  if (error) throw error
  return campaignLinkFromRow(data)
}

/** Links are never deleted: only the destination and the active flag change. */
export async function updateCampaignLink(
  slug: string,
  changes: { destination?: string; isActive?: boolean },
): Promise<CampaignLink> {
  const { data, error } = await supabase
    .from('campaign_links')
    .update({
      ...(changes.destination !== undefined && { destination: changes.destination }),
      ...(changes.isActive !== undefined && { is_active: changes.isActive }),
    })
    .eq('slug', slug)
    .select('*')
    .single()
  if (error) throw error
  return campaignLinkFromRow(data)
}
