import { describe, expect, it } from 'vitest'
import type { CampaignStat } from '../../types/campaign'
import {
  buildCampaignKey,
  conversionRate,
  formatRate,
  groupStats,
  normalizeCampaignToken,
  shortUrl,
} from './campaignTokens'
import { qrSvg } from './qrCode'

describe('normalizeCampaignToken', () => {
  it.each([
    ['Papillon Vélo', 'papillon-velo'],
    ['  Affiche — Parking !! ', 'affiche-parking'],
    ['Été 2026', 'ete-2026'],
    ['déjà--vu', 'deja-vu'],
    ['', ''],
    ['!!!', ''],
  ])('%j -> %j', (input, expected) => {
    expect(normalizeCampaignToken(input)).toBe(expected)
  })

  it('never exceeds 64 characters nor ends with a hyphen', () => {
    const result = normalizeCampaignToken(`${'a'.repeat(63)} b`)
    expect(result.length).toBeLessThanOrEqual(64)
    expect(result.endsWith('-')).toBe(false)
  })
})

describe('buildCampaignKey', () => {
  it('joins the normalized name and the month', () => {
    expect(buildCampaignKey('Lancement', '2026-10')).toBe('lancement-2026-10')
    expect(buildCampaignKey('Rentrée vélo', '2026-09')).toBe('rentree-velo-2026-09')
  })
  it('is empty when the name or the month is unusable', () => {
    expect(buildCampaignKey('', '2026-10')).toBe('')
    expect(buildCampaignKey('Lancement', '')).toBe('')
  })
})

describe('shortUrl', () => {
  it('is the short link, not the utm URL', () => {
    expect(shortUrl('https://101ameliorations.org/', 'cpam-papillon')).toBe(
      'https://101ameliorations.org/r/cpam-papillon',
    )
  })
})

describe('rates and grouping', () => {
  it('computes and formats conversion rates', () => {
    expect(conversionRate(1, 4)).toBe(0.25)
    expect(conversionRate(1, 0)).toBeNull()
    expect(formatRate(0.254)).toBe('25 %')
    expect(formatRate(null)).toBe('—')
  })

  it('groups rows and sums the counters', () => {
    const row = (
      source: string,
      campaign: string,
      scans: number,
      signups: number,
      installs: number,
    ) => ({ source, campaign, scans, signups, installs }) as CampaignStat
    const rows = [row('cpam', 'a', 10, 2, 1), row('txdo', 'a', 5, 1, 0), row('cpam', 'b', 1, 0, 0)]
    expect(groupStats(rows, (r) => r.source)).toEqual([
      { key: 'cpam', scans: 11, signups: 2, installs: 1 },
      { key: 'txdo', scans: 5, signups: 1, installs: 0 },
    ])
  })
})

describe('qrSvg', () => {
  it('renders an SVG that differs per URL', () => {
    const a = qrSvg('https://101ameliorations.org/r/cpam-papillon')
    expect(a.startsWith('<svg')).toBe(true)
    expect(a).not.toBe(qrSvg('https://101ameliorations.org/r/presse'))
  })
})
