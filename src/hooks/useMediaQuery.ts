import { useCallback, useMemo, useSyncExternalStore } from 'react'

/** Whether the CSS media query currently matches. Subscribes to changes
 * rather than reading once, so a rotated tablet or a resized window is picked
 * up. For decisions that must agree with a Tailwind breakpoint but can't be
 * made in CSS alone, e.g. whether to run a query at all. */
export function useMediaQuery(query: string): boolean {
  // One MediaQueryList per query, shared by subscribe and the snapshot read
  // that React makes on every render.
  const mediaQueryList = useMemo(() => window.matchMedia(query), [query])

  const subscribe = useCallback(
    (onChange: () => void) => {
      mediaQueryList.addEventListener('change', onChange)
      return () => mediaQueryList.removeEventListener('change', onChange)
    },
    [mediaQueryList],
  )

  return useSyncExternalStore(subscribe, () => mediaQueryList.matches)
}
