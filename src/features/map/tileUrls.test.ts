import { describe, expect, it } from 'vitest'
import { DEFAULT_TILE_BASE_URL, buildTileUrlTemplate, resolveTileKey } from './tileUrls'

describe('buildTileUrlTemplate', () => {
  it('reproduces the exact plan-layer URL this replaces, on the default base', () => {
    expect(buildTileUrlTemplate('plan', DEFAULT_TILE_BASE_URL, 'my-key')).toBe(
      'https://api.maptiler.com/maps/streets-v2/{z}/{x}/{y}{r}.png?key=my-key',
    )
  })

  it('reproduces the exact satellite-layer URL this replaces, on the default base', () => {
    expect(buildTileUrlTemplate('satellite', DEFAULT_TILE_BASE_URL, 'my-key')).toBe(
      'https://api.maptiler.com/tiles/satellite-v2/{z}/{x}/{y}.jpg?key=my-key',
    )
  })

  it('composes with a custom (same-origin, dev-proxy) base', () => {
    expect(buildTileUrlTemplate('plan', '/__tiles', 'my-key')).toBe(
      '/__tiles/maps/streets-v2/{z}/{x}/{y}{r}.png?key=my-key',
    )
  })

  it('omits the key query param entirely when no key is given', () => {
    expect(buildTileUrlTemplate('plan', '/__tiles')).toBe(
      '/__tiles/maps/streets-v2/{z}/{x}/{y}{r}.png',
    )
    expect(buildTileUrlTemplate('satellite', '/__tiles')).toBe(
      '/__tiles/tiles/satellite-v2/{z}/{x}/{y}.jpg',
    )
  })

  it('keeps the retina placeholder on the plan layer only, never on satellite', () => {
    expect(buildTileUrlTemplate('plan', DEFAULT_TILE_BASE_URL)).toContain('{r}')
    expect(buildTileUrlTemplate('satellite', DEFAULT_TILE_BASE_URL)).not.toContain('{r}')
  })
})

describe('resolveTileKey', () => {
  it('passes the key through on the default (MapTiler) base', () => {
    expect(resolveTileKey(DEFAULT_TILE_BASE_URL, 'my-key')).toBe('my-key')
  })

  it('stays undefined on the default base when no key is configured', () => {
    expect(resolveTileKey(DEFAULT_TILE_BASE_URL, undefined)).toBeUndefined()
  })

  it('drops the key on any non-default base, even if one is configured', () => {
    expect(resolveTileKey('/__tiles', 'my-key')).toBeUndefined()
  })

  it('stays undefined on a non-default base with no key either', () => {
    expect(resolveTileKey('/__tiles', undefined)).toBeUndefined()
  })
})
