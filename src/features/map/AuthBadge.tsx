import { Link } from 'react-router-dom'
import { UserIcon } from '../../components/icons'
import { fr } from '../../i18n/fr'
import { useAuth } from '../auth/useAuth'
import { mapControlButtonClassName } from './mapControlButtonStyle'

/** Floating logged-in/out affordance. Renders nothing while auth is still
 * resolving, to avoid flashing "Se connecter" before swapping to "Mon
 * espace" a moment later. Same round icon-button look as the other floating
 * controls (spec §6.1 follow-up, via `mapControlButtonClassName` — not
 * `MapControlButton` itself, since this needs to be a real `<a>` for
 * routing/accessibility, and a `<button>` can't nest inside one); the two
 * auth states share the icon and are told apart by fill — teal when signed
 * in, white otherwise — rather than by different icons. The accessible name
 * still carries the state (`fr.auth.mySpace`/`signIn`), not just
 * `fr.map.controls.profile`, so e2e specs asserting on that text
 * (e.g. "Se connecter") keep working. */
export function AuthBadge() {
  const { user, isInitializing } = useAuth()

  if (isInitializing) return null

  const label = user ? fr.auth.mySpace : fr.auth.signIn

  return (
    <Link
      to={user ? '/me' : '/login'}
      aria-label={label}
      title={label}
      className={mapControlButtonClassName({
        variant: user ? 'active' : 'solid',
        className: 'absolute top-3 right-3 z-[1000]',
      })}
    >
      <UserIcon className="h-5 w-5" />
    </Link>
  )
}
