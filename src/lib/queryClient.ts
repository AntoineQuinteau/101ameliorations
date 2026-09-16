import * as Sentry from '@sentry/react'
import { MutationCache, QueryCache, QueryClient } from '@tanstack/react-query'

// The one place that sees every query/mutation failure in the app, so it's
// also the one place that reports them to Sentry (a no-op without a DSN —
// see src/lib/sentry.ts). Components still get the error through their own
// `isError`/`error` — this doesn't replace that, it just also mirrors
// failures somewhere a person can see them, which nothing did before.
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: false,
    },
  },
  queryCache: new QueryCache({
    onError: (error) => Sentry.captureException(error),
  }),
  mutationCache: new MutationCache({
    onError: (error) => Sentry.captureException(error),
  }),
})
