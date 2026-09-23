import { describe, expect, it } from 'vitest'
import { DEFAULT_TILE_BASE_URL } from './tileUrls'
import { tileLayerSpecs } from './tileProviders'

describe('tileLayerSpecs — maptiler', () => {
  it('reproduces the exact plan-layer TileLayer props this replaces', () => {
    const [spec] = tileLayerSpecs('maptiler', 'plan', {
      baseUrl: DEFAULT_TILE_BASE_URL,
      key: 'my-key',
    })
    expect(spec).toMatchObject({
      url: 'https://api.maptiler.com/maps/streets-v2/{z}/{x}/{y}{r}.png?key=my-key',
      detectRetina: true,
      tileSize: 512,
      zoomOffset: -1,
      maxNativeZoom: 20,
    })
  })

  it('reproduces the exact satellite-layer TileLayer props this replaces', () => {
    const [spec] = tileLayerSpecs('maptiler', 'satellite', {
      baseUrl: DEFAULT_TILE_BASE_URL,
      key: 'my-key',
    })
    expect(spec).toMatchObject({
      url: 'https://api.maptiler.com/tiles/satellite-v2/{z}/{x}/{y}.jpg?key=my-key',
      maxNativeZoom: 22,
    })
    expect(spec.tileSize).toBeUndefined()
    expect(spec.detectRetina).toBeUndefined()
  })

  it('returns exactly one layer for plan and one for satellite', () => {
    expect(tileLayerSpecs('maptiler', 'plan', { baseUrl: DEFAULT_TILE_BASE_URL })).toHaveLength(1)
    expect(
      tileLayerSpecs('maptiler', 'satellite', { baseUrl: DEFAULT_TILE_BASE_URL }),
    ).toHaveLength(1)
  })

  it('drops the key on a non-default base (dev/CI proxy), same as resolveTileKey', () => {
    const [spec] = tileLayerSpecs('maptiler', 'plan', { baseUrl: '/__tiles', key: 'my-key' })
    expect(spec.url).not.toContain('key=')
  })
})

describe('tileLayerSpecs — ign', () => {
  it('stacks exactly two layers (France + Spain) for plan', () => {
    const specs = tileLayerSpecs('ign', 'plan')
    expect(specs).toHaveLength(2)
    expect(specs.map((s) => s.id)).toEqual(['ign-fr-plan', 'ign-es-plan'])
  })

  it('stacks exactly two layers (France + Spain) for satellite', () => {
    const specs = tileLayerSpecs('ign', 'satellite')
    expect(specs).toHaveLength(2)
    expect(specs.map((s) => s.id)).toEqual(['ign-fr-satellite', 'ign-es-satellite'])
  })

  it('never carries the MapTiler key or {r} retina placeholder', () => {
    for (const layer of ['plan', 'satellite'] as const) {
      for (const spec of tileLayerSpecs('ign', layer)) {
        expect(spec.url).not.toContain('key=')
        expect(spec.url).not.toContain('{r}')
      }
    }
  })

  it('every spec has the {z}/{x}/{y} placeholders and a bounds clip', () => {
    for (const layer of ['plan', 'satellite'] as const) {
      for (const spec of tileLayerSpecs('ign', layer)) {
        expect(spec.url).toContain('{z}')
        expect(spec.url).toContain('{x}')
        expect(spec.url).toContain('{y}')
        expect(spec.bounds).toBeDefined()
      }
    }
  })

  it('France and Spain attributions are distinct', () => {
    const [fr, es] = tileLayerSpecs('ign', 'plan')
    expect(fr.attribution).toContain('IGN')
    expect(es.attribution).toContain('Instituto Geográfico Nacional')
    expect(fr.attribution).not.toBe(es.attribution)
  })

  it('France and Spain bounds share only a boundary line, not an overlapping area (regression: PR #33 review, round 2)', () => {
    // Round 1 only narrowed Spain's box while leaving France's at the full service
    // area, so the two still overlapped across the entire southern band (Pau, Oloron,
    // Mauléon and Saint-Jean-Pied-de-Port all inside it) — Spain, mounted second, won
    // that whole band. Asserting France's south edge sits exactly AT (not below) Spain's
    // north edge is what actually catches a shared-area regression; the round-1 test's
    // "spainNorth < franceNorth" passed even on the buggy code, since it compared the
    // wrong pair of edges (both boxes' northern edges, not the shared one).
    for (const layer of ['plan', 'satellite'] as const) {
      const [fr, es] = tileLayerSpecs('ign', layer)
      expect(fr.bounds).toBeDefined()
      expect(es.bounds).toBeDefined()

      const [[franceSouth], [franceNorth]] = fr.bounds as [[number, number], [number, number]]
      const [[spainSouth], [spainNorth]] = es.bounds as [[number, number], [number, number]]

      expect(spainSouth).toBeLessThan(spainNorth) // Spain's own box is non-degenerate
      expect(franceSouth).toBeLessThan(franceNorth) // France's own box is non-degenerate
      // The regression guard: no shared latitude range between the two boxes.
      expect(franceSouth).toBe(spainNorth)
    }
  })
})

describe('tileLayerSpecs — cycling', () => {
  it('always returns CyclOSM, regardless of provider', () => {
    const viaMaptiler = tileLayerSpecs('maptiler', 'cycling', { baseUrl: DEFAULT_TILE_BASE_URL })
    const viaIgn = tileLayerSpecs('ign', 'cycling')
    expect(viaMaptiler).toEqual(viaIgn)
    expect(viaMaptiler).toHaveLength(1)
    expect(viaMaptiler[0].id).toBe('cyclosm')
  })

  it('never contains a MapTiler key even when one is configured', () => {
    const [spec] = tileLayerSpecs('maptiler', 'cycling', {
      baseUrl: DEFAULT_TILE_BASE_URL,
      key: 'my-key',
    })
    expect(spec.url).not.toContain('key=')
  })
})
