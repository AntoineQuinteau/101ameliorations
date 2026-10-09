import { fr } from '../../i18n/fr'
import type { CampaignStat } from '../../types/campaign'
import { sourceLabel } from './campaignLabels'
import { StatCells } from './StatCells'
import { groupStats } from './campaignTokens'

/** Same indicators, rolled up per emitter and per campaign. Includes the
 * attributions that match no link (direct, referral...). */
export function CampaignSummary({ rows }: { rows: readonly CampaignStat[] }) {
  const bySource = groupStats(rows, (row) => row.source)
  const byCampaign = groupStats(rows, (row) => row.campaign)

  return (
    <section className="flex flex-col gap-4" aria-label={fr.campaigns.summary.title}>
      <h2 className="text-base font-semibold text-neutral-900">{fr.campaigns.summary.title}</h2>
      <SummaryGroup
        title={fr.campaigns.summary.bySource}
        groups={bySource.map((g) => ({ ...g, label: sourceLabel(g.key) }))}
      />
      <SummaryGroup
        title={fr.campaigns.summary.byCampaign}
        groups={byCampaign.map((g) => ({ ...g, label: g.key || fr.campaigns.summary.noCampaign }))}
      />
    </section>
  )
}

function SummaryGroup({
  title,
  groups,
}: {
  title: string
  groups: readonly {
    key: string
    label: string
    scans: number
    signups: number
    installs: number
  }[]
}) {
  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-sm font-semibold text-neutral-700">{title}</h3>
      <ul className="flex flex-col gap-2">
        {groups.map((group) => (
          <li key={group.key} className="rounded-md border border-neutral-200 p-3">
            <p className="mb-2 font-medium break-words text-neutral-900">{group.label}</p>
            <StatCells scans={group.scans} signups={group.signups} installs={group.installs} />
          </li>
        ))}
      </ul>
    </div>
  )
}
