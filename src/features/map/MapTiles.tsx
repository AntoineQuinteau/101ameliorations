import { TileLayer } from 'react-leaflet'
import { env } from '../../env'

// MapTiler + OpenStreetMap attribution is legally mandated boilerplate, not app copy —
// kept here rather than in src/i18n/fr.ts.
const ATTRIBUTION =
  '<a href="https://www.maptiler.com/copyright/" target="_blank" rel="noopener">© MapTiler</a> ' +
  '<a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">© OpenStreetMap contributors</a>'

/** MapTiler "Streets" raster tiles (spec §6.1). `{r}` + `detectRetina` request @2x tiles
 * on high-density screens; `tileSize`/`zoomOffset` match MapTiler's 512px tile grid to
 * standard Leaflet zoom levels. */
export function MapTiles() {
  return (
    <TileLayer
      url={`https://api.maptiler.com/maps/streets-v2/{z}/{x}/{y}{r}.png?key=${env.VITE_MAPTILER_KEY}`}
      attribution={ATTRIBUTION}
      detectRetina
      tileSize={512}
      zoomOffset={-1}
    />
  )
}
