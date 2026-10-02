import { fr } from '../i18n/fr'
import { BackToMapLink } from './BackToMapLink'

export function NotFoundPage() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-2 p-6 text-center">
      <h1 className="text-lg font-semibold text-neutral-900">{fr.notFound.title}</h1>
      <p className="text-sm text-neutral-500">{fr.notFound.body}</p>
      <BackToMapLink className="mt-2" />
    </div>
  )
}
