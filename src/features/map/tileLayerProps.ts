import type { TileLayerSpec } from './tileProviders'

/** `maxZoom` below is set well above any layer's own native maximum (20-22 across the
 * specs `tileLayerSpecs` returns — see `maxNativeZoom` on each) rather than left equal
 * to it: during a pinch gesture, Leaflet's touch-zoom handler moves the map with an
 * unclamped, unrounded zoom value every frame (`bounceAtZoomLimits` only clamps at
 * gesture end), so a fast pinch briefly reports a zoom past the limit. GridLayer._setView
 * compares that rounded value against the *TileLayer's* maxZoom (not the map's) and, if
 * it overshoots, sets its internal tile zoom to `undefined` — which blanks every tile
 * until the next valid zoom/pan event, sometimes never arriving on its own. Keeping this
 * margin above the highest native zoom in play means Leaflet never requests tiles
 * beyond what any tileset actually serves and just re-scales them for any (transient)
 * zoom above that, instead of dropping them. */
export const TILE_LAYER_MAX_ZOOM = 24

// Leaflet's own defaults for the two numeric TileLayer options `TileLayerSpec` leaves
// optional — see `tileLayerProps`'s docblock for why these two, specifically, can never
// be left as `undefined` on the actual `<TileLayer>` props.
const DEFAULT_TILE_SIZE = 256
const DEFAULT_ZOOM_OFFSET = 0

/** Maps a `TileLayerSpec` to the exact props `MapTiles.tsx` passes to `<TileLayer>` —
 * kept out of that file (a component module) so it can be unit-tested without mounting
 * a real Leaflet map (this project has no `@testing-library/react` — see
 * `useMapLayer.ts`'s own docblock on the same constraint) and so that file only ever
 * exports the one component, which Fast Refresh needs. Still lists every field
 * explicitly rather than `...spec`, for the same reason `TileLayerSpec`'s own docblock
 * gives: a spec can never smuggle an unreviewed Leaflet prop into the map through here.
 *
 * `tileSize`/`zoomOffset` default via `?? DEFAULT_…`, never a bare `spec.tileSize` /
 * `spec.zoomOffset`: whenever a spec omits one (satellite, cycling, every IGN layer —
 * none set either), JSX still puts an own `tileSize: undefined` / `zoomOffset:
 * undefined` key on the props object passed to Leaflet's `L.TileLayer` constructor.
 * Leaflet's `Util.setOptions` merges options onto a per-instance object whose
 * *prototype* is the class defaults (`tileSize: 256`, `zoomOffset: 0`) — an explicit
 * `undefined` own property shadows that prototype default rather than falling through
 * to it, the way a genuinely absent key would. `getTileSize()` then returns
 * `Point(undefined, undefined)`; every pixel-bounds computation that divides by it turns
 * into `NaN`, and GridLayer's own sanity check throws "Attempted to load an infinite
 * number of tiles" the instant the layer mounts — reproduced locally on this exact code
 * for both the satellite and cycling layers, crashing to the app's root error boundary
 * with no recovery short of clearing `localStorage`'s persisted `map-layer`
 * (`useMapLayer.ts`) from outside the crashed app. `detectRetina`/`crossOrigin`/`bounds`
 * don't need the same treatment: Leaflet only ever reads them through a truthiness check
 * (`if (this.options.bounds)`, …), where `undefined` behaves exactly like their own
 * `false`/absent defaults — verified against Leaflet's source, not assumed. */
export function tileLayerProps(spec: TileLayerSpec) {
  return {
    url: spec.url,
    attribution: spec.attribution,
    maxZoom: TILE_LAYER_MAX_ZOOM,
    maxNativeZoom: spec.maxNativeZoom,
    tileSize: spec.tileSize ?? DEFAULT_TILE_SIZE,
    zoomOffset: spec.zoomOffset ?? DEFAULT_ZOOM_OFFSET,
    detectRetina: spec.detectRetina,
    bounds: spec.bounds,
    crossOrigin: spec.crossOrigin,
  }
}
