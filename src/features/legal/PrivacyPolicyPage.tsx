import { Link } from 'react-router-dom'
import { fr } from '../../i18n/fr'

/** Politique de confidentialité (spec §9 step 9). Documents what §2 requires
 * be disclosed here specifically: the get_klash_author_contact lookup and
 * its audit trail (fr.legal.privacy.whoSeesWhat). */
export function PrivacyPolicyPage() {
  const t = fr.legal.privacy

  return (
    <div className="mx-auto max-w-xl px-4 py-4">
      <Link to="/" className="text-sm font-medium text-teal-700 hover:underline">
        {fr.common.backToMap}
      </Link>

      <h1 className="mt-4 text-xl font-semibold text-neutral-900">{t.title}</h1>
      <p className="mt-2 text-sm text-neutral-700">{t.intro}</p>

      <section className="mt-6">
        <h2 className="text-sm font-semibold text-neutral-900">{t.dataCollected.heading}</h2>
        <ul className="mt-2 flex list-disc flex-col gap-1 pl-4 text-sm text-neutral-700">
          {t.dataCollected.body.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      </section>

      <section className="mt-6">
        <h2 className="text-sm font-semibold text-neutral-900">{t.whoSeesWhat.heading}</h2>
        <ul className="mt-2 flex list-disc flex-col gap-1 pl-4 text-sm text-neutral-700">
          {t.whoSeesWhat.body.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      </section>

      <section className="mt-6">
        <h2 className="text-sm font-semibold text-neutral-900">{t.retention.heading}</h2>
        <ul className="mt-2 flex list-disc flex-col gap-1 pl-4 text-sm text-neutral-700">
          {t.retention.body.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      </section>

      <section className="mt-6">
        <h2 className="text-sm font-semibold text-neutral-900">{t.rights.heading}</h2>
        <p className="mt-2 text-sm text-neutral-700">{t.rights.body}</p>
      </section>

      <section className="mt-6">
        <h2 className="text-sm font-semibold text-neutral-900">{t.hosting.heading}</h2>
        <ul className="mt-2 flex list-disc flex-col gap-1 pl-4 text-sm text-neutral-700">
          {t.hosting.body.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      </section>
    </div>
  )
}
