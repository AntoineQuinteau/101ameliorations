import { useEffect } from 'react'
import * as Sentry from '@sentry/react'
import { Link, isRouteErrorResponse, useRouteError } from 'react-router-dom'
import { fr } from '../i18n/fr'

/** Root-route error boundary (react-router's `errorElement`): catches any
 * render error that would otherwise leave a blank, silent page — which is
 * exactly what happened before this existed. Reported to Sentry
 * (src/lib/sentry.ts): unlike src/env.ts's own startup throw, this one runs
 * well after Sentry has had the chance to initialize. Safe to call even
 * when no DSN is configured — Sentry's SDK no-ops uninitialized. */
export function AppErrorPage() {
  const error = useRouteError()

  useEffect(() => {
    Sentry.captureException(error)
  }, [error])

  const detail = isRouteErrorResponse(error) ? `${error.status} ${error.statusText}` : undefined

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-2 p-6 text-center">
      <h1 className="text-lg font-semibold text-neutral-900">{fr.errorPage.title}</h1>
      <p className="text-sm text-neutral-500">{fr.errorPage.body}</p>
      {detail && <p className="text-xs text-neutral-400">{detail}</p>}
      <div className="mt-2 flex gap-4">
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="text-sm font-medium text-teal-700 hover:underline"
        >
          {fr.errorPage.reload}
        </button>
        <Link to="/" className="text-sm font-medium text-teal-700 hover:underline">
          {fr.errorPage.backToMap}
        </Link>
      </div>
    </div>
  )
}
