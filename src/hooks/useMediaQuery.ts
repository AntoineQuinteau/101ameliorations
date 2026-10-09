import { useEffect, useState } from 'react'

/** Whether the CSS media query currently matches. Subscribes to changes
 * rather than reading once, so a rotated tablet or a resized window is picked
 * up. For decisions that must agree with a Tailwind breakpoint but can't be
 * made in CSS alone, e.g. whether to run a query at all. */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches)

  useEffect(() => {
    const mediaQueryList = window.matchMedia(query)
    const onChange = () => setMatches(mediaQueryList.matches)
    onChange()
    mediaQueryList.addEventListener('change', onChange)
    return () => mediaQueryList.removeEventListener('change', onChange)
  }, [query])

  return matches
}
