import L from 'leaflet'

export interface PixelRect {
  x: number
  y: number
  width: number
  height: number
}

/** Computes the sub-rectangle of one tile — `tileWidth`×`tileHeight` px, its own top-left
 * corner at `(tileOriginX, tileOriginY)` in some shared pixel space — that falls inside a
 * clip box given in that same pixel space (`clipMinX/Y` is the box's north-west corner,
 * `clipMaxX/Y` its south-east one — smaller `y` is further north, per Leaflet's own pixel
 * convention). The result is in the tile's OWN local coordinates (its top-left corner is
 * `(0, 0)`), ready to hand straight to `CanvasRenderingContext2D.drawImage`. `null` means
 * the tile doesn't overlap the box at all — nothing to draw.
 *
 * Pulled out of `ClippedTileLayerImpl.createTile` (that file's docblock explains why this
 * exists at all) so the actual clipping arithmetic can be unit-tested directly, without a
 * real Leaflet `Map`/DOM/`Image` — this project has no `@testing-library/react` (see
 * `useMapLayer.ts`'s docblock on the same constraint), same reasoning `tileLayerProps.ts`
 * was split out of `MapTiles.tsx` for. */
export function tileClipRect(
  tileOriginX: number,
  tileOriginY: number,
  tileWidth: number,
  tileHeight: number,
  clipMinX: number,
  clipMinY: number,
  clipMaxX: number,
  clipMaxY: number,
): PixelRect | null {
  const x = Math.max(0, clipMinX - tileOriginX)
  const y = Math.max(0, clipMinY - tileOriginY)
  const right = Math.min(tileWidth, clipMaxX - tileOriginX)
  const bottom = Math.min(tileHeight, clipMaxY - tileOriginY)
  const width = right - x
  const height = bottom - y
  if (width <= 0 || height <= 0) return null
  return { x, y, width, height }
}

/** A `TileLayer` whose `bounds` option genuinely clips what's drawn, not just what's
 * requested (spec §6.1 follow-up — IGN fallback country split, `tileProviders.ts`).
 *
 * Leaflet's own `bounds` option does NOT do this: `GridLayer._isValidTile` only checks
 * `toLatLngBounds(this.options.bounds).overlaps(tileBounds)` before deciding whether to
 * request a tile at all — the instant a tile's own (large, at low zoom) rectangle merely
 * *touches* that box, the whole tile is requested and `<TileLayer>`'s stock `createTile`
 * draws it in full, however little of it the box actually covers. Verified against
 * Leaflet's own source (`node_modules/leaflet/dist/leaflet-src.js`, `_isValidTile`), and
 * against the concrete case that surfaced it: the app's own default view (zoom 10,
 * centred on Bayonne) sits on a tile whose rectangle reaches just past
 * `IGN_SPAIN_COAST_BOUNDS`'s edge — under a plain `<TileLayer bounds={...}>`, that one
 * Spain tile (opaque PNOA-MA JPEG, no alpha channel — see `tileProviders.ts`) would have
 * been drawn in full over Bayonne, Biarritz, Anglet and Saint-Jean-de-Luz, the most-used
 * part of the whole service area, on IGN failover or admin override.
 *
 * `createTile` here keeps Leaflet's own request-skipping behaviour (still reads
 * `options.bounds` for that, unchanged), but instead of an `<img>` returns a `<canvas>`
 * the same size as the tile, and draws onto it only the sub-rectangle `tileClipRect`
 * above computes for `options.bounds` at this tile's own position and zoom — everywhere
 * else on the canvas is left untouched, i.e. fully transparent. Never reads the canvas's
 * pixels back (`getImageData`/`toDataURL`/`toBlob`) — only paints it to the screen — so
 * this is safe regardless of whether the tile source answers CORS (an untainted-canvas
 * requirement only applies to *reading* pixel data back out, not to drawing or display),
 * which `tileProviders.ts`'s `crossOrigin` docblock notes is still unconfirmed for IGN. */
// `L.latLngBounds()` has no overload for a single already-`LatLngBoundsExpression`
// argument in `@types/leaflet` — only `(southWest, northEast)` or a corner array. Every
// `TileLayerSpec.bounds` in this codebase is the `[[south, west], [north, east]]` array
// literal form (see `tileProviders.ts`), never a `LatLngBounds` instance, but handle
// both so this doesn't silently break if that ever changes.
function normalizeBounds(bounds: L.LatLngBoundsExpression): L.LatLngBounds {
  return Array.isArray(bounds) ? L.latLngBounds(bounds[0], bounds[1]) : bounds
}

export const ClippedTileLayerImpl = L.TileLayer.extend({
  createTile(this: L.TileLayer, coords: L.Coords, done: L.DoneCallback): HTMLElement {
    const tileSize = this.getTileSize()
    const canvas = document.createElement('canvas')
    canvas.width = tileSize.x
    canvas.height = tileSize.y
    L.DomUtil.addClass(canvas, 'leaflet-tile')

    const map = (this as unknown as { _map: L.Map })._map
    const clipBounds = normalizeBounds(this.options.bounds as L.LatLngBoundsExpression)
    const origin = coords.scaleBy(tileSize)
    const clipNorthWest = map.project(clipBounds.getNorthWest(), coords.z)
    const clipSouthEast = map.project(clipBounds.getSouthEast(), coords.z)

    const rect = tileClipRect(
      origin.x,
      origin.y,
      tileSize.x,
      tileSize.y,
      clipNorthWest.x,
      clipNorthWest.y,
      clipSouthEast.x,
      clipSouthEast.y,
    )
    if (!rect) {
      // Genuinely doesn't overlap this layer's box — leave the canvas blank rather than
      // fetch anything. `options.bounds`'s own overlap-only check (see this class's
      // docblock) can let a tile through that this pixel-accurate one still rejects.
      done(undefined, canvas)
      return canvas
    }

    const image = new Image()
    if (this.options.crossOrigin) image.crossOrigin = 'anonymous'
    image.onload = () => {
      canvas
        .getContext('2d')
        ?.drawImage(
          image,
          rect.x,
          rect.y,
          rect.width,
          rect.height,
          rect.x,
          rect.y,
          rect.width,
          rect.height,
        )
      done(undefined, canvas)
    }
    image.onerror = () => done(new Error(`ClippedTileLayer: failed to load ${image.src}`), canvas)
    image.src = this.getTileUrl(coords)
    return canvas
  },
})

/** `L.TileLayer.extend()` is typed `(props: any) => { new(...): any } & typeof Class` in
 * `@types/leaflet` — there's no way to get a properly-typed constructor straight out of
 * `.extend()` itself. Contains the one cast this needs so nothing else in the codebase
 * has to. `bounds` is required (not just the inherited `TileLayerOptions`'s optional
 * one): unlike a plain `<TileLayer>`, this class always clips to it — see the class's
 * own docblock — so an instance without one would silently draw nothing at all. */
export function createClippedTileLayer(
  url: string,
  options: L.TileLayerOptions & { bounds: L.LatLngBoundsExpression },
): L.TileLayer {
  const Layer = ClippedTileLayerImpl as unknown as new (
    url: string,
    options: L.TileLayerOptions,
  ) => L.TileLayer
  return new Layer(url, options)
}
