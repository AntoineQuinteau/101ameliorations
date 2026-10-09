import { Link } from 'react-router-dom'
import { ShieldCheck } from 'lucide-react'
import { useDesktopLayout } from '../../hooks/useDesktopLayout'
import { fr } from '../../i18n/fr'
import { useTriageCount } from '../admin/useAdminKlashes'
import { useRole } from '../auth/useRole'
import { mapControlButtonClassName } from './mapControlButtonStyle'
import { triageBadgeText } from './triageBadge'

/** Staff-only floating shortcut to `/admin` (moderator, authority, admin),
 * just under the profile button, with the size of the "à trier" queue as a
 * badge. Renders nothing until the role has resolved, so it never flashes
 * for visitors who don't have it. A `<Link>` styled with
 * `mapControlButtonClassName`, same as `AuthBadge`.
 *
 * Desktop only for now (`useDesktopLayout`: wide viewport and a mouse or
 * trackpad, so not a phone in landscape either): `/admin` isn't laid out for
 * touch devices yet. Rendered only then, rather than hidden with CSS, so the
 * triage count isn't fetched for a badge nobody can see. Hiding the link is cosmetic — `RequireRole` and RLS are what actually
 * gate the page, and the URL still works on mobile. */
export function AdminShortcut() {
  const { isResolved, canAccessAdmin } = useRole()
  const isDesktopLayout = useDesktopLayout()
  const isShown = isResolved && canAccessAdmin && isDesktopLayout
  const { data: count = 0 } = useTriageCount({ enabled: isShown })

  if (!isShown) return null

  const badge = triageBadgeText(count)
  const label = count > 0 ? fr.admin.shortcut.labelWithCount(count) : fr.admin.shortcut.label

  return (
    <Link
      to="/admin"
      aria-label={label}
      title={label}
      className={mapControlButtonClassName({
        className: 'absolute top-16 right-3 z-[1000]',
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
