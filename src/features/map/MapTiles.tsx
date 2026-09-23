import { TileLayer } from 'react-leaflet'
import type { TileErrorEvent } from 'leaflet'
import { env } from '../../env'
import { DEFAULT_TILE_BASE_URL, resolveTileKey } from './tileUrls'
import { tileLayerSpecs } from './tileProviders'
import type { MapLayer } from './tileProviders'
import { reportTileError } from './tileFailover'
import { useTileProvider } from './useTileProvider'

export type { MapLayer } from './tileProviders'

// Defaults to MapTiler itself so a deployment that never sets this var behaves exactly
// as before this indirection existed (see tileUrls.ts). Overridden in dev/CI (see
// vite.config.ts's tile-proxy plugin) to a same-origin path that never reaches MapTiler.
// Only ever consulted for the 'maptiler' provider — see tileProviders.ts.
const TILE_BASE_URL = env.VITE_TILE_BASE_URL ?? DEFAULT_TILE_BASE_URL

// Only ever the MapTiler key when TILE_BASE_URL actually points at MapTiler — see
// resolveTileKey's docblock. A contributor with both VITE_MAPTILER_KEY and a custom
// VITE_TILE_BASE_URL set in .env.local must not leak the former to the latter.
const TILE_KEY = resolveTileKey(TILE_BASE_URL, env.VITE_MAPTILER_KEY)

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
const TILE_LAYER_MAX_ZOOM = 24

/** Renders the active basemap (spec §6.1) for whichever `layer` is requested, from
 * whichever `TileProvider` `useTileProvider()` currently resolves to — MapTiler by
 * default, or the quota-free IGN fallback (France + Spain) either forced by an admin
 * or triggered by a detected MapTiler failure (`tileFailover.ts`). All the actual
 * per-source, per-layer differences (URL, attribution, native zoom, 512px/@2x on the
 * MapTiler plan layer only, IGN's two stacked country layers, …) live in
 * `tileProviders.ts`'s `tileLayerSpecs` — this component only turns that list into
 * `<TileLayer>`s and wires up failure detection. `key={spec.id}` on each: without it,
 * react-leaflet reuses the DOM instance and never rebuilds the tile grid when the
 * provider or layer changes. */
export function MapTiles({ layer = 'plan' }: { layer?: MapLayer }) {
  const provider = useTileProvider()
  const specs = tileLayerSpecs(provider, layer, { baseUrl: TILE_BASE_URL, key: TILE_KEY })

  // Only ever attached to MapTiler specs — reporting a CyclOSM or IGN tileerror through
  // the same path would be nonsensical (it's not what tileFailover.ts exists to detect,
  // and IGN has no fallback of its own to fail over to).
  const canFailover = provider === 'maptiler' && layer !== 'cycling'

  // `spec.url` is a template ({z}/{x}/{y} placeholders) — the errored tile's own
  // resolved src (on the <img> Leaflet's error event carries) is what reportTileError
  // needs to actually probe; falling back to the template itself would just fail as a
  // malformed URL if `tile.src` were ever unset.
  function handleTileError(event: TileErrorEvent, fallbackUrl: string) {
    void reportTileError(event.tile?.src || fallbackUrl)
  }

  return (
    <>
      {specs.map((spec) => (
        <TileLayer
          key={spec.id}
          url={spec.url}
          attribution={spec.attribution}
          maxZoom={TILE_LAYER_MAX_ZOOM}
          maxNativeZoom={spec.maxNativeZoom}
          tileSize={spec.tileSize}
          zoomOffset={spec.zoomOffset}
          detectRetina={spec.detectRetina}
          bounds={spec.bounds}
          crossOrigin={spec.crossOrigin}
          eventHandlers={
            canFailover ? { tileerror: (event) => handleTileError(event, spec.url) } : undefined
          }
        />
      ))}
    </>
  )
}
