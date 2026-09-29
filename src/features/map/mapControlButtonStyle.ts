/** The look shared by every round floating map control, as a class string —
 * split out from `MapControlButton.tsx` (a pure function, not a component)
 * so that file stays component-only for React Fast Refresh. Consumed by
 * `MapControlButton` itself and by `AuthBadge`, which needs to apply the
 * same look to a `<Link>` (an `<a>`) directly: nesting `MapControlButton`'s
 * `<button>` inside a `<Link>` would produce invalid, inaccessible
 * nested-interactive-elements markup. `variant="solid"` is the white pill
 * every control uses at rest; `variant="active"` is the filled/teal "on"
 * look (currently: the profile button while signed in). */
export function mapControlButtonClassName({
  variant = 'solid',
  className = '',
}: {
  variant?: 'solid' | 'active'
  className?: string
} = {}): string {
  const look =
    variant === 'active'
      ? 'bg-teal-700 text-white hover:bg-teal-800'
      : 'bg-white/90 text-neutral-700 hover:bg-white'

  return `flex h-11 w-11 items-center justify-center rounded-full shadow-md transition-colors disabled:opacity-40 ${look} ${className}`
}
