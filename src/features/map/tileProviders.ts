import type { LatLngBoundsExpression } from 'leaflet'
import { SERVICE_AREA_BBOX } from '../../config/serviceArea'
import { DEFAULT_TILE_BASE_URL, buildTileUrlTemplate, resolveTileKey } from './tileUrls'

/** Which basemap layer is shown. 'cycling' (spec §6.1 follow-up) is an optional overlay
 * highlighting cycling infrastructure — it is always served by CyclOSM regardless of
 * `TileProvider` below, since CyclOSM isn't a MapTiler product and never needs a
 * fallback of its own. */
export type MapLayer = 'plan' | 'satellite' | 'cycling'

/** Which basemap source is active for the 'plan' and 'satellite' layers. 'maptiler' is
 * the default (spec §6.1); 'ign' is the quota-free fallback (France + Spain, see
 * `ignSpecs` below), used either because an admin forced it via
 * `settings.tile_provider` (`useTileProviderSetting`) or because `tileFailover.ts`
 * detected MapTiler is unreachable. */
export type TileProvider = 'maptiler' | 'ign'

/** One `<TileLayer>` worth of props, as an explicit object rather than a shared block of
 * ternaries — same reasoning as the two hand-written `<TileLayer>` blocks this replaces
 * in `MapTiles.tsx` (see that file's docblock): a single ternary-per-prop block is
 * exactly where a stray `{r}` or `detectRetina` would leak from one source or layer to
 * another. Every field a `<TileLayer>` might need is listed explicitly here rather than
 * passed through as `...spec`, so a spec can never smuggle an unreviewed Leaflet prop
 * into the map. */
export interface TileLayerSpec {
  /** Unique across every provider/layer combination — used as the React `key` so
   * react-leaflet tears down and rebuilds the tile grid on a provider or layer switch
   * (react-leaflet reuses the DOM instance and never repaints otherwise). */
  id: string
  url: string
  attribution: string
  maxNativeZoom: number
  tileSize?: number
  zoomOffset?: number
  detectRetina?: boolean
  /** Restricts requests to the area this specific tileset can plausibly answer for — a
   * national IGN service has nothing to say outside its own country. Leaflet skips a
   * tile whose bounds don't intersect this at all, so stacking a France and a Spain
   * layer only ever double-requests the (small, expected) area where both might have
   * data. Padded a little past `SERVICE_AREA_BBOX` rather than clipped exactly to it —
   * the map itself already clamps panning there (`ServiceAreaBounds`), this bounds is a
   * courtesy to these community/public-service-funded tile hosts, not a hard limit. */
  bounds?: LatLngBoundsExpression
  /** Only set on MapTiler specs, and only once their CORS headers are confirmed on a
   * preview (see the tile-edge-proxy follow-up plan) — without a matching
   * `Access-Control-Allow-Origin`, the browser's `<img crossorigin>` request fails
   * outright rather than merely losing the cache optimisation this exists for. Until
   * then, leave unset: `vite.config.ts`'s `cacheableResponse.statuses` covers the
   * opaque-response case for any spec here that doesn't set this. */
  crossOrigin?: 'anonymous'
}

const SERVICE_AREA_PADDING_DEG = 0.2

/** `SERVICE_AREA_BBOX`, padded — see `bounds` above. Shared by every IGN spec (both
 * countries): the app's own viewport never strays far outside the service area anyway
 * (`ServiceAreaBounds` clamps panning), so there is no need to hand-split this by the
 * France/Spain border — that border isn't a straight line, and both national tilesets
 * are simply empty (a normal empty/error tile, not a crash) outside their own country. */
const IGN_BOUNDS: LatLngBoundsExpression = [
  [
    SERVICE_AREA_BBOX.minLat - SERVICE_AREA_PADDING_DEG,
    SERVICE_AREA_BBOX.minLng - SERVICE_AREA_PADDING_DEG,
  ],
  [
    SERVICE_AREA_BBOX.maxLat + SERVICE_AREA_PADDING_DEG,
    SERVICE_AREA_BBOX.maxLng + SERVICE_AREA_PADDING_DEG,
  ],
]

