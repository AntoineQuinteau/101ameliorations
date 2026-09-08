import { Link } from 'react-router-dom'
import { Badge } from '../../components/Badge'
import { fr } from '../../i18n/fr'
import { statusTone, urgencyTone } from '../../lib/klashPresentation'
import type { Klash } from '../../types/klash'

/** Bottom sheet shown when a marker is tapped: summary + link to the full detail page.
 * Deliberately not a Leaflet popup — mixing Leaflet's own DOM with react-router links
 * inside it is fragile, and a bottom sheet is the better mobile ergonomic anyway. */
export function KlashPreviewCard({ klash, onClose }: { klash: Klash; onClose: () => void }) {
  return (
    <div className="absolute inset-x-0 bottom-0 z-[1000] mx-auto w-full max-w-md p-3 sm:bottom-4">
      <div className="flex flex-col gap-2 rounded-xl bg-white p-4 shadow-lg ring-1 ring-black/5">
        <div className="flex items-start justify-between gap-2">
          <h2 className="text-sm font-semibold text-neutral-900">{klash.title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={fr.common.close}
            className="shrink-0 text-lg leading-none text-neutral-400 hover:text-neutral-600"
          >
            ×
          </button>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <Badge label={fr.category[klash.category]} tone="gray" />
          <Badge label={fr.urgency[klash.urgency]} tone={urgencyTone(klash.urgency)} />
          <Badge label={fr.status[klash.status]} tone={statusTone(klash.status)} />
        </div>
        <p className="text-xs text-neutral-500">
          {fr.map.confirmationsCount(klash.confirmationsCount)}
        </p>
        <Link
          to={`/k/${klash.id}`}
          className="mt-1 inline-flex items-center justify-center rounded-md bg-teal-700 px-3 py-2 text-sm font-medium text-white hover:bg-teal-800"
        >
          {fr.map.viewDetail}
        </Link>
      </div>
    </div>
  )
}
