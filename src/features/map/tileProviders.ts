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
  /** Restricts requests — and, critically, *rendering* — to the area this specific
   * tileset can plausibly answer for: a national IGN service has nothing to say outside
   * its own country, and Leaflet skips a tile whose bounds don't intersect this at all.
   * On the three stacked IGN layers (`ignSpecs` below) this is not just a request-count
   * courtesy: whichever layer mounts later draws on top of the earlier ones *everywhere
   * their bounds overlap*, so a shared, wide `bounds` would let the later one's opaque
   * tiles hide the earlier one's real data across the whole overlap — and, the other way
   * round, giving a layer a `bounds` that doesn't reach some of the area it should cover
   * means that area gets no tiles from it at all, not merely a lower z-order. Three
   * rounds of review on this exact code each found a real instance of one of those two
   * failure modes (see `IGN_SPAIN_COAST_BOUNDS`'s docblock) — this isn't a hypothetical. */
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

const SERVICE_AREA_WEST_LNG = SERVICE_AREA_BBOX.minLng - SERVICE_AREA_PADDING_DEG
const SERVICE_AREA_EAST_LNG = SERVICE_AREA_BBOX.maxLng + SERVICE_AREA_PADDING_DEG
const SERVICE_AREA_SOUTH_LAT = SERVICE_AREA_BBOX.minLat - SERVICE_AREA_PADDING_DEG
const SERVICE_AREA_NORTH_LAT = SERVICE_AREA_BBOX.maxLat + SERVICE_AREA_PADDING_DEG

/** Covers the whole padded service area — France's real territory here spans nearly
 * the full height of `SERVICE_AREA_BBOX` (see `IGN_SPAIN_COAST_BOUNDS`'s docblock for
 * why that rules out separating the two countries by latitude alone), so this layer is
 * mounted first (see `ignSpecs`) and simply always requested everywhere; only the two
 * `IGN_SPAIN_*_BOUNDS` below are what keep Spain's layers, drawn on top of this one,
 * from covering real French territory. */
const IGN_FRANCE_BOUNDS: LatLngBoundsExpression = [
  [SERVICE_AREA_SOUTH_LAT, SERVICE_AREA_WEST_LNG],
  [SERVICE_AREA_NORTH_LAT, SERVICE_AREA_EAST_LNG],
]

// The France/Spain border through the western Pyrenees isn't a straight line, so this is
// necessarily an approximation, not a geodata-accurate split.
//
// Three rounds of review on this exact code each found a real bug from trying to model
// it with a single axis-aligned box: narrowing only Spain's box (an earlier version)
// left the two overlapping across a whole latitude band, with Spain (mounted second,
// drawn on top) covering genuinely French towns inside it — Pau, Oloron, Mauléon,
// Saint-Jean-Pied-de-Port. Narrowing France's box to match swapped that for the
// opposite bug: a coverage gap over that same band. A single 2D corner (one latitude
// limit, one longitude limit — a prior version of this file) fixed both of those, but
// was still too coarse in a different way: with a longitude limit loose enough to reach
// Pamplona (-1.64°E, deep in Navarre), the SAME box also swallowed the entire populated
// French Basque coast and interior at similar longitudes but further north — Saint-
// Jean-de-Luz, Ciboure, Urrugne, Ascain, Sare, Saint-Pée-sur-Nivelle, Espelette, Cambo-
// les-Bains, Itxassou. Not a borderline call: PNOA-MA (the Spanish satellite tileset) is
// JPEG, a format with no alpha channel at all, so a tile it returns outside real Spanish
// coverage is unconditionally opaque — those towns would have shown Spanish no-data
// imagery over real, populated parts of the service area.
//
// The reason a single box can't do this: the coastal Spanish towns (Irun, Hondarribia,
// San Sebastián) and the French Basque interior towns above sit at OVERLAPPING
// longitudes but different latitudes, while Pamplona sits at an overlapping longitude
// with those SAME French towns but a much lower latitude. No single (latitude,
// longitude) corner threshold can include Irun and Pamplona while excluding Saint-Jean-
// de-Luz through Cambo-les-Bains — the three don't line up on one diagonal. Two
// separate corners, one tight to the coast and one further south and looser, do:
//   - `IGN_SPAIN_COAST_BOUNDS`: a narrow coastal strip (longitude ≤ -1.75°E, close to
//     the Hendaye/Irun crossing itself) — catches San Sebastián (43.32°N, -1.98°E),
//     Irun (43.34°N, -1.79°E), Hondarribia (43.37°N, -1.79°E), while Saint-Jean-de-Luz
//     (-1.66°E), Ciboure, Urrugne (-1.70°E) and everything east of them fall outside it.
//   - `IGN_SPAIN_INTERIOR_BOUNDS`: reaches further east (longitude ≤ -1.3°E, wide
//     enough for Pamplona at -1.64°E) but only south of 43.1°N — well south of Bidarray
//     (43.24°N), the southernmost of the French interior towns above, so none of them
//     are reachable by the wider longitude limit.
//   - Both are still checked against every town named above and in every prior round,
//     by `tileProviders.test.ts`.
//
// Residual, and still not fixable by any pair of rectangles: Hendaye (France, ~43.36°N,
// ~-1.77°E) still falls inside `IGN_SPAIN_COAST_BOUNDS` — it and Irun sit at essentially
// the same (latitude, longitude) on opposite banks of the Bidasoa, so no axis-aligned
// box can separate that one coastal crossing. Also residual: Navarra east of
// `IGN_SPAIN_INTERIOR_BOUNDS`'s longitude limit (e.g. the Roncal valley) gets no IGN
// layer at all — accepted, as in prior rounds, for being very sparsely populated, unlike
// every town this round's fix corrects for. Fully resolving either needs confirming, on
// a live preview (not this sandbox), that one layer renders genuinely transparent
// outside its own coverage and ordering accordingly, or clipping to a real border
// polygon instead of rectangles.
const SPAIN_COAST_LAT_LIMIT = 43.4
const SPAIN_COAST_LNG_LIMIT = -1.75
const SPAIN_INTERIOR_LAT_LIMIT = 43.1
const SPAIN_INTERIOR_LNG_LIMIT = -1.3

