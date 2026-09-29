import { LayersIcon } from '../../components/icons'
import { fr } from '../../i18n/fr'
import { MapControlButton } from './MapControlButton'
import type { MapLayer } from './MapTiles'

/** Floating plan/satellite switch — a sibling of `MapContainer` (`absolute … z-[1000]`),
 * not a Leaflet `L.Control`: the pattern every other floating control on `MapPage`
 * already follows. Top-left, the maps.me/Google Maps convention for this control;
 * `MapZoomLocateControls` and (on `MapPage`) the filters button are positioned
 * around it. A direct plan ↔ satellite toggle rather than a picker modal — with
 * only two layers, one tap beats a modal for a binary choice; this can grow into a
 * picker the day a third layer is added, without moving the button. */
export function MapLayerToggle({
  layer,
  onChange,
  className = 'absolute top-3 left-3 z-[1000]',
}: {
  layer: MapLayer
  onChange: (layer: MapLayer) => void
  className?: string
}) {
  const isSatellite = layer === 'satellite'
  const label = isSatellite ? fr.map.layer.switchToPlan : fr.map.layer.switchToSatellite

  return (
    <MapControlButton
      label={label}
      onClick={() => onChange(isSatellite ? 'plan' : 'satellite')}
      pressed={isSatellite}
      className={className}
    >
      <LayersIcon className="h-5 w-5" />
    </MapControlButton>
  )
}
