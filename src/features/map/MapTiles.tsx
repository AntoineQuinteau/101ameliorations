import { TileLayer } from 'react-leaflet'
import { env } from '../../env'

// MapTiler + OpenStreetMap attribution is legally mandated boilerplate, not app copy —
// kept here rather than in src/i18n/fr.ts.
const ATTRIBUTION =
  '<a href="https://www.maptiler.com/copyright/" target="_blank" rel="noopener">© MapTiler</a> ' +
  '<a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">© OpenStreetMap contributors</a>'

/** MapTiler "Streets" raster tiles (spec §6.1). `{r}` + `detectRetina` request @2x tiles
 * on high-density screens; `tileSize`/`zoomOffset` match MapTiler's 512px tile grid to
 * standard Leaflet zoom levels.
 *
 * `maxZoom` is set well above the map's own `maxZoom` (18) rather than left
 * at TileLayer's own default (also 18): during a pinch gesture, Leaflet's
 * touch-zoom handler moves the map with an unclamped, unrounded zoom value
 * every frame (`bounceAtZoomLimits` only clamps at gesture end), so a fast
 * pinch briefly reports e.g. zoom 19-20. GridLayer._setView compares that
 * rounded value against the *TileLayer's* maxZoom (not the map's) and, if it
 * overshoots, sets its internal tile zoom to `undefined` — which blanks every
 * tile until the next valid zoom/pan event, sometimes never arriving on its
 * own. maxNativeZoom stays at the map's real max so Leaflet still requests
 * tiles from MapTiler no higher than zoom 18 and just re-scales them for any
 * (transient) zoom above that, instead of dropping them. */
export function MapTiles() {
  return (
    <TileLayer
      url={`https://api.maptiler.com/maps/streets-v2/{z}/{x}/{y}{r}.png?key=${env.VITE_MAPTILER_KEY}`}
      attribution={ATTRIBUTION}
      detectRetina
      tileSize={512}
      zoomOffset={-1}
      maxZoom={24}
      maxNativeZoom={18}
    />
  )
}
