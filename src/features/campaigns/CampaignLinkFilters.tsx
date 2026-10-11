import { fr } from '../../i18n/fr'
import type { CampaignStat } from '../../types/campaign'
import { sourceLabel } from './campaignLabels'
import type { LinkFilters } from './linkFilters'

const fieldClass =
  'rounded-md border border-neutral-300 px-3 py-2 text-sm focus:border-teal-700 focus:ring-1 focus:ring-teal-700 focus:outline-none'

/** Campaign and emitter filters, offering only the values `links` holds. */
export function CampaignLinkFilters({
  links,
  value,
  onChange,
}: {
  links: readonly CampaignStat[]
  value: LinkFilters
  onChange: (next: LinkFilters) => void
}) {
  const campaigns = [...new Set(links.map((row) => row.campaign))]
  const sources = [...new Set(links.map((row) => row.source))]

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <label className="flex flex-col gap-1 text-sm text-neutral-700">
        {fr.campaigns.filters.campaign}
        <select
          value={value.campaign}
          onChange={(event) => onChange({ ...value, campaign: event.target.value })}
          className={fieldClass}
        >
          <option value="">{fr.campaigns.filters.allCampaigns}</option>
          {campaigns.map((campaign) => (
            <option key={campaign} value={campaign}>
              {campaign}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-sm text-neutral-700">
        {fr.campaigns.filters.source}
        <select
          value={value.source}
          onChange={(event) => onChange({ ...value, source: event.target.value })}
          className={fieldClass}
        >
          <option value="">{fr.campaigns.filters.allSources}</option>
          {sources.map((source) => (
            <option key={source} value={source}>
              {sourceLabel(source)}
            </option>
          ))}
        </select>
      </label>
    </div>
  )
}
