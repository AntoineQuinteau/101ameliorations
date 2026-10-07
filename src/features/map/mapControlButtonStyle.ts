/** The look shared by every round floating map control, as a class string —
 * split out from `MapControlButton.tsx` (a pure function, not a component)
 * so that file stays component-only for React Fast Refresh. Consumed by
 * `MapControlButton` itself and by `AuthBadge`, which needs to apply the
 * same look to a `<Link>` (an `<a>`) directly: nesting `MapControlButton`'s
 * `<button>` inside a `<Link>` would produce invalid, inaccessible
 * nested-interactive-elements markup. `variant="solid"` is the white pill
 * every control uses at rest; `variant="active"` is the filled/teal "on"
 * look (currently: the profile button while signed in).
 *
 * `shape` picks which of the two Tailwind utilities this emits for corners
 * and shadow, rather than always emitting `rounded-full shadow-md` and
 * leaving a caller to override them via `className` (as
 * `MapZoomLocateControls`' zoom buttons used to): two classes that both set
 * the same CSS property conflict in a way that depends on the order
 * Tailwind happens to generate them in, not the order they're written in a
 * template string, so that override wasn't guaranteed to win. `'circle'`
 * (the default) is every standalone control; `'pill-top'`/`'pill-bottom'`
 * are a stacked pair sharing one pill shell (its own shadow, not each
 * button's), e.g. the zoom in/out pair. The pair's own rounded ends aren't
 * redundant with the shell's `overflow-hidden rounded-full`: they're what
 * gives each button's focus ring the pill's outline.
 *
 * The focus ring is drawn inset (`-outline-offset-2`) on purpose: the
 * browser's default outline sits outside the button, where the zoom pair's
 * `overflow-hidden` shell clips it away, leaving keyboard focus on "+"/"−"
 * effectively invisible. Applied to every control, not just the pair, so
 * they all show the same inset ring. */
export function mapControlButtonClassName({
  variant = 'solid',
  shape = 'circle',
  className = '',
}: {
  variant?: 'solid' | 'active'
  shape?: 'circle' | 'pill-top' | 'pill-bottom'
  className?: string
} = {}): string {
  // The ring's colour is part of the look: teal on the white controls, white
  // on the teal "active" one, where a teal ring would be invisible.
  const look =
    variant === 'active'
      ? 'bg-teal-700 text-white hover:bg-teal-800 focus-visible:outline-white'
      : 'bg-white/90 text-neutral-700 hover:bg-white focus-visible:outline-teal-700'

  const corners =
    shape === 'circle'
      ? 'rounded-full shadow-md'
      : shape === 'pill-top'
        ? 'rounded-t-full'
        : 'rounded-b-full'

  return `flex h-11 w-11 items-center justify-center ${corners} transition-colors focus-visible:outline-2 focus-visible:-outline-offset-2 disabled:opacity-40 ${look} ${className}`
}
