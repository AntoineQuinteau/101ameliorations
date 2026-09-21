import type { MapLayer } from './MapTiles'
import { fr } from '../../i18n/fr'

/** Floating plan/satellite switch — a sibling of `MapContainer` (`absolute … z-[1000]`),
 * not a Leaflet `L.Control`: the pattern every other floating control on `MapPage`
 * already follows (e.g. the filters button). Sits just above `ZoomControl`
 * (`bottomright`) rather than overlapping it. */
export function MapLayerToggle({
  layer,
  onChange,
}: {
  layer: MapLayer
  onChange: (layer: MapLayer) => void
}) {
  const isSatellite = layer === 'satellite'
  const label = isSatellite ? fr.map.layer.switchToPlan : fr.map.layer.switchToSatellite

  return (
    <button
      type="button"
      onClick={() => onChange(isSatellite ? 'plan' : 'satellite')}
      aria-pressed={isSatellite}
      aria-label={label}
      title={label}
      className="absolute bottom-24 right-3 z-[1000] rounded-full bg-white/90 px-3 py-1.5 text-xs font-medium text-neutral-700 shadow hover:bg-white"
    >
      {isSatellite ? fr.map.layer.plan : fr.map.layer.satellite}
    </button>
  )
}
