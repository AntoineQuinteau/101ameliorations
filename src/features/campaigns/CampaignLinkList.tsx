import { useState } from 'react'
import { Check, Copy, Pencil, QrCode, X } from 'lucide-react'
import { fr } from '../../i18n/fr'
import type { CampaignStat } from '../../types/campaign'
import { linkDescription, useSourceLabel } from './campaignLabels'
import { CampaignLinkFilters } from './CampaignLinkFilters'
import { CampaignQrCode } from './CampaignQrCode'
import { shortUrl } from './campaignTokens'
import { matchesLinkFilters, noLinkFilters, type LinkFilters } from './linkFilters'
import { useCopied } from './useCopied'
import { useUpdateCampaignLink } from './useCampaigns'

const fieldClass =
  'rounded-md border border-neutral-300 px-3 py-2 text-sm focus:border-teal-700 focus:ring-1 focus:ring-teal-700 focus:outline-none'
const buttonClass =
  'inline-flex min-h-11 items-center gap-2 rounded-md border border-neutral-300 px-3 text-sm font-medium disabled:opacity-60'
/** A toggle whose panel is unfolded reads as pressed. */
const openButtonClass = 'border-teal-700 bg-teal-50 text-teal-800'
/** Same rule as the database check on campaign_links.destination. */
const DESTINATION_PATTERN = /^\/(?!\/)[A-Za-z0-9._~%@:,;=+!$&'()*/-]*$/

/** What is unfolded under a link. One at a time for the whole list: with a
 * single QR code on screen, a phone pointed at it cannot scan the wrong one. */
export interface OpenLinkPanel {
  slug: string
  panel: 'qr' | 'settings'
}

/** The links at a glance: each with its short URL to copy and its QR code one
 * click away, unfolded right under it. Deactivated links are hidden until
 * asked for. */
export function CampaignLinkList({
  links,
  open,
  onOpenChange,
}: {
  links: readonly CampaignStat[]
  open: OpenLinkPanel | null
  onOpenChange: (next: OpenLinkPanel | null) => void
}) {
  const [filters, setFilters] = useState<LinkFilters>(noLinkFilters)
  const [showInactive, setShowInactive] = useState(false)

  const inactiveCount = links.filter((row) => !row.isActive).length
  const visible = links.filter(
    (row) => matchesLinkFilters(row, filters) && (showInactive || row.isActive),
  )

  return (
    <section className="flex flex-col gap-3" aria-label={fr.campaigns.list.title}>
      <CampaignLinkFilters links={links} value={filters} onChange={setFilters} />
      {inactiveCount > 0 && (
        <label className="flex min-h-11 w-fit items-center gap-2 text-sm text-neutral-700">
          <input
            type="checkbox"
            checked={showInactive}
            onChange={(event) => setShowInactive(event.target.checked)}
            className="size-4 accent-teal-700"
          />
          {fr.campaigns.list.showInactive(inactiveCount)}
        </label>
      )}

      {visible.length === 0 ? (
        <p className="text-sm text-neutral-500">{fr.campaigns.list.empty}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {visible.map((row) => (
            <li key={row.slug}>
              <LinkRow
                row={row}
                openPanel={open?.slug === row.slug ? open.panel : null}
                onOpenChange={onOpenChange}
              />
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

function LinkRow({
  row,
  openPanel,
  onOpenChange,
}: {
  row: CampaignStat
  openPanel: OpenLinkPanel['panel'] | null
  onOpenChange: (next: OpenLinkPanel | null) => void
}) {
  const labelOf = useSourceLabel()
  const slug = row.slug as string
  const url = shortUrl(window.location.origin, slug)
  const [copied, flashCopied] = useCopied()

  async function copy() {
    try {
      await navigator.clipboard.writeText(url)
      flashCopied()
    } catch {
      // Clipboard blocked: the URL is selectable in the row.
    }
  }

  function toggle(panel: OpenLinkPanel['panel']) {
    onOpenChange(openPanel === panel ? null : { slug, panel })
  }

  return (
    <div
      className={`flex flex-col gap-3 rounded-md border p-3 ${
        openPanel ? 'border-teal-700' : 'border-neutral-200'
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <div className="min-w-0">
          <p className="font-medium break-all text-neutral-900">
            {url}
            {!row.isActive && (
              <span className="ml-2 rounded-full bg-neutral-200 px-2 py-0.5 text-xs font-medium text-neutral-700">
                {fr.campaigns.list.inactive}
              </span>
            )}
          </p>
          <p className="text-sm break-words text-neutral-600">
            {linkDescription(row, labelOf)} · {fr.campaigns.list.scans(row.scans)}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => void copy()} className={buttonClass}>
            {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
            {copied ? fr.campaigns.list.linkCopied : fr.campaigns.list.copyLink}
          </button>
          <button
            type="button"
            onClick={() => toggle('qr')}
            aria-expanded={openPanel === 'qr'}
            className={`${buttonClass} ${openPanel === 'qr' ? openButtonClass : ''}`}
          >
            <QrCode className="size-4" />
            {fr.campaigns.list.showQr}
          </button>
          <button
            type="button"
            onClick={() => toggle('settings')}
            aria-expanded={openPanel === 'settings'}
            className={`${buttonClass} ${openPanel === 'settings' ? openButtonClass : ''}`}
          >
            <Pencil className="size-4" />
            {/* Icon only on a phone, so the three actions stay on one line. */}
            <span className="sr-only sm:not-sr-only">{fr.campaigns.list.edit}</span>
          </button>
        </div>
      </div>

      {openPanel && (
        // Its own close button: pressing the toggle again is not an obvious
        // way out of an unfolded panel.
        <div className="flex items-center justify-between gap-2 border-t border-neutral-200 pt-2">
          <h3 className="text-sm font-semibold text-neutral-900">
            {openPanel === 'qr' ? fr.campaigns.list.showQr : fr.campaigns.list.editTitle}
          </h3>
          <button
            type="button"
            onClick={() => onOpenChange(null)}
            className="inline-flex min-h-11 items-center gap-1 px-2 text-sm text-neutral-600"
          >
            <X className="size-4" />
            {fr.campaigns.list.close}
          </button>
        </div>
      )}
      {openPanel === 'qr' && <CampaignQrCode slug={slug} />}
      {openPanel === 'settings' && <LinkSettings row={row} />}
    </div>
  )
}

/** The only two things that can change on a link: where it leads, and whether
 * it is active. */
function LinkSettings({ row }: { row: CampaignStat }) {
  const update = useUpdateCampaignLink()
  const slug = row.slug as string
  const [destination, setDestination] = useState(row.destination ?? '/')
  const destinationValid = DESTINATION_PATTERN.test(destination) && destination.length <= 200

  function toggleActive() {
    if (row.isActive && !window.confirm(fr.campaigns.list.deactivateConfirm)) return
    update.mutate({ slug, isActive: !row.isActive })
  }

  return (
    <div className="flex flex-col gap-3">
      <form
        className="flex flex-wrap items-end gap-2"
        onSubmit={(event) => {
          event.preventDefault()
          if (destinationValid) update.mutate({ slug, destination })
        }}
      >
        <label className="flex min-w-0 flex-1 flex-col gap-1 text-sm text-neutral-700">
          {fr.campaigns.list.destination}
          <input
            value={destination}
            onChange={(event) => setDestination(event.target.value)}
            aria-invalid={!destinationValid}
            className={fieldClass}
          />
        </label>
        <button
          type="submit"
          disabled={!destinationValid || destination === row.destination || update.isPending}
          className={buttonClass}
        >
          {fr.campaigns.list.saveDestination}
        </button>
      </form>
      {!destinationValid && (
        <p className="text-xs text-red-700">{fr.campaigns.list.destinationInvalid}</p>
      )}

      <button
        type="button"
        onClick={toggleActive}
        disabled={update.isPending}
        className={`${buttonClass} w-fit`}
      >
        {row.isActive ? fr.campaigns.list.deactivate : fr.campaigns.list.activate}
      </button>
      {update.isError && (
        <p role="alert" className="text-sm text-red-700">
          {fr.campaigns.list.updateError}
        </p>
      )}
    </div>
  )
}
