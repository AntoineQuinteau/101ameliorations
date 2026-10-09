import { Link } from 'react-router-dom'
import { ShieldCheck } from 'lucide-react'
import { fr } from '../../i18n/fr'
import { useTriageCount } from '../admin/useAdminKlashes'
import { useShowAdminEntryPoints } from '../auth/useShowAdminEntryPoints'
import { mapControlButtonClassName } from './mapControlButtonStyle'
import { triageBadgeText } from './triageBadge'

/** Staff-only floating shortcut to `/admin` (moderator, authority, admin),
 * just under the profile button, with the size of the "à trier" queue as a
 * badge. A `<Link>` styled with `mapControlButtonClassName`, same as
 * `AuthBadge`.
 *
 * Whether it shows is `useShowAdminEntryPoints` (staff role, resolved). It is
 * rendered only then, rather than hidden with CSS, so the triage count isn't
 * fetched for visitors who would never see the badge. The one CSS exception is
 * the short-window rule below, where a staff member's count is fetched while
 * the button is hidden. */
export function AdminShortcut() {
  const isShown = useShowAdminEntryPoints()
  const { data: count = 0 } = useTriageCount({ enabled: isShown })

  if (!isShown) return null

  const badge = triageBadgeText(count)
  const label = count > 0 ? fr.admin.shortcut.labelWithCount(count) : fr.admin.title

  return (
    <Link
      to="/admin"
      aria-label={label}
      title={label}
      className={mapControlButtonClassName({
        // Hidden below 25rem of height: the vertically centred zoom/locate
        // column on the same edge rises into this band on windows that short.
        className: 'absolute top-16 right-3 z-[1000] [@media(max-height:25rem)]:hidden',
      })}
    >
      <ShieldCheck className="size-5" />
      {badge && (
        <span
          aria-hidden
          className="absolute -top-1 -right-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-teal-700 px-1 text-[11px] font-semibold text-white ring-2 ring-white"
        >
          {badge}
        </span>
      )}
    </Link>
  )
}
