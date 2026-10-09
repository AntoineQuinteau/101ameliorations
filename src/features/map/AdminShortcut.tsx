import { Link } from 'react-router-dom'
import { ShieldCheck } from 'lucide-react'
import { fr } from '../../i18n/fr'
import { useTriageQueue } from '../admin/useAdminKlashes'
import { useRole } from '../auth/useRole'
import { mapControlButtonClassName } from './mapControlButtonStyle'
import { triageBadgeText } from './triageBadge'

/** Staff-only floating shortcut to `/admin` (moderator, authority, admin),
 * just under the profile button, with the size of the "à trier" queue as a
 * badge. Renders nothing until the role has resolved, so it never flashes
 * for visitors who don't have it. A `<Link>` styled with
 * `mapControlButtonClassName`, same as `AuthBadge`.
 *
 * Desktop only for now (`hidden md:flex`): `/admin` isn't laid out for small
 * screens yet. Hiding the link is cosmetic — `RequireRole` and RLS are what
 * actually gate the page, and the URL still works on mobile. */
export function AdminShortcut() {
  const { isResolved, canAccessAdmin } = useRole()
  const { data: triageQueue } = useTriageQueue({ enabled: canAccessAdmin })

  if (!isResolved || !canAccessAdmin) return null

  const count = triageQueue?.length ?? 0
  const badge = triageBadgeText(count)
  const label = count > 0 ? fr.admin.shortcut.labelWithCount(count) : fr.admin.shortcut.label

  return (
    <Link
      to="/admin"
      aria-label={label}
      title={label}
      className={mapControlButtonClassName({
        className: 'absolute top-16 right-3 z-[1000] hidden md:flex',
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
