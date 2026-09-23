import { describe, expect, it } from 'vitest'
import { DEFAULT_TILE_BASE_URL } from './tileUrls'
import { tileLayerSpecs } from './tileProviders'
import { SERVICE_AREA_BBOX } from '../../config/serviceArea'

type LatLngBox = [[number, number], [number, number]]

function containsPoint(bounds: LatLngBox, lat: number, lng: number): boolean {
  const [[south, west], [north, east]] = bounds
  return lat >= south && lat <= north && lng >= west && lng <= east
}

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
  it('stacks exactly three layers (France + Spain coast + Spain interior) for plan', () => {
    const specs = tileLayerSpecs('ign', 'plan')
    expect(specs).toHaveLength(3)
    expect(specs.map((s) => s.id)).toEqual([
      'ign-fr-plan',
      'ign-es-coast-plan',
      'ign-es-interior-plan',
    ])
  })

  it('stacks exactly three layers (France + Spain coast + Spain interior) for satellite', () => {
    const specs = tileLayerSpecs('ign', 'satellite')
    expect(specs).toHaveLength(3)
    expect(specs.map((s) => s.id)).toEqual([
      'ign-fr-satellite',
      'ign-es-coast-satellite',
      'ign-es-interior-satellite',
    ])
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

  it('France bounds cover the whole service area (regression: PR #33 review, round 4 — a coverage gap)', () => {
    // Round 2's fix (making the two boxes disjoint by latitude alone) capped
    // IGN_FRANCE_BOUNDS's south edge at the France/Spain split, so French territory
    // south of it — Pau, Oloron, Mauléon, Saint-Jean-Pied-de-Port — got no French IGN
    // layer requested at all, not merely a lower z-order under Spain's. France's box
    // must reach at least as far as SERVICE_AREA_BBOX in every direction.
    for (const layer of ['plan', 'satellite'] as const) {
      const [fr] = tileLayerSpecs('ign', layer)
      const [[south, west], [north, east]] = fr.bounds as LatLngBox
      expect(south).toBeLessThanOrEqual(SERVICE_AREA_BBOX.minLat)
      expect(west).toBeLessThanOrEqual(SERVICE_AREA_BBOX.minLng)
      expect(north).toBeGreaterThanOrEqual(SERVICE_AREA_BBOX.maxLat)
      expect(east).toBeGreaterThanOrEqual(SERVICE_AREA_BBOX.maxLng)
    }
  })

  it("Spain's two corners are each narrower than France's box, not latitude-only bands (regression: PR #33 review, round 1/2/4)", () => {
    // A latitude-only band (rounds 1-2's approach) would span the same full longitude
    // range as France's box — asserting each Spain box is narrower in *both* dimensions
    // is what actually distinguishes a proper south-west corner from a band.
    for (const layer of ['plan', 'satellite'] as const) {
      const [fr, esCoast, esInterior] = tileLayerSpecs('ign', layer)
      const [, [franceNorth, franceEast]] = fr.bounds as LatLngBox

      for (const es of [esCoast, esInterior]) {
        const [[spainSouth, spainWest], [spainNorth, spainEast]] = es.bounds as LatLngBox
        expect(spainSouth).toBeLessThan(spainNorth) // non-degenerate
        expect(spainWest).toBeLessThan(spainEast) // non-degenerate
        expect(spainNorth).toBeLessThanOrEqual(franceNorth) // no wider than France
        expect(spainEast).toBeLessThan(franceEast) // narrower in longitude
      }
    }
  })

  it('places every named town (from five rounds of review) on its correct side of the split', () => {
    // Round 5: a single Spain corner loose enough in longitude to reach Pamplona also
    // reached this whole populated stretch of the French Basque coast and interior, at
    // similar longitudes but further north than Pamplona — see
    // `IGN_SPAIN_COAST_BOUNDS`'s docblock for why that needs two corners, not one, to
    // fix without losing Pamplona.
    const frenchTowns = {
      Pau: [43.295, -0.37],
      Oloron: [43.19, -0.61],
      Mauléon: [43.22, -0.89],
      'Saint-Jean-Pied-de-Port': [43.16, -1.24],
      'Saint-Jean-de-Luz': [43.39, -1.66],
      Ciboure: [43.38, -1.67],
      Urrugne: [43.36, -1.7],
      Ascain: [43.32, -1.58],
      Sare: [43.29, -1.58],
      'Saint-Pée-sur-Nivelle': [43.36, -1.55],
      Espelette: [43.34, -1.45],
      'Cambo-les-Bains': [43.36, -1.4],
      Itxassou: [43.32, -1.42],
      Bidarray: [43.24, -1.23],
    } as const
    // Spanish towns close to a corner's edge, to catch a threshold that's merely in the
    // right direction but not tight/loose enough — not just towns deep inside it.
    const spanishCoastTowns = {
      'San Sebastián': [43.32, -1.98],
      Irun: [43.34, -1.79],
      Hondarribia: [43.37, -1.79],
    } as const
    const spanishInteriorTowns = {
      Pamplona: [42.82, -1.64],
    } as const

    for (const layer of ['plan', 'satellite'] as const) {
      const [fr, esCoast, esInterior] = tileLayerSpecs('ign', layer)
      const franceBounds = fr.bounds as LatLngBox
      const spainCoastBounds = esCoast.bounds as LatLngBox
      const spainInteriorBounds = esInterior.bounds as LatLngBox

      for (const [name, [lat, lng]] of Object.entries(frenchTowns)) {
        expect(containsPoint(franceBounds, lat, lng), `${name} should be in France's bounds`).toBe(
          true,
        )
        expect(
          containsPoint(spainCoastBounds, lat, lng),
          `${name} should NOT be in Spain's coastal bounds`,
        ).toBe(false)
        expect(
          containsPoint(spainInteriorBounds, lat, lng),
          `${name} should NOT be in Spain's interior bounds`,
        ).toBe(false)
      }

      for (const [name, [lat, lng]] of Object.entries(spanishCoastTowns)) {
        expect(
          containsPoint(spainCoastBounds, lat, lng),
          `${name} should be in Spain's coastal bounds`,
        ).toBe(true)
      }

      for (const [name, [lat, lng]] of Object.entries(spanishInteriorTowns)) {
        expect(
          containsPoint(spainInteriorBounds, lat, lng),
          `${name} should be in Spain's interior bounds`,
        ).toBe(true)
      }
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
