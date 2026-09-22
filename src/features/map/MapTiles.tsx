import { TileLayer } from 'react-leaflet'
import { env } from '../../env'
import { DEFAULT_TILE_BASE_URL, buildTileUrlTemplate } from './tileUrls'

export type MapLayer = 'plan' | 'satellite'

// Defaults to MapTiler itself so a deployment that never sets this var behaves exactly
// as before this indirection existed (see tileUrls.ts). Overridden in dev/CI (see
// vite.config.ts's tile-proxy plugin) to a same-origin path that never reaches MapTiler.
const TILE_BASE_URL = env.VITE_TILE_BASE_URL ?? DEFAULT_TILE_BASE_URL

// MapTiler + OpenStreetMap attribution is legally mandated boilerplate, not app copy —
// kept here rather than in src/i18n/fr.ts. The satellite tileset's TileJSON returns the
// exact same string, so this one constant covers both layers.
const ATTRIBUTION =
  '<a href="https://www.maptiler.com/copyright/" target="_blank" rel="noopener">© MapTiler</a> ' +
  '<a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">© OpenStreetMap contributors</a>'

/** `maxZoom` on both layers below is set well above either layer's own native maximum
 * (20 for streets, 22 for satellite — see `maxNativeZoom` on each) rather than left
 * equal to it: during a pinch gesture, Leaflet's touch-zoom handler moves the map with
 * an unclamped, unrounded zoom value every frame (`bounceAtZoomLimits` only clamps at
 * gesture end), so a fast pinch briefly reports a zoom past the limit. GridLayer._setView
 * compares that rounded value against the *TileLayer's* maxZoom (not the map's) and, if
 * it overshoots, sets its internal tile zoom to `undefined` — which blanks every tile
 * until the next valid zoom/pan event, sometimes never arriving on its own. Keeping this
 * margin above the highest of the two `maxNativeZoom` values (22) means Leaflet never
 * requests tiles beyond what each tileset actually serves and just re-scales them for
 * any (transient) zoom above that, instead of dropping them. */
const TILE_LAYER_MAX_ZOOM = 24

/** MapTiler "Streets" raster tiles (spec §6.1) and, on the main map, the alternative
 * satellite tileset (spec §6.1 follow-up — map layer toggle). `layer` picks which
 * `TileLayer` is rendered; only one is ever mounted at a time (no overlay — nothing
 * needs it, and it would double tile consumption).
 *
 * The two layers are NOT symmetrical, which is why they're two explicit `<TileLayer>`
 * blocks rather than one with ternary props: the satellite imagery is served from a
 * different path (`/tiles/`, not `/maps/` — the "wrong" URL 404s), the grid is 256px with
 * no `tileSize`/`zoomOffset` override (unlike the streets style's 512px grid), and it has
 * no `@2x` retina variant — `detectRetina` on that layer would blank every tile on a
 * high-density screen (i.e. most phones). A single ternary-per-prop block is exactly
 * where a stray `{r}` or `detectRetina` would leak from one layer to the other. */
export function MapTiles({ layer = 'plan' }: { layer?: MapLayer }) {
  if (layer === 'satellite') {
    return (
      <TileLayer
        key="satellite"
        url={buildTileUrlTemplate('satellite', TILE_BASE_URL, env.VITE_MAPTILER_KEY)}
        attribution={ATTRIBUTION}
        maxZoom={TILE_LAYER_MAX_ZOOM}
        maxNativeZoom={22}
      />
    )
  }

  return (
    <TileLayer
      key="plan"
      url={buildTileUrlTemplate('plan', TILE_BASE_URL, env.VITE_MAPTILER_KEY)}
      attribution={ATTRIBUTION}
      detectRetina
      tileSize={512}
      zoomOffset={-1}
      maxZoom={TILE_LAYER_MAX_ZOOM}
      maxNativeZoom={20}
    />
  )
}
