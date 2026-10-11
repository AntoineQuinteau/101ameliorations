// Must stay first: captures and cleans utm_* before the router reads the URL.
import './features/attribution/captureOnLoad'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import * as Sentry from '@sentry/react'
import { QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider } from 'react-router-dom'
import { AuthProvider } from './features/auth/AuthProvider'
import { queryClient } from './lib/queryClient'
import { initSentry } from './lib/sentry'
import { router } from './router'
import './index.css'

initSentry()

const rootElement = document.getElementById('root')
if (!rootElement) throw new Error('Root element #root not found')

// onCaughtError/onUncaughtError/onRecoverableError (React 19's createRoot
// options) are the only way to reach errors caught by any error boundary
// other than the router's `errorElement` (AppErrorPage reports those itself,
// see src/router.tsx) — without them such errors only reach console.error,
// never Sentry. Sentry.reactErrorHandler() no-ops safely when Sentry isn't
// initialized (no VITE_SENTRY_DSN, see src/lib/sentry.ts), same as every
// other Sentry.* call in this app.
createRoot(rootElement, {
  onCaughtError: Sentry.reactErrorHandler(),
  onUncaughtError: Sentry.reactErrorHandler(),
  onRecoverableError: Sentry.reactErrorHandler(),
}).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <RouterProvider router={router} />
      </AuthProvider>
    </QueryClientProvider>
  </StrictMode>,
)
