import { useEffect, useRef, type KeyboardEvent, type RefObject } from 'react'
import { Link } from 'react-router-dom'
import { useEscapeKey } from '../../hooks/useEscapeKey'
import { fr } from '../../i18n/fr'

/** First-visit welcome dialog (spec §6.1): what the site is for, how to report,
 * and why reporting needs an email account. Modal, on the same shell as
 * `CancelDraftSheet` / `PhotoSourceSheet` (there is no shared modal component).
 *
 * Every way out — the primary button, the login link, Escape, a click on the
 * backdrop — goes through `onClose`; the caller records it as "seen". Focus
 * moves to the title when it opens, Tab is kept inside the dialog, and closing
 * puts focus back on `returnFocusRef` when there is one (the "À propos" button,
 * when the dialog was reopened from there). */
export function WelcomeDialog({
  onClose,
  returnFocusRef,
}: {
  onClose: () => void
  returnFocusRef?: RefObject<HTMLElement | null>
}) {
  const titleRef = useRef<HTMLHeadingElement>(null)
  const dialogRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    titleRef.current?.focus()
  }, [])

  function close() {
    onClose()
    returnFocusRef?.current?.focus()
  }

  useEscapeKey(close)

  // Two focusable elements (button, link) plus the programmatically focused
  // title: wrap Tab / Shift+Tab between the first and last of them.
  function keepFocusInside(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key !== 'Tab' || !dialogRef.current) return
    const focusable = dialogRef.current.querySelectorAll<HTMLElement>('a[href], button')
    const first = focusable[0]
    const last = focusable[focusable.length - 1]
    const active = document.activeElement
    if (event.shiftKey && (active === first || active === titleRef.current)) {
      event.preventDefault()
      last.focus()
    } else if (!event.shiftKey && active === last) {
      event.preventDefault()
      first.focus()
    }
  }

  const t = fr.welcome

  return (
    <div
      className="fixed inset-0 z-[2000] flex items-end justify-center bg-black/50 p-4 sm:items-center"
      onClick={close}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="welcome-dialog-title"
        onClick={(event) => event.stopPropagation()}
        onKeyDown={keepFocusInside}
        className="flex max-h-[calc(100dvh-2rem)] w-full max-w-sm flex-col gap-3 overflow-y-auto rounded-xl bg-white p-4 shadow-lg"
      >
        <h2
          id="welcome-dialog-title"
          ref={titleRef}
          tabIndex={-1}
          className="text-lg font-semibold text-neutral-900 focus:outline-none"
        >
          {t.title}
        </h2>
        <p className="text-sm text-neutral-700">{t.purpose}</p>

        <section>
          <h3 className="text-sm font-semibold text-neutral-900">{t.howToReportTitle}</h3>
          <p className="mt-1 text-sm text-neutral-700">
            {t.howToReport(fr.map.reportWhereIAm, fr.map.reportHere)}
          </p>
        </section>

        <section>
          <h3 className="text-sm font-semibold text-neutral-900">{t.accountTitle}</h3>
          <p className="mt-1 text-sm text-neutral-700">{t.account}</p>
          <p className="mt-1 text-sm text-neutral-600">{t.why}</p>
        </section>

        <button
          type="button"
          onClick={close}
          className="mt-1 inline-flex min-h-11 items-center justify-center rounded-md bg-teal-700 px-3 py-2 text-sm font-medium text-white hover:bg-teal-800"
        >
          {t.close}
        </button>
        <Link
          to="/login"
          onClick={onClose}
          className="inline-flex min-h-11 items-center justify-center rounded-md border border-neutral-300 px-3 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
        >
          {t.login}
        </Link>
      </div>
    </div>
  )
}
