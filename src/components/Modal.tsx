import { useEffect, useRef, type ReactNode } from 'react'
import { X } from 'lucide-react'
import { useEscapeKey } from '../hooks/useEscapeKey'
import { fr } from '../i18n/fr'

/** Generic centered modal: dimmed backdrop, close button, scrolling body. Closes on
 * Escape (see `useEscapeKey`: only the topmost overlay), the close button, or a click on
 * the backdrop. No focus trap of its own — the caller makes the page behind `inert`. */
export function Modal({
  label,
  onClose,
  children,
}: {
  label: string
  onClose: () => void
  children: ReactNode
}) {
  const panelRef = useRef<HTMLDivElement>(null)
  const pressStartedOnBackdrop = useRef(false)

  useEffect(() => {
    panelRef.current?.focus()
  }, [])

  useEscapeKey(onClose)

  // Both the press and the release must land on the backdrop: selecting text in the
  // panel and letting go outside it must not close the modal.
  return (
    <div
      className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/50 p-2 sm:p-6"
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
        aria-label={label}
        tabIndex={-1}
        className="flex max-h-[calc(100dvh-1rem)] w-full max-w-5xl flex-col rounded-xl bg-white shadow-lg focus:outline-none sm:max-h-[calc(100dvh-3rem)]"
      >
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
        <div className="min-h-0 overflow-y-auto">{children}</div>
      </div>
    </div>
  )
}