// MapTiler + OpenStreetMap attribution is legally mandated boilerplate, not app copy —
// see the constant this replaces in MapTiles.tsx for why it lives here rather than in
// src/i18n/fr.ts. Both MapTiler layers' TileJSON returns this exact string.
const MAPTILER_ATTRIBUTION =
  '<a href="https://www.maptiler.com/copyright/" target="_blank" rel="noopener">© MapTiler</a> ' +
  '<a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">© OpenStreetMap contributors</a>'

const IGN_FRANCE_ATTRIBUTION =
  '<a href="https://www.ign.fr/" target="_blank" rel="noopener">© IGN</a>'
const IGN_SPAIN_ATTRIBUTION =
  '<a href="https://www.ign.es/" target="_blank" rel="noopener">© Instituto Geográfico Nacional de España</a>'

const CYCLOSM_ATTRIBUTION =
  '<a href="https://www.cyclosm.org/" target="_blank" rel="noopener">© CyclOSM</a> ' +
  '<a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">© OpenStreetMap contributors</a> ' +
  '<a href="https://www.openstreetmap.fr/" target="_blank" rel="noopener">OpenStreetMap France</a>'

/** MapTiler "Streets" raster tiles (spec §6.1) and the satellite tileset
 * (`satellite-v2`) — the exact two layers `MapTiles.tsx` rendered directly before this
 * indirection existed; verified byte-identical by `tileProviders.test.ts`.
 *
 * The two are NOT symmetrical: satellite is served from `/tiles/`, not `/maps/` (the
 * "wrong" path 404s), its grid is 256px with no `tileSize`/`zoomOffset` override (unlike
 * the streets style's 512px grid), and it has no `@2x` retina variant — `detectRetina`
 * on it would blank every tile on a high-density screen (i.e. most phones). */
function maptilerSpecs(
  layer: 'plan' | 'satellite',
  baseUrl: string,
  key: string | undefined,
): TileLayerSpec[] {
  if (layer === 'satellite') {
    return [
      {
        id: 'maptiler-satellite',
        url: buildTileUrlTemplate('satellite', baseUrl, key),
        attribution: MAPTILER_ATTRIBUTION,
        maxNativeZoom: 22,
      },
    ]
  }
  return [
    {
      id: 'maptiler-plan',
      url: buildTileUrlTemplate('plan', baseUrl, key),
      attribution: MAPTILER_ATTRIBUTION,
      detectRetina: true,
      tileSize: 512,
      zoomOffset: -1,
      maxNativeZoom: 20,
    },
  ]
}

/** Quota-free fallback (spec §6.1 follow-up): France via the Géoplateforme (IGN's own
 * successor to wxs.ign.fr, open data since 2021, no key, no documented rate limit on its
 * WMTS tile endpoint specifically) and Spain via IGN España's own WMTS (CC BY 4.0, no
 * key). Two stacked `<TileLayer>`s per app layer, `bounds`-clipped to `IGN_BOUNDS` above
 * so tiles are only ever requested inside the service area.
 *
 * **To confirm on a preview** (not verifiable from this sandbox — see
 * `docs/plans/tile-edge-proxy.md`'s replacement plan for the full list): which of the
 * two layers should render on top at the France/Spain border (whichever one leaves
 * transparent/empty pixels outside its own country, rather than opaque ones, belongs on
 * top) — France is listed first below as a starting guess, swap the order if the border
 * looks wrong; `maxNativeZoom` (19 here, from IGN's own tile matrix docs, for every IGN
 * layer); and whether either host answers CORS (`crossOrigin` on `TileLayerSpec` is left
 * unset here until then — see its docblock). */
