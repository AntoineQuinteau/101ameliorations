import { Link } from 'react-router-dom'
import { fr } from '../../i18n/fr'
import { useAuth } from '../auth/useAuth'
import { useProfile } from '../auth/useProfile'

/** Floating logged-in/out affordance. Renders nothing while auth is still
 * resolving, to avoid flashing "Se connecter" before swapping to "Mon
 * espace" a moment later. */
export function AuthBadge() {
  const { user, isInitializing } = useAuth()
  const { data: profile } = useProfile()

  if (isInitializing) return null

  if (!user) {
    return (
      <Link
        to="/login"
        className="absolute top-3 right-3 z-[1000] rounded-full bg-white/90 px-3 py-1 text-xs font-medium text-teal-700 shadow hover:bg-white"
      >
        {fr.auth.signIn}
      </Link>
    )
  }

  return (
    <Link
      to="/me"
      className="absolute top-3 right-3 z-[1000] rounded-full bg-white/90 px-3 py-1 text-xs font-medium text-teal-700 shadow hover:bg-white"
    >
      {profile?.displayName ?? fr.auth.mySpace}
    </Link>
  )
}
