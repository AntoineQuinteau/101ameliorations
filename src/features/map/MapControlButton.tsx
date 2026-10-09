import { mapControlButtonClassName } from './mapControlButtonStyle'

/** Shared visual shell for the round, icon-only floating map controls (layer
 * switch, filters, zoom, locate) — spec §6.1 follow-up. A sibling
 * of `MapContainer`, not a Leaflet `L.Control` (same pattern as every other
 * floating control on the map, e.g. the old filters pill): keeps taps
 * outside Leaflet's control-click suppression, so they don't interfere with
 * `MapClickToReport`. See `mapControlButtonClassName` for the profile
 * button's link variant and for what `shape` does. Positioning is left to
 * the caller (each control sits in a different spot). */
export function MapControlButton({
  label,
  onClick,
  pressed,
  disabled,
  variant = 'solid',
  shape = 'circle',
  className = '',
  ref,
  children,
}: {
  label: string
  onClick?: () => void
  pressed?: boolean
  disabled?: boolean
  variant?: 'solid' | 'active'
  shape?: 'circle' | 'pill-top' | 'pill-bottom'
  className?: string
  /** Lets the owner focus the button later (React 19: `ref` is a plain prop). */
  ref?: React.Ref<HTMLButtonElement>
  children: React.ReactNode
}) {
  return (
    <button
      ref={ref}
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={pressed}
      aria-label={label}
      title={label}
      className={mapControlButtonClassName({ variant, shape, className })}
    >
      {children}
    </button>
  )
}
