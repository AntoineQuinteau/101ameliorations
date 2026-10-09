import { ArrowLeft } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { fr } from '../i18n/fr'

/** "Retour" link shared by every secondary page, so the icon, spacing and label stay
 * identical everywhere. Goes back to the previous in-app page when there is one, so
 * `?next=` and any other query string of that page are preserved; otherwise (first page
 * of the tab, e.g. a deep link) falls back to the map. Keeps a real `href="/"` so opening
 * it in a new tab still lands on the map. */
export function BackLink({ className = '' }: { className?: string }) {
  const navigate = useNavigate()

  function handleClick(event: React.MouseEvent<HTMLAnchorElement>) {
    if (!hasPreviousInAppEntry()) return
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

/** React Router's browser history numbers its entries in `history.state.idx`, starting
 * at 0 on the first page the app loaded. Unlike `location.key !== 'default'`, this
 * stays 0 after a `<Navigate replace>` redirect (e.g. RequireAuth sending a deep link
 * to `/login`) or a `replace: true` search-param update, where going back would leave
 * the app. */
function hasPreviousInAppEntry(): boolean {
  const state: unknown = window.history.state
  if (typeof state !== 'object' || state === null || !('idx' in state)) return false
  return typeof state.idx === 'number' && state.idx > 0
}
