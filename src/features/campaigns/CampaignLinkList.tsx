import { useState } from 'react'
import { fr } from '../../i18n/fr'
import type { CampaignStat } from '../../types/campaign'
import { sourceLabel } from './campaignLabels'
import { StatCells } from './StatCells'
import { shortUrl } from './campaignTokens'
import { useUpdateCampaignLink } from './useCampaigns'

const fieldClass =
  'rounded-md border border-neutral-300 px-3 py-2 text-sm focus:border-teal-700 focus:ring-1 focus:ring-teal-700 focus:outline-none'
/** Same rule as the database check on campaign_links.destination. */
const DESTINATION_PATTERN = /^\/(?!\/)[A-Za-z0-9._~%@:,;=+!$&'()*/-]*$/

/** Links, filterable by campaign and by emitter, each with its funnel. */
export function CampaignLinkList({
  rows,
  onShowQr,
}: {
  rows: readonly CampaignStat[]
  onShowQr: (slug: string) => void
}) {
  const links = rows.filter((row) => row.slug !== null)
  const campaigns = [...new Set(links.map((row) => row.campaign))]
  const sources = [...new Set(links.map((row) => row.source))]
  const [campaign, setCampaign] = useState('')
  const [source, setSource] = useState('')

  const visible = links.filter(
    (row) => (!campaign || row.campaign === campaign) && (!source || row.source === source),
  )

  return (
    <section className="flex flex-col gap-3" aria-label={fr.campaigns.list.title}>
      <h2 className="text-base font-semibold text-neutral-900">{fr.campaigns.list.title}</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm text-neutral-700">
          {fr.campaigns.list.filterCampaign}
          <select
            value={campaign}
            onChange={(e) => setCampaign(e.target.value)}
            className={fieldClass}
          >
            <option value="">{fr.campaigns.list.all}</option>
            {campaigns.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm text-neutral-700">
          {fr.campaigns.list.filterSource}
          <select value={source} onChange={(e) => setSource(e.target.value)} className={fieldClass}>
            <option value="">{fr.campaigns.list.allSources}</option>
            {sources.map((value) => (
              <option key={value} value={value}>
                {sourceLabel(value)}
              </option>
            ))}
          </select>
        </label>
      </div>

      {visible.length === 0 ? (
        <p className="text-sm text-neutral-500">{fr.campaigns.list.empty}</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {visible.map((row) => (
            <li key={row.slug}>
              <LinkCard row={row} onShowQr={onShowQr} />
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

function LinkCard({ row, onShowQr }: { row: CampaignStat; onShowQr: (slug: string) => void }) {
  const update = useUpdateCampaignLink()
  const slug = row.slug as string
  const [destination, setDestination] = useState(row.destination ?? '/')
  const destinationValid = DESTINATION_PATTERN.test(destination) && destination.length <= 200

  function toggleActive() {
    if (row.isActive && !window.confirm(fr.campaigns.list.deactivateConfirm)) return
    update.mutate({ slug, isActive: !row.isActive })
  }

  return (
    <div className="flex flex-col gap-3 rounded-md border border-neutral-200 p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-medium break-all text-neutral-900">
            {shortUrl(window.location.origin, slug)}
          </p>
          <p className="text-sm break-words text-neutral-600">
            {sourceLabel(row.source)} ·{' '}
            {row.medium ? fr.campaigns.medium[row.medium as keyof typeof fr.campaigns.medium] : ''}{' '}
            · {row.campaign} · {row.content || fr.campaigns.list.noContent}
          </p>
        </div>
        <span
          className={`rounded-full px-2 py-0.5 text-xs font-medium ${
            row.isActive ? 'bg-teal-100 text-teal-800' : 'bg-neutral-200 text-neutral-700'
          }`}
        >
          {row.isActive ? fr.campaigns.list.active : fr.campaigns.list.inactive}
        </span>
      </div>

      <StatCells scans={row.scans} signups={row.signups} installs={row.installs} />

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
          className="min-h-11 rounded-md border border-neutral-300 px-3 text-sm font-medium disabled:opacity-60"
        >
          {fr.campaigns.list.saveDestination}
        </button>
      </form>
      {!destinationValid && (
        <p className="text-xs text-red-700">{fr.campaigns.list.destinationInvalid}</p>
      )}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => onShowQr(slug)}
          className="min-h-11 rounded-md border border-neutral-300 px-3 text-sm font-medium"
        >
          {fr.campaigns.list.showQr}
        </button>
        <button
          type="button"
          onClick={toggleActive}
          disabled={update.isPending}
          className="min-h-11 rounded-md border border-neutral-300 px-3 text-sm font-medium disabled:opacity-60"
        >
          {row.isActive ? fr.campaigns.list.deactivate : fr.campaigns.list.activate}
        </button>
      </div>
      {update.isError && (
        <p role="alert" className="text-sm text-red-700">
          {fr.campaigns.list.updateError}
        </p>
      )}
    </div>
  )
}
