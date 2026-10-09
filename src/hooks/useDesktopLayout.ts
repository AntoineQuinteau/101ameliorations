import { useMediaQuery } from './useMediaQuery'

// 48rem is Tailwind's `md` breakpoint. The pointer clause is what keeps a
// phone held in landscape (e.g. 844px wide) or a touch tablet out: width alone
// can't tell them from a small desktop window.
const DESKTOP_LAYOUT_QUERY = '(min-width: 48rem) and (hover: hover) and (pointer: fine)'

/** True on a wide viewport driven by a mouse or trackpad. Used to gate what is
 * only laid out for desktop so far (the `/admin` entry points, whose page isn't
 * adapted to touch devices yet). */
export function useDesktopLayout(): boolean {
  return useMediaQuery(DESKTOP_LAYOUT_QUERY)
}
