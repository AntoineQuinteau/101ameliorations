import { useRef, type RefObject } from 'react'
import { Link } from 'react-router-dom'
import { Modal } from '../../components/Modal'
import { fr } from '../../i18n/fr'

/** First-visit welcome dialog (spec §6.1): what the site is for, how to report,
 * and why reporting needs an email account. A `Modal`, like `CancelDraftSheet` /
 * `PhotoSourceSheet`.
 *
 * Every way out — the primary button, the login link, Escape, a click on the
 * backdrop — goes through `onClose`; the caller records it as "seen". Focus
 * moves to the title when it opens (`Modal` keeps Tab inside), and closing
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

  function close() {
    onClose()
    returnFocusRef?.current?.focus()
  }

  const t = fr.welcome

  return (
    <Modal
      ariaLabelledBy="welcome-dialog-title"
      onClose={close}
      initialFocusRef={titleRef}
      contentClassName="flex flex-col gap-3 p-4"
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
    </Modal>
  )
}
