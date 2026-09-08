import { fr } from '../i18n/fr'

export function ErrorMessage({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="flex flex-col items-center gap-2 p-6 text-center">
      <p className="text-sm text-red-700">{message}</p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="rounded-md border border-red-300 px-3 py-1 text-sm font-medium text-red-700 hover:bg-red-50"
        >
          {fr.common.retry}
        </button>
      )}
    </div>
  )
}
