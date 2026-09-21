import { useState } from 'react'
import type { MapLayer } from './MapTiles'

const STORAGE_KEY = 'map-layer'

function isMapLayer(value: unknown): value is MapLayer {
  return value === 'plan' || value === 'satellite'
}

/** Reads the persisted layer choice. Exported (alongside `writeStoredMapLayer`) as a
 * pure function so it can be unit-tested directly — this project has no
 * `@testing-library/react`, so a hook itself can't be rendered in a test. Falls back to
 * `'plan'` on a missing/invalid stored value and on any `localStorage` access failure
 * (thrown in Safari private browsing). */
export function readStoredMapLayer(): MapLayer {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    return isMapLayer(stored) ? stored : 'plan'
  } catch {
    return 'plan'
  }
}

export function writeStoredMapLayer(layer: MapLayer): void {
  try {
    localStorage.setItem(STORAGE_KEY, layer)
  } catch {
    // Safari private browsing throws on write — losing the preference for
    // this session is fine, there's nothing else to fall back to.
  }
}

/** Which map layer (plan/satellite) is active on the main map, on the same model as
 * `useHasHover`: local state initialized from and kept in sync with `localStorage`, so
 * the choice survives a reload without living in the URL (spec follow-up — it's not a
 * results filter, so `filterParams.ts` has no reason to know about it). */
export function useMapLayer(): [MapLayer, (layer: MapLayer) => void] {
  const [layer, setLayerState] = useState<MapLayer>(readStoredMapLayer)

  function setLayer(next: MapLayer) {
    setLayerState(next)
    writeStoredMapLayer(next)
  }

  return [layer, setLayer]
}
