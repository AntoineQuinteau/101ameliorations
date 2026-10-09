import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { ChevronRight, X } from 'lucide-react'
import { BottomSheet } from '../../components/BottomSheet'
import { fr } from '../../i18n/fr'

const ROWS = [
  { to: '/export', label: fr.about.export.label, hint: fr.about.export.hint },
  { to: '/mentions-legales', label: fr.about.legalNotice.label, hint: null },
  { to: '/confidentialite', label: fr.about.privacy.label, hint: null },
] as const

/** "À propos" sheet (spec §6.1): the one place the map keeps its secondary
 * links — the public data export (§6.7) and the legal/privacy pages — so they
 * stay one tap away without taking up the bottom of the screen. A
 * `BottomSheet` like the map's other panels; Escape closes it. */
export function AboutSheet({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  return (
    <BottomSheet>
      <div className="flex items-start justify-between gap-3">
        <h2 className="text-lg font-semibold text-neutral-900">{fr.about.title}</h2>
        <button
          type="button"
          onClick={onClose}
          aria-label={fr.about.close}
          className="shrink-0 text-neutral-400 hover:text-neutral-600"
        >
          <X className="size-5" />
        </button>
      </div>
      <p className="mt-1 text-sm text-neutral-600">{fr.about.description}</p>

      <ul className="mt-3 flex flex-col divide-y divide-neutral-200 rounded-md border border-neutral-200">
        {ROWS.map((row) => (
          <li key={row.to}>
            <Link
              to={row.to}
              className="flex items-center justify-between gap-3 px-3 py-3 text-sm font-medium text-neutral-800 hover:bg-neutral-50"
            >
              <span>
                {row.label}
                {row.hint && (
                  <span className="ml-2 text-xs font-normal text-neutral-500">{row.hint}</span>
                )}
              </span>
              <ChevronRight className="size-4 shrink-0 text-neutral-400" aria-hidden />
            </Link>
          </li>
        ))}
      </ul>
    </BottomSheet>
  )
}
