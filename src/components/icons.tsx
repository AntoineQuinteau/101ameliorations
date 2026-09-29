/** Inline SVG icon set for the floating map controls (spec §6.1 follow-up —
 * maps.me-style icon buttons). Kept as plain inline SVG rather than an icon
 * library: the stack (CLAUDE.md) doesn't include one, and this is a handful
 * of glyphs. Shared visual language: 24×24 viewBox, stroked (not filled),
 * round caps/joins — so every control button reads as one family regardless
 * of which icon it holds. Size is controlled by the caller via `className`
 * (e.g. `h-5 w-5`); color follows `currentColor`, so it inherits the
 * button's text color (see `MapControlButton`). */

type IconProps = { className?: string }

const SHARED_PROPS = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
}

/** Stacked layers — plan/satellite switch (maps.me/Google Maps convention). */
export function LayersIcon({ className }: IconProps) {
  return (
    <svg {...SHARED_PROPS} className={className}>
      <polygon points="12 2 2 7 12 12 22 7 12 2" />
      <polyline points="2 17 12 22 22 17" />
      <polyline points="2 12 12 17 22 12" />
    </svg>
  )
}

/** Funnel — filters. */
export function FilterIcon({ className }: IconProps) {
  return (
    <svg {...SHARED_PROPS} className={className}>
      <polygon points="4 4 20 4 14 12.5 14 19 10 21 10 12.5 4 4" />
    </svg>
  )
}

export function PlusIcon({ className }: IconProps) {
  return (
    <svg {...SHARED_PROPS} className={className}>
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  )
}

export function MinusIcon({ className }: IconProps) {
  return (
    <svg {...SHARED_PROPS} className={className}>
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  )
}

/** Crosshair/target — "locate me" (maps.me convention). */
export function LocateIcon({ className }: IconProps) {
  return (
    <svg {...SHARED_PROPS} className={className}>
      <circle cx="12" cy="12" r="3" />
      <line x1="12" y1="2" x2="12" y2="5" />
      <line x1="12" y1="19" x2="12" y2="22" />
      <line x1="2" y1="12" x2="5" y2="12" />
      <line x1="19" y1="12" x2="22" y2="12" />
    </svg>
  )
}

/** Person — profile / "mon espace". */
export function UserIcon({ className }: IconProps) {
  return (
    <svg {...SHARED_PROPS} className={className}>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7" />
    </svg>
  )
}
