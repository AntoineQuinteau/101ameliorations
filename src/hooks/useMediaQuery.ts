import { useCallback, useSyncExternalStore } from 'react'

/** Whether the CSS media query currently matches. Subscribes to changes
 * rather than reading once, so a rotated tablet or a resized window is picked
 * up. For decisions that must agree with a Tailwind breakpoint but can't be
 * made in CSS alone, e.g. whether to run a query at all. */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const mediaQueryList = window.matchMedia(query)
      mediaQueryList.addEventListener('change', onChange)
      return () => mediaQueryList.removeEventListener('change', onChange)
    },
    [query],
  )

  return useSyncExternalStore(subscribe, () => window.matchMedia(query).matches)
}
