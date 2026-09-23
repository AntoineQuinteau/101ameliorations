import { useNavigate } from 'react-router-dom'
import { fr } from '../../i18n/fr'

/** Surfaces an auto-saved report draft (see
 * `docs/plans/ameliorations-3-brouillon.md`) so leaving `/new` — by
 * accident or on purpose — doesn't lose it silently. `?draft=1` carries no
 * behaviour of its own: `NewKlashPage` restores whatever draft it finds
 * whenever it opens without an explicit `?lat=&lng=`, the same as a bare
 * `/new`; the query param only keeps this navigation distinguishable in the
 * URL/history from other ways of reaching the page. */
export function DraftInProgressChip() {
  const navigate = useNavigate()

  return (
    <button
      type="button"
      onClick={() => navigate('/new?draft=1')}
      className="absolute bottom-28 md:bottom-16 left-1/2 z-[1000] -translate-x-1/2 rounded-full bg-white/90 px-3 py-1.5 text-xs font-medium text-teal-800 shadow hover:bg-white"
    >
      {fr.map.draftInProgress}
    </button>
  )
}
