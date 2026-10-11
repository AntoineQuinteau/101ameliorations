import type { CampaignStat } from '../../types/campaign'

// Client-side mirror of public.normalize_campaign_token() (the database is the
// authority and normalizes again): lowercase, no accents, anything that is not
// a letter or digit becomes a hyphen. Used for the live preview in the form.
export function normalizeCampaignToken(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64)
    .replace(/-+$/g, '')
}

/** Campaign key = operation name + month, e.g. ("Lancement", "2026-10") ->
 * "lancement-2026-10". `month` is an <input type="month"> value (YYYY-MM).
 * Empty when either part is unusable. */
export function buildCampaignKey(name: string, month: string): string {
  const normalizedName = normalizeCampaignToken(name)
  if (!normalizedName || !/^\d{4}-\d{2}$/.test(month)) return ''
  return normalizeCampaignToken(`${normalizedName}-${month}`)
}

/** The short URL a QR code encodes (never the long utm URL). */
export function shortUrl(origin: string, slug: string): string {
  return `${origin.replace(/\/$/, '')}/r/${slug}`
}

/** `numerator / denominator` as a 0..1 ratio, or null when undefined. */
export function conversionRate(numerator: number, denominator: number): number | null {
  return denominator > 0 ? numerator / denominator : null
}

export function formatRate(rate: number | null): string {
  return rate === null ? '—' : `${Math.round(rate * 100)} %`
}

export interface StatTotals {
  scans: number
  signups: number
  installs: number
}

export interface StatGroup extends StatTotals {
  key: string
}

/** Sums rows by `keyOf`, keeping the order of first appearance. */
export function groupStats(
  rows: readonly CampaignStat[],
  keyOf: (row: CampaignStat) => string,
): StatGroup[] {
  const groups = new Map<string, StatGroup>()
  for (const row of rows) {
    const key = keyOf(row)
    const group = groups.get(key) ?? { key, scans: 0, signups: 0, installs: 0 }
    group.scans += row.scans
    group.signups += row.signups
    group.installs += row.installs
    groups.set(key, group)
  }
  return [...groups.values()]
}
