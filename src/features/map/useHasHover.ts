import { useEffect, useState } from 'react'

const QUERY = '(hover: hover) and (pointer: fine)'

/** True on a fine-pointer device that can genuinely hover (mouse/trackpad),
 * false on touch. Subscribes to changes rather than reading once: a device
 * with both a touchscreen and a mouse/keyboard attached can switch. */
export function useHasHover(): boolean {
  const [hasHover, setHasHover] = useState(() => window.matchMedia(QUERY).matches)

  useEffect(() => {
    const mediaQueryList = window.matchMedia(QUERY)
    const onChange = () => setHasHover(mediaQueryList.matches)
    mediaQueryList.addEventListener('change', onChange)
    return () => mediaQueryList.removeEventListener('change', onChange)
  }, [])

  return hasHover
}
