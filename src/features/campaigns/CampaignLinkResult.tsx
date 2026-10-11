import { fr } from '../../i18n/fr'
import { CampaignQrCode } from './CampaignQrCode'
import { shortUrl } from './campaignTokens'
import { useCopied } from './useCopied'

/** Shown right under the form once a link is created: its short URL and its
 * QR code, ready to copy / download. */
export function CampaignLinkResult({ slug, onClose }: { slug: string; onClose: () => void }) {
  const url = shortUrl(window.location.origin, slug)
  const [copied, flashCopied] = useCopied()

  async function copy() {
    try {
      await navigator.clipboard.writeText(url)
      flashCopied()
    } catch {
      // Clipboard blocked: the URL is selectable in the field above.
    }
  }

  return (
    <section
      aria-label={fr.campaigns.result.title}
      className="flex flex-col gap-3 rounded-md border border-teal-700 p-3"
    >
      <div className="flex items-start justify-between gap-2">
        <h2 className="text-base font-semibold text-neutral-900">{fr.campaigns.result.title}</h2>
        <button type="button" onClick={onClose} className="min-h-11 px-2 text-sm text-neutral-600">
          {fr.campaigns.result.close}
        </button>
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="campaign-short-url" className="text-sm text-neutral-700">
          {fr.campaigns.result.shortUrl}
        </label>
        <div className="flex gap-2">
          <input
            id="campaign-short-url"
            readOnly
            value={url}
            onFocus={(event) => event.target.select()}
            className="min-w-0 flex-1 rounded-md border border-neutral-300 px-3 py-2 text-sm"
          />
          <button
            type="button"
            onClick={() => void copy()}
            className="min-h-11 rounded-md border border-neutral-300 px-3 text-sm font-medium"
          >
            {copied ? fr.campaigns.result.copied : fr.campaigns.result.copy}
          </button>
        </div>
      </div>

      <CampaignQrCode slug={slug} />
    </section>
  )
}
