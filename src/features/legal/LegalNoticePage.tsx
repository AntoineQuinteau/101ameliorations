import { Link } from 'react-router-dom'
import { fr } from '../../i18n/fr'

/** Mentions légales (spec §9 step 9): required for a public French site.
 * Identity fields (association name, SIRET, address, publication director)
 * are TODO placeholders in fr.legal.notice — see src/i18n/fr.ts. */
export function LegalNoticePage() {
  const t = fr.legal.notice

  return (
    <div className="mx-auto max-w-xl px-4 py-4">
      <Link to="/" className="text-sm font-medium text-teal-700 hover:underline">
        {fr.common.backToMap}
      </Link>

      <h1 className="mt-4 text-xl font-semibold text-neutral-900">{t.title}</h1>

      <section className="mt-6">
        <h2 className="text-sm font-semibold text-neutral-900">{t.publisher.heading}</h2>
        <ul className="mt-2 flex flex-col gap-1 text-sm text-neutral-700">
          {t.publisher.body.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      </section>

      <section className="mt-6">
        <h2 className="text-sm font-semibold text-neutral-900">{t.publicationDirector.heading}</h2>
        <p className="mt-2 text-sm text-neutral-700">{t.publicationDirector.body}</p>
      </section>

      <section className="mt-6">
        <h2 className="text-sm font-semibold text-neutral-900">{t.hosting.heading}</h2>
        <ul className="mt-2 flex flex-col gap-1 text-sm text-neutral-700">
          {t.hosting.body.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      </section>

      <section className="mt-6">
        <h2 className="text-sm font-semibold text-neutral-900">{t.accessibility.heading}</h2>
        <p className="mt-2 text-sm text-neutral-700">{t.accessibility.body}</p>
      </section>
    </div>
  )
}
