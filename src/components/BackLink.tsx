import { ArrowLeft } from 'lucide-react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { fr } from '../i18n/fr'

/** "Retour" link shared by every secondary page, so the icon, spacing and label stay
 * identical everywhere. Goes back to the previous in-app page when there is one
 * (`location.key` is 'default' only for the first entry of the session, e.g. a deep link
 * or a reload), so `?next=` and any other query string of that page are preserved;
 * otherwise falls back to the map. Keeps a real `href="/"` so opening it in a new tab
 * still lands on the map. */
export function BackLink({ className = '' }: { className?: string }) {
  const location = useLocation()
  const navigate = useNavigate()
  const hasPreviousPage = location.key !== 'default'

  function handleClick(event: React.MouseEvent<HTMLAnchorElement>) {
    if (!hasPreviousPage) return
    // Modified clicks (new tab / window) keep the plain link behaviour.
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
      return
    }
    event.preventDefault()
    navigate(-1)
  }

  return (
    <Link
      to="/"
      onClick={handleClick}
      className={`inline-flex items-center gap-1 text-sm font-medium text-teal-700 hover:underline ${className}`.trim()}
    >
      <ArrowLeft className="size-4" />
      {fr.common.back}
    </Link>
  )
}
