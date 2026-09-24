import { useEffect } from 'react'
import { useMap } from 'react-leaflet'
import type { LatLngBoundsExpression } from 'leaflet'
import { createClippedTileLayer } from './tileClip'
import type { tileLayerProps } from './tileLayerProps'

type Props = ReturnType<typeof tileLayerProps> & { bounds: LatLngBoundsExpression }

/** The `bounds`-clipping counterpart of react-leaflet's own `<TileLayer>` (`tileClip.ts`
 * explains why a plain one can't do this) — same props (`tileLayerProps.ts`'s shape,
 * `bounds` just narrowed from optional to required), used in `MapTiles.tsx` only for the
 * IGN specs that actually set one.
 *
 * Doesn't go through `@react-leaflet/core`'s generic layer-component factory the way
 * react-leaflet's own components do: that's an internal package of react-leaflet, not
 * this project's own dependency, and `MapTiles.tsx` already remounts a whole new
 * `<TileLayer>`/`<ClippedTileLayer>` (via `key={spec.id}`) on every provider/layer
 * change rather than diffing props onto a live instance — so this only ever needs to
 * mount a layer once and remove it once, never update one in place. Reads `map` and the
 * props it was first mounted with once, on mount, and never again — a real prop change
 * here is always a different `spec.id` and therefore a full remount already, exactly
 * like `MapTiles.tsx`'s own docblock on the same `key`. */
export function ClippedTileLayer({ url, ...options }: Props) {
  const map = useMap()

  useEffect(() => {
    const layer = createClippedTileLayer(url, options)
    layer.addTo(map)
    return () => {
      layer.remove()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- see docblock: intentional mount-once
  }, [])

  return null
}
