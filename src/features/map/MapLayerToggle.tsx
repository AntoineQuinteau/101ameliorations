import type { MapLayer } from './MapTiles'
import { fr } from '../../i18n/fr'

/** Order matters here: it's the left-to-right button order below. */
const LAYERS: { layer: MapLayer; label: string; switchLabel: string }[] = [
  { layer: 'plan', label: fr.map.layer.plan, switchLabel: fr.map.layer.switchToPlan },
  {
    layer: 'satellite',
    label: fr.map.layer.satellite,
    switchLabel: fr.map.layer.switchToSatellite,
  },
  { layer: 'cycling', label: fr.map.layer.cycling, switchLabel: fr.map.layer.switchToCycling },
]

/** Floating plan/satellite/vélo switch — a sibling of `MapContainer` (`absolute …
 * z-[1000]`), not a Leaflet `L.Control`: the pattern every other floating control on
 * `MapPage` already follows (e.g. the filters button). Sits just above `ZoomControl`
 * (`bottomright`) rather than overlapping it.
 *
 * A 3-way segmented control (spec §6.1 follow-up — the optional CyclOSM "Vélo" layer),
 * not the plan/satellite binary toggle this replaces: same pill-group family as
 * `DesktopFiltersCard.tsx`'s `toggleButtonClass` for the active/inactive colors, inside
 * the same floating-pill shell (`bg-white/90 shadow`) the old single button used. Each
 * button is `min-h-11 min-w-11` (44px) for a comfortable touch target even at three
 * across. */
export function MapLayerToggle({
  layer,
  onChange,
}: {
  layer: MapLayer
  onChange: (layer: MapLayer) => void
}) {
  return (
    <div
      role="group"
      aria-label={fr.map.layer.groupLabel}
      className="absolute bottom-24 right-3 z-[1000] flex gap-1 rounded-full bg-white/90 p-1 shadow"
    >
      {LAYERS.map((option) => {
        const isActive = layer === option.layer
        return (
          <button
            key={option.layer}
            type="button"
            onClick={() => onChange(option.layer)}
            aria-pressed={isActive}
            aria-label={option.switchLabel}
            title={option.switchLabel}
            className={`min-h-11 min-w-11 rounded-full border px-2.5 py-1.5 text-xs font-medium ${
              isActive
                ? 'border-teal-700 bg-teal-50 text-teal-800'
                : 'border-transparent text-neutral-600 hover:bg-neutral-50'
            }`}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}
