import { describe, expect, it } from 'vitest'
import { tileLayerProps } from './tileLayerProps'
import { tileLayerSpecs } from './tileProviders'
import { DEFAULT_TILE_BASE_URL } from './tileUrls'

describe('tileLayerProps', () => {
  it('never passes tileSize or zoomOffset as undefined (regression: PR #33 — production crash)', () => {
    // A real, reproduced-in-a-browser bug, not a hypothetical: `tileSize={undefined}` /
    // `zoomOffset={undefined}` on <TileLayer> shadows Leaflet's own class defaults with
    // an own `undefined` property (Leaflet's Util.setOptions merges onto a per-instance
    // object whose *prototype* is the class defaults — see tileLayerProps's docblock),
    // so getTileSize() returns Point(undefined, undefined), every pixel-bounds
    // computation that divides by it becomes NaN, and GridLayer throws "Attempted to
    // load an infinite number of tiles" the instant the layer mounts. Reproduced
    // locally for both the satellite and cycling layers — the app's root error boundary
    // catches it with no in-app recovery, since the crashing layer is persisted in
    // localStorage (useMapLayer.ts) and re-read on the very next mount.
    //
    // Every provider/layer combination that a real spec can produce, not just the two
    // that were actually seen crashing — this is a property of tileLayerProps itself,
    // so every spec must satisfy it, not only the ones manually reproduced.
    const combinations: Array<Parameters<typeof tileLayerSpecs>> = [
      ['maptiler', 'plan', { baseUrl: DEFAULT_TILE_BASE_URL }],
      ['maptiler', 'satellite', { baseUrl: DEFAULT_TILE_BASE_URL }],
      ['maptiler', 'cycling', { baseUrl: DEFAULT_TILE_BASE_URL }],
      ['ign', 'plan'],
      ['ign', 'satellite'],
      ['ign', 'cycling'],
    ]

    for (const args of combinations) {
      for (const spec of tileLayerSpecs(...args)) {
        const props = tileLayerProps(spec)
        expect(typeof props.tileSize, `${spec.id}.tileSize`).toBe('number')
        expect(typeof props.zoomOffset, `${spec.id}.zoomOffset`).toBe('number')
        expect(Number.isFinite(props.tileSize), `${spec.id}.tileSize finite`).toBe(true)
        expect(Number.isFinite(props.zoomOffset), `${spec.id}.zoomOffset finite`).toBe(true)
      }
    }
  })

  it("falls back to Leaflet's own defaults (256px, no offset) when a spec omits them", () => {
    const [satellite] = tileLayerSpecs('maptiler', 'satellite', { baseUrl: DEFAULT_TILE_BASE_URL })
    const props = tileLayerProps(satellite)
    expect(props.tileSize).toBe(256)
    expect(props.zoomOffset).toBe(0)
  })

  it("still uses the plan layer's real override, not the default, when the spec sets one", () => {
    const [plan] = tileLayerSpecs('maptiler', 'plan', { baseUrl: DEFAULT_TILE_BASE_URL })
    const props = tileLayerProps(plan)
    expect(props.tileSize).toBe(512)
    expect(props.zoomOffset).toBe(-1)
  })

  it('passes bounds and detectRetina through unchanged, including when undefined', () => {
    const [satellite] = tileLayerSpecs('maptiler', 'satellite', { baseUrl: DEFAULT_TILE_BASE_URL })
    const satelliteProps = tileLayerProps(satellite)
    expect(satelliteProps.bounds).toBeUndefined()
    expect(satelliteProps.detectRetina).toBeUndefined()

    const [ignFrance] = tileLayerSpecs('ign', 'plan')
    expect(tileLayerProps(ignFrance).bounds).toBeDefined()
  })
})
