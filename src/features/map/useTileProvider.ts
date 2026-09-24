import { useTileProviderSetting } from '../../config/useTileProviderSetting'
import { useTileFailover } from './tileFailover'
import type { TileProvider } from './tileProviders'

/** The single source `MapTiles.tsx` renders from: `'ign'` when an admin forced it
 * (`settings.tile_provider`, `useTileProviderSetting`) OR this device detected MapTiler
 * is unreachable (`tileFailover.ts`, `useTileFailover`); `'maptiler'` otherwise. Either
 * condition alone is enough to switch — there's no scenario where both would need to
 * hold for the map to fail over. */
export function useTileProvider(): TileProvider {
  const setting = useTileProviderSetting()
  const failedOver = useTileFailover()
  return setting === 'ign' || failedOver ? 'ign' : 'maptiler'
}
