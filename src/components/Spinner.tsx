import { fr } from '../i18n/fr'

export function Spinner() {
  return (
    <div role="status" className="flex items-center justify-center gap-2 p-6 text-neutral-500">
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-neutral-300 border-t-teal-700" />
      <span className="text-sm">{fr.common.loading}</span>
    </div>
  )
}
