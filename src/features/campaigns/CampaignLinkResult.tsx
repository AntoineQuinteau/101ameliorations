import { useMemo, useState } from 'react'
import { fr } from '../../i18n/fr'
import { downloadBlob, downloadTextFile } from '../../utils/download'
import { shortUrl } from './campaignTokens'
import { qrPngBlob, qrSvg } from './qrCode'

/** The short URL and its QR code, ready to copy / download. The QR encodes the
 * short URL, never the long utm one: the destination can change later without
 * reprinting anything. */
export function CampaignLinkResult({ slug, onClose }: { slug: string; onClose: () => void }) {
  const origin = window.location.origin
  const url = shortUrl(origin, slug)
  const svg = useMemo(() => qrSvg(url), [url])
  const [copied, setCopied] = useState(false)
  const [pngFailed, setPngFailed] = useState(false)
  const isOfficialOrigin = window.location.hostname === '101ameliorations.org'

  async function copy() {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
    } catch {
      // Clipboard blocked: the URL is selectable in the field above.
    }
  }

  async function downloadPng() {
    setPngFailed(false)
    try {
      downloadBlob(`qr-${slug}.png`, await qrPngBlob(url))
    } catch {
      setPngFailed(true)
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

      {!isOfficialOrigin && (
        <p role="note" className="text-sm text-amber-700">
          {fr.campaigns.result.testOrigin(origin)}
        </p>
      )}

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

      <div className="flex flex-col items-start gap-3 sm:flex-row">
        <div
          role="img"
          aria-label={fr.campaigns.result.qrAlt(url)}
          className="size-48 shrink-0 bg-white [&>svg]:size-full"
          dangerouslySetInnerHTML={{ __html: svg }}
        />
        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={() => downloadTextFile(`qr-${slug}.svg`, 'image/svg+xml', svg)}
            className="min-h-11 rounded-md border border-neutral-300 px-3 text-sm font-medium"
          >
            {fr.campaigns.result.downloadSvg}
          </button>
          <button
            type="button"
            onClick={() => void downloadPng()}
            className="min-h-11 rounded-md border border-neutral-300 px-3 text-sm font-medium"
          >
            {fr.campaigns.result.downloadPng}
          </button>
          {pngFailed && (
            <p role="alert" className="text-sm text-red-700">
              {fr.campaigns.result.pngError}
            </p>
          )}
          <p className="text-sm text-neutral-600">{fr.campaigns.result.sizeReminder}</p>
        </div>
      </div>
    </section>
  )
}
