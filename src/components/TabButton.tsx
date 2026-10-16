import type { ReactNode } from 'react'

/** One tab of a page's tab row (`/admin`, `/campaigns`).
 *
 * The focus ring is drawn inset: the tab row scrolls horizontally, which clips
 * an outline painted outside the button (same reason as the map controls, see
 * `mapControlButtonClassName`). */
export function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`min-h-11 border-b-2 px-3 py-2 text-sm font-medium whitespace-nowrap focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-teal-700 ${
        active
          ? 'border-teal-700 text-teal-700'
          : 'border-transparent text-neutral-500 hover:text-neutral-700'
      }`}
    >
      {children}
    </button>
  )
}
