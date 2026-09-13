import { fr } from '../../i18n/fr'

/** Bottom sheet shown after a candidate point is picked on the map (click or
 * long-press, spec §6.1): confirm to go to `/new` at that point, or dismiss.
 * Same "sibling of MapContainer, not a Leaflet popup" pattern as
 * `KlashPreviewCard`. */
export function PinConfirmCard({
  onConfirm,
  onCancel,
}: {
  onConfirm: () => void
  onCancel: () => void
}) {
  return (
    <div className="absolute inset-x-0 bottom-0 z-[1000] mx-auto w-full max-w-md p-3 sm:bottom-4">
      <div className="flex items-center justify-between gap-3 rounded-xl bg-white p-4 shadow-lg ring-1 ring-black/5">
        <button
          type="button"
          onClick={onCancel}
          aria-label={fr.common.close}
          className="shrink-0 text-lg leading-none text-neutral-400 hover:text-neutral-600"
        >
          ×
        </button>
        <button
          type="button"
          onClick={onConfirm}
          className="flex-1 inline-flex items-center justify-center rounded-md bg-teal-700 px-3 py-2 text-sm font-medium text-white hover:bg-teal-800"
        >
          {fr.map.reportHere}
        </button>
      </div>
    </div>
  )
}
