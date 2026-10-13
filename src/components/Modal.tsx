import { useEffect, useRef, type KeyboardEvent, type ReactNode, type RefObject } from 'react'
import { X } from 'lucide-react'
import { useEscapeKey } from '../hooks/useEscapeKey'
import { fr } from '../i18n/fr'

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

// `sm`: a small prompt, a bottom sheet on phones and centered from `sm` up. `lg`: a
// large content panel, centered at every size.
const SIZES = {
  sm: {
    backdrop: 'items-end p-4 sm:items-center',
    panel: 'max-w-sm max-h-[calc(100dvh-2rem)]',
  },
  lg: {
    backdrop: 'items-center p-2 sm:p-6',
    panel: 'max-w-5xl max-h-[calc(100dvh-1rem)] sm:max-h-[calc(100dvh-3rem)]',
  },
} as const

/** Shared modal shell: dimmed backdrop, centered panel, optional close button, scrolling
 * body. Sibling of the page rather than a portal, like the app's other overlays.
 *
 * Every way out — Escape (see `useEscapeKey`: only the topmost overlay hears it), the
 * close button, a click on the backdrop — goes through `onClose`. A backdrop click only
 * counts when the press started there too, so selecting text in the panel and letting go
 * outside it doesn't close the modal. Focus moves to `initialFocusRef` (the panel itself
 * by default) when it opens and Tab is kept inside the panel. Restoring focus to a
 * control on close is the caller's job, in its `onClose`.
 *
 * `contentClassName` styles the scrolling body (padding, gap…). */
export function Modal({
  ariaLabel,
  ariaLabelledBy,
  onClose,
  size = 'sm',
  closeButton = false,
  initialFocusRef,
  contentClassName = '',
  children,
}: {
  ariaLabel?: string
  ariaLabelledBy?: string
  onClose: () => void
  size?: keyof typeof SIZES
  closeButton?: boolean
  initialFocusRef?: RefObject<HTMLElement | null>
  contentClassName?: string
  children: ReactNode
}) {
  const panelRef = useRef<HTMLDivElement>(null)
  const pressStartedOnBackdrop = useRef(false)

  useEffect(() => {
    ;(initialFocusRef?.current ?? panelRef.current)?.focus()
  }, [initialFocusRef])

  useEscapeKey(onClose)

  // Wraps Tab / Shift+Tab between the first and last focusable elements. The element
  // holding focus on open (the panel, or `initialFocusRef`) counts as "before the first".
  function keepFocusInside(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key !== 'Tab' || !panelRef.current) return
    const focusable = panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE)
    const first = focusable[0]
    const last = focusable[focusable.length - 1]
    if (!first || !last) return
    const active = document.activeElement
    const isBeforeFirst =
      active === first || active === panelRef.current || active === initialFocusRef?.current
    if (event.shiftKey && isBeforeFirst) {
      event.preventDefault()
      last.focus()
    } else if (!event.shiftKey && active === last) {
      event.preventDefault()
      first.focus()
    }
  }

  return (
    <div
      className={`fixed inset-0 z-[2000] flex justify-center bg-black/50 ${SIZES[size].backdrop}`}
      onMouseDown={(event) => {
        pressStartedOnBackdrop.current = event.target === event.currentTarget
      }}
      onClick={(event) => {
        if (pressStartedOnBackdrop.current && event.target === event.currentTarget) onClose()
        pressStartedOnBackdrop.current = false
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel}
        aria-labelledby={ariaLabelledBy}
        tabIndex={-1}
        onKeyDown={keepFocusInside}
        className={`flex w-full flex-col rounded-xl bg-white shadow-lg focus:outline-none ${SIZES[size].panel}`}
      >
        {closeButton && (
          <div className="flex shrink-0 justify-end px-3 pt-3">
            <button
              type="button"
              onClick={onClose}
              aria-label={fr.common.close}
              className="text-neutral-400 hover:text-neutral-600"
            >
              <X className="size-5" />
            </button>
          </div>
        )}
        <div className={`min-h-0 overflow-y-auto ${contentClassName}`.trim()}>{children}</div>
      </div>
    </div>
  )
}