function ignSpecs(layer: 'plan' | 'satellite'): TileLayerSpec[] {
  if (layer === 'satellite') {
    return [
      {
        id: 'ign-fr-satellite',
        url: 'https://data.geopf.fr/wmts?SERVICE=WMTS&VERSION=1.0.0&REQUEST=GetTile&LAYER=ORTHOIMAGERY.ORTHOPHOTOS&STYLE=normal&TILEMATRIXSET=PM&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}&FORMAT=image/jpeg',
        attribution: IGN_FRANCE_ATTRIBUTION,
        maxNativeZoom: 19,
        bounds: IGN_BOUNDS,
      },
      {
        id: 'ign-es-satellite',
        url: 'https://www.ign.es/wmts/pnoa-ma?service=WMTS&request=GetTile&version=1.0.0&layer=OI.OrthoimageCoverage&style=default&format=image/jpeg&tilematrixset=GoogleMapsCompatible&TileMatrix={z}&TileRow={y}&TileCol={x}',
        attribution: IGN_SPAIN_ATTRIBUTION,
        maxNativeZoom: 19,
        bounds: IGN_BOUNDS,
      },
    ]
  }
  return [
    {
      id: 'ign-fr-plan',
      url: 'https://data.geopf.fr/wmts?SERVICE=WMTS&VERSION=1.0.0&REQUEST=GetTile&LAYER=GEOGRAPHICALGRIDSYSTEMS.PLANIGNV2&STYLE=normal&TILEMATRIXSET=PM&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}&FORMAT=image/png',
      attribution: IGN_FRANCE_ATTRIBUTION,
      maxNativeZoom: 19,
      bounds: IGN_BOUNDS,
    },
    {
      id: 'ign-es-plan',
      url: 'https://www.ign.es/wmts/ign-base?service=WMTS&request=GetTile&version=1.0.0&layer=IGNBaseTodo&style=default&format=image/png&tilematrixset=GoogleMapsCompatible&TileMatrix={z}&TileRow={y}&TileCol={x}',
      attribution: IGN_SPAIN_ATTRIBUTION,
      maxNativeZoom: 19,
      bounds: IGN_BOUNDS,
    },
  ]
}

/** CyclOSM (spec §6.1 follow-up — optional "Vélo" layer, `MapLayerToggle.tsx`): a raster
 * style built specifically to highlight cycling infrastructure. Community-run
 * (OpenStreetMap France), under the general OSM tile usage policy — normal interactive
 * viewing only, no prefetching (see `vite.config.ts`'s `cyclosm-tiles` cache rule, which
 * deliberately caches only what was actually viewed). Never a MapTiler failover source
 * and never itself has a fallback: it's the one layer nothing else stands in for. */
function cyclingSpecs(): TileLayerSpec[] {
  return [
    {
      id: 'cyclosm',
      url: 'https://{s}.tile-cyclosm.openstreetmap.fr/cyclosm/{z}/{x}/{y}.png',
      attribution: CYCLOSM_ATTRIBUTION,
      maxNativeZoom: 20,
    },
  ]
}

/** The single point every `<MapTiles>` render reads from. Returns the ordered list of
 * `<TileLayer>`s to mount for `layer` under `provider` — one element for a MapTiler
 * layer, two (stacked) for an IGN one, always one for `cycling` regardless of
 * `provider`. `baseUrl`/`key` are only ever consulted for `'maptiler'`: see
 * `resolveTileKey`'s docblock for why the key must never reach a non-MapTiler
 * destination. */
export function tileLayerSpecs(
  provider: TileProvider,
  layer: MapLayer,
  { baseUrl, key }: { baseUrl?: string; key?: string } = {},
): TileLayerSpec[] {
  if (layer === 'cycling') return cyclingSpecs()
  if (provider === 'ign') return ignSpecs(layer)
  const resolvedBaseUrl = baseUrl ?? DEFAULT_TILE_BASE_URL
  return maptilerSpecs(layer, resolvedBaseUrl, resolveTileKey(resolvedBaseUrl, key))
}
