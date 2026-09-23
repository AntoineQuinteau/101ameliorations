import { Link } from 'react-router-dom'
import { Badge } from '../../components/Badge'
import { BottomSheet } from '../../components/BottomSheet'
import { fr } from '../../i18n/fr'
import { statusTone, importanceTone } from '../../lib/klashPresentation'
import { klashCategoryLabel, type Klash } from '../../types/klash'

/** Bottom sheet shown for a klash: summary, and (unless `interactive` is false) a close
 * button and a link to the full detail page. Deliberately not a Leaflet popup — mixing
 * Leaflet's own DOM with react-router links inside it is fragile, and a bottom sheet is
 * the better mobile ergonomic anyway.
 *
 * `interactive={false}` is for the desktop hover preview: it closes on its own once the
 * pointer leaves the marker (see `ClusteredKlashMarkers`'s `onHover`), and a click on the
 * marker itself already navigates straight to the detail page — so neither a close
 * button nor a "voir le détail" link serves a purpose there. Mobile's tap-to-open card
 * keeps both (`interactive` defaults to true). */
export function KlashPreviewCard({
  klash,
  onClose,
  interactive = true,
}: {
  klash: Klash
  onClose: () => void
  interactive?: boolean
}) {
  return (
    <BottomSheet>
      <div className="flex flex-col gap-2">
        <div className="flex items-start justify-between gap-2">
          <h2 className="text-sm font-semibold text-neutral-900">{klash.title}</h2>
          {interactive && (
            <button
              type="button"
              onClick={onClose}
              aria-label={fr.common.close}
              className="shrink-0 text-lg leading-none text-neutral-400 hover:text-neutral-600"
            >
              ×
            </button>
          )}
        </div>
        <div className="flex flex-wrap gap-1.5">
          <Badge label={klashCategoryLabel(klash)} tone="gray" />
          <Badge
            label={fr.importanceBadge[klash.importance]}
            tone={importanceTone(klash.importance)}
          />
          <Badge label={fr.status[klash.status]} tone={statusTone(klash.status)} />
        </div>
        <p className="text-xs text-neutral-500">
          {fr.map.confirmationsCount(klash.confirmationsCount)}
        </p>
        {interactive && (
          <Link
            to={`/k/${klash.id}`}
            className="mt-1 inline-flex items-center justify-center rounded-md bg-teal-700 px-3 py-2 text-sm font-medium text-white hover:bg-teal-800"
          >
            {fr.map.viewDetail}
          </Link>
        )}
      </div>
    </BottomSheet>
  )
}