/** See the block comment above — the narrow coastal corner of `IGN_SPAIN_*_BOUNDS`'s
 * two-box split. Mounted second (see `ignSpecs`), so drawn on top of
 * `IGN_FRANCE_BOUNDS` above only inside this box. */
const IGN_SPAIN_COAST_BOUNDS: LatLngBoundsExpression = [
  [SERVICE_AREA_SOUTH_LAT, SERVICE_AREA_WEST_LNG],
  [SPAIN_COAST_LAT_LIMIT, SPAIN_COAST_LNG_LIMIT],
]

/** See the block comment above — the wider, further-south interior (Navarre) corner of
 * `IGN_SPAIN_*_BOUNDS`'s two-box split. Mounted third (see `ignSpecs`), on top of both
 * `IGN_FRANCE_BOUNDS` and `IGN_SPAIN_COAST_BOUNDS` — harmless where it overlaps the
 * latter, since both are Spain. */
const IGN_SPAIN_INTERIOR_BOUNDS: LatLngBoundsExpression = [
  [SERVICE_AREA_SOUTH_LAT, SERVICE_AREA_WEST_LNG],
  [SPAIN_INTERIOR_LAT_LIMIT, SPAIN_INTERIOR_LNG_LIMIT],
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
 * key). Three stacked `<TileLayer>`s per app layer, same URL and attribution reused
 * across Spain's two: France (`IGN_FRANCE_BOUNDS`, the whole service area) mounted
 * first, then Spain's coastal corner (`IGN_SPAIN_COAST_BOUNDS`) and interior corner
 * (`IGN_SPAIN_INTERIOR_BOUNDS`) — see that pair's docblock for why Spain needs two
 * corners, not one. Each later layer draws on top of the earlier ones only inside its
 * own bounds — Leaflet stacks same-pane tile layers in mount order, so a layer without
 * its own narrow bounds would draw over the real tiles beneath it everywhere the two
 * overlap, not just at the actual border.
 *
 * **To confirm on a preview** (not verifiable from this sandbox — see
 * `docs/plans/tile-edge-proxy.md`'s replacement plan for the full list):
 * `maxNativeZoom` (19 here, from IGN's own tile matrix docs, for every IGN layer); and
 * whether either host answers CORS (`crossOrigin` on `TileLayerSpec` is left unset here
 * until then — see its docblock). */
function ignSpecs(layer: 'plan' | 'satellite'): TileLayerSpec[] {
  if (layer === 'satellite') {
    const spainUrl =
      'https://www.ign.es/wmts/pnoa-ma?service=WMTS&request=GetTile&version=1.0.0&layer=OI.OrthoimageCoverage&style=default&format=image/jpeg&tilematrixset=GoogleMapsCompatible&TileMatrix={z}&TileRow={y}&TileCol={x}'
    return [
      {
        id: 'ign-fr-satellite',
        url: 'https://data.geopf.fr/wmts?SERVICE=WMTS&VERSION=1.0.0&REQUEST=GetTile&LAYER=ORTHOIMAGERY.ORTHOPHOTOS&STYLE=normal&TILEMATRIXSET=PM&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}&FORMAT=image/jpeg',
        attribution: IGN_FRANCE_ATTRIBUTION,
        maxNativeZoom: 19,
        bounds: IGN_FRANCE_BOUNDS,
      },
      {
        id: 'ign-es-coast-satellite',
        url: spainUrl,
        attribution: IGN_SPAIN_ATTRIBUTION,
        maxNativeZoom: 19,
        bounds: IGN_SPAIN_COAST_BOUNDS,
      },
      {
        id: 'ign-es-interior-satellite',
        url: spainUrl,
        attribution: IGN_SPAIN_ATTRIBUTION,
        maxNativeZoom: 19,
        bounds: IGN_SPAIN_INTERIOR_BOUNDS,
      },
    ]
  }
  const spainUrl =
    'https://www.ign.es/wmts/ign-base?service=WMTS&request=GetTile&version=1.0.0&layer=IGNBaseTodo&style=default&format=image/png&tilematrixset=GoogleMapsCompatible&TileMatrix={z}&TileRow={y}&TileCol={x}'
  return [
    {
      id: 'ign-fr-plan',
      url: 'https://data.geopf.fr/wmts?SERVICE=WMTS&VERSION=1.0.0&REQUEST=GetTile&LAYER=GEOGRAPHICALGRIDSYSTEMS.PLANIGNV2&STYLE=normal&TILEMATRIXSET=PM&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}&FORMAT=image/png',
      attribution: IGN_FRANCE_ATTRIBUTION,
      maxNativeZoom: 19,
      bounds: IGN_FRANCE_BOUNDS,
    },
    {
      id: 'ign-es-coast-plan',
      url: spainUrl,
      attribution: IGN_SPAIN_ATTRIBUTION,
      maxNativeZoom: 19,
      bounds: IGN_SPAIN_COAST_BOUNDS,
    },
    {
      id: 'ign-es-interior-plan',
      url: spainUrl,
      attribution: IGN_SPAIN_ATTRIBUTION,
      maxNativeZoom: 19,
      bounds: IGN_SPAIN_INTERIOR_BOUNDS,
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
