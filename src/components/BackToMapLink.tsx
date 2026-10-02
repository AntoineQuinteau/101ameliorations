import { ArrowLeft } from 'lucide-react'
import { Link } from 'react-router-dom'
import { fr } from '../i18n/fr'

/** "Retour à la carte" link shared by every secondary page, so the icon, spacing and
 * label stay identical everywhere. */
export function BackToMapLink({ className = '' }: { className?: string }) {
  return (
    <Link
      to="/"
      className={`inline-flex items-center gap-1 text-sm font-medium text-teal-700 hover:underline ${className}`.trim()}
    >
      <ArrowLeft className="size-4" />
      {fr.common.backToMap}
    </Link>
  )
}
