import { describe, expect, it } from 'vitest'
import { handleIosManifest } from './manifest'
import type { Env } from './index'

const STATIC_MANIFEST = { name: '101améliorations', id: '/', start_url: '/?launch=pwa' }

const env = {
  ASSETS: {
    fetch: async () => new Response(JSON.stringify(STATIC_MANIFEST)),
  } as unknown as Fetcher,
  SUPABASE_URL: '',
  SUPABASE_PUBLISHABLE_KEY: '',
} satisfies Env

async function manifestFor(query: string) {
  const response = await handleIosManifest(
    new Request(`https://101ameliorations.org/ios-manifest.webmanifest${query}`),
    env,
  )
  return { response, body: (await response?.json()) as typeof STATIC_MANIFEST }
}

describe('handleIosManifest', () => {
  it('ignores other routes and methods', async () => {
    expect(
      await handleIosManifest(new Request('https://x.org/manifest.webmanifest'), env),
    ).toBeNull()
    expect(
      await handleIosManifest(
        new Request('https://x.org/ios-manifest.webmanifest', { method: 'POST' }),
        env,
      ),
    ).toBeNull()
  })

  it('embeds a valid attribution in start_url, uncached', async () => {
    const ft = 'cpam_print_lancement-2026-10_papillon-velo_'
    const { response, body } = await manifestFor(
      `?ft=${ft}&lt=${ft}&fs=${encodeURIComponent('2026-10-01T08:00:00Z')}`,
    )
    expect(response?.headers.get('cache-control')).toBe('no-store')
    const start = new URL(body.start_url, 'https://101ameliorations.org')
    expect(start.searchParams.get('launch')).toBe('pwa')
    expect(start.searchParams.get('ft')).toBe(ft)
    expect(start.searchParams.get('fs')).toBe('2026-10-01T08:00:00Z')
    expect(body.id).toBe('/')
  })

  it('accepts a referrer-only touch', async () => {
    const { body } = await manifestFor('?ft=____www.sudouest.fr')
    expect(new URL(body.start_url, 'https://x.org').searchParams.get('ft')).toBe(
      '____www.sudouest.fr',
    )
  })

  it.each([
    ['uppercase', '?ft=CPAM_print_x__'],
    ['unknown medium', '?ft=cpam_banner_x__'],
    ['wrong part count', '?ft=cpam_print'],
    ['injection attempt', '?ft=cpam_print_x__%26evil%3D1'],
    ['too long', `?ft=${'a'.repeat(500)}`],
    ['empty touch', '?ft=____'],
  ])('drops an invalid touch and serves the static manifest: %s', async (_name, query) => {
    const { body } = await manifestFor(query)
    expect(body).toEqual(STATIC_MANIFEST)
  })

  it('keeps only the valid of two touches', async () => {
    const { body } = await manifestFor('?ft=cpam_print_x__&lt=BAD')
    const start = new URL(body.start_url, 'https://x.org')
    expect(start.searchParams.get('ft')).toBe('cpam_print_x__')
    expect(start.searchParams.has('lt')).toBe(false)
  })
})
