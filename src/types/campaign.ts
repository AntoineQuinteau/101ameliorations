import { z } from 'zod'

/** Closed list of media, mirrors the `campaign_medium` enum. */
export const campaignMediumSchema = z.enum(['social', 'email', 'print', 'press'])
export type CampaignMedium = z.infer<typeof campaignMediumSchema>

export interface CampaignLink {
  slug: string
  source: string
  medium: CampaignMedium
  campaign: string
  content: string
  destination: string
  isActive: boolean
  createdAt: string
}

const campaignLinkRowSchema = z.object({
  slug: z.string(),
  source: z.string(),
  medium: campaignMediumSchema,
  campaign: z.string(),
  content: z.string(),
  destination: z.string(),
  is_active: z.boolean(),
  created_at: z.string(),
})

export function campaignLinkFromRow(row: unknown): CampaignLink {
  const r = campaignLinkRowSchema.parse(row)
  return {
    slug: r.slug,
    source: r.source,
    medium: r.medium,
    campaign: r.campaign,
    content: r.content,
    destination: r.destination,
    isActive: r.is_active,
    createdAt: r.created_at,
  }
}

/** One row of campaign_stats(). `slug` is null for attributions that match no
 * link (direct, referral, an unknown campaign): they still count in the
 * per-source / per-campaign summary. `campaign` and `content` are '' when
 * absent. */
export interface CampaignStat {
  slug: string | null
  source: string
  medium: string | null
  campaign: string
  content: string
  destination: string | null
  isActive: boolean | null
  createdAt: string | null
  scans: number
  signups: number
  installs: number
}

const campaignStatRowSchema = z.object({
  slug: z.string().nullable(),
  source: z.string(),
  medium: z.string().nullable(),
  campaign: z.string(),
  content: z.string(),
  destination: z.string().nullable(),
  is_active: z.boolean().nullable(),
  created_at: z.string().nullable(),
  scans: z.number(),
  signups: z.number(),
  installs: z.number(),
})

export function campaignStatFromRow(row: unknown): CampaignStat {
  const r = campaignStatRowSchema.parse(row)
  return {
    slug: r.slug,
    source: r.source,
    medium: r.medium,
    campaign: r.campaign,
    content: r.content,
    destination: r.destination,
    isActive: r.is_active,
    createdAt: r.created_at,
    scans: r.scans,
    signups: r.signups,
    installs: r.installs,
  }
}

export type AttributionTouch = 'first' | 'last'
