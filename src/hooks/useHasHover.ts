import { useMediaQuery } from './useMediaQuery'

/** The media query for a fine pointer that can genuinely hover. */
const HOVER_QUERY = '(hover: hover) and (pointer: fine)'

/** True on a fine-pointer device that can genuinely hover (mouse/trackpad),
 * false on touch. Subscribes to changes rather than reading once: a device
 * with both a touchscreen and a mouse/keyboard attached can switch. */
export function useHasHover(): boolean {
  return useMediaQuery(HOVER_QUERY)
}
