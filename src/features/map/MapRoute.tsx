import { useLocation, useMatch } from 'react-router-dom'
import { KlashDetailModal } from '../klash/KlashDetailModal'
import { KlashDetailPage } from '../klash/KlashDetailPage'
import { isKlashOverlayState } from '../klash/klashOverlay'
import { MapPage } from './MapPage'

/** Element of the `/` and `/k/:id` routes. `/k/:id` is the full detail page, except when
 * the desktop marker click flagged the navigation (see `KLASH_OVERLAY_STATE`): then the
 * map stays mounted and the detail opens in a modal over it. `MapPage` sits at the same
 * position in the `/` and the modal renders, which is what keeps it (and Leaflet)
 * mounted across the navigation. `useMatch` rather than `useParams`: a layout route
 * doesn't see its child's params. */
export function MapRoute() {
  const klashId = useMatch('/k/:id')?.params.id
  const { state } = useLocation()
  const isOverlay = klashId !== undefined && isKlashOverlayState(state)

  if (klashId !== undefined && !isOverlay) return <KlashDetailPage klashId={klashId} />
  return (
    <>
      <MapPage isKlashOverlayOpen={isOverlay} />
      {isOverlay && <KlashDetailModal key={klashId} klashId={klashId} />}
    </>
  )
}
