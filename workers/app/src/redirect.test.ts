import { afterEach, describe, expect, it, vi } from 'vitest'
import { handleCampaignRedirect } from './redirect'
import type { Env } from './index'

const env = {
  ASSETS: {} as Fetcher,
  SUPABASE_URL: 'https://example.supabase.co',
  SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test',
} satisfies Env

const ACTIVE_LINK = {
  source: 'cpam',
  medium: 'print',
  campaign: 'lancement-2026-10',
  content: 'papillon-velo',
  destination: '/',
}

function stubRpc(rows: unknown[] | Error | 'http-error') {
  const fetchMock = vi.fn(async () => {
    if (rows instanceof Error) throw rows
    if (rows === 'http-error') return new Response('boom', { status: 500 })
    return new Response(JSON.stringify(rows), { status: 200 })
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

function request(path: string, init?: RequestInit) {
  return new Request(`https://101ameliorations.org${path}`, init)
}

afterEach(() => vi.unstubAllGlobals())

describe('handleCampaignRedirect', () => {
  it('ignores other routes', async () => {
    expect(await handleCampaignRedirect(request('/k/abc'), env)).toBeNull()
    expect(await handleCampaignRedirect(request('/r/a/b'), env)).toBeNull()
    expect(await handleCampaignRedirect(request('/r/x', { method: 'POST' }), env)).toBeNull()
  })

  it('redirects an active link with its utm parameters, uncached', async () => {
    stubRpc([ACTIVE_LINK])
    const response = await handleCampaignRedirect(request('/r/cpam-papillon'), env)
    expect(response?.status).toBe(302)
    expect(response?.headers.get('cache-control')).toBe('no-store')
    expect(response?.headers.get('location')).toBe(
      'https://101ameliorations.org/?utm_source=cpam&utm_medium=print&utm_campaign=lancement-2026-10&utm_content=papillon-velo',
    )
  })

  it('omits utm_content when the link has none', async () => {
    stubRpc([{ ...ACTIVE_LINK, source: 'presse', medium: 'press', content: '' }])
    const response = await handleCampaignRedirect(request('/r/presse'), env)
    expect(response?.headers.get('location')).not.toContain('utm_content')
  })

  it('counts a normal visit', async () => {
    const fetchMock = stubRpc([ACTIVE_LINK])
    await handleCampaignRedirect(
      request('/r/cpam-papillon', { headers: { 'user-agent': 'Mozilla/5.0 iPhone' } }),
      env,
    )
    const call = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    expect(JSON.parse(call[1].body as string)).toEqual({ p_slug: 'cpam-papillon', p_count: true })
  })

  it.each([
    ['link-preview bot', { headers: { 'user-agent': 'WhatsApp/2.23' } }],
    ['HEAD request', { method: 'HEAD' }],
  ])('redirects but does not count a %s', async (_name, init) => {
    const fetchMock = stubRpc([ACTIVE_LINK])
    const response = await handleCampaignRedirect(request('/r/cpam-papillon', init), env)
    expect(response?.status).toBe(302)
    const call = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    expect(JSON.parse(call[1].body as string).p_count).toBe(false)
  })

  it.each([
    ['unknown or deactivated slug', [] as unknown[]],
    ['http error', 'http-error' as const],
    ['network failure', new Error('down')],
  ])('falls back to the bare home page: %s', async (_name, rows) => {
    stubRpc(rows)
    const response = await handleCampaignRedirect(request('/r/nope'), env)
    expect(response?.status).toBe(302)
    expect(response?.headers.get('location')).toBe('https://101ameliorations.org/')
    expect(response?.headers.get('cache-control')).toBe('no-store')
  })

  it('never redirects off-site, even if the database returned such a destination', async () => {
    stubRpc([{ ...ACTIVE_LINK, destination: '//evil.example' }])
    const response = await handleCampaignRedirect(request('/r/cpam-papillon'), env)
    expect(response?.headers.get('location')).toBe('https://101ameliorations.org/')
  })

  it('answers without Supabase configured', async () => {
    const response = await handleCampaignRedirect(request('/r/x'), { ...env, SUPABASE_URL: '' })
    expect(response?.headers.get('location')).toBe('https://101ameliorations.org/')
  })
})
