import { Link } from 'react-router-dom'
import { fr } from '../i18n/fr'
import { ArrowLeft } from 'lucide-react'

export function NotFoundPage() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-2 p-6 text-center">
      <h1 className="text-lg font-semibold text-neutral-900">{fr.notFound.title}</h1>
      <p className="text-sm text-neutral-500">{fr.notFound.body}</p>
      <Link
        to="/"
        className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-teal-700 hover:underline"
      >
        <ArrowLeft aria-hidden className="size-4" />
        {fr.common.backToMap}
      </Link>
    </div>
  )
}
