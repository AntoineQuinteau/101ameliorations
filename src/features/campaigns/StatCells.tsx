import { fr } from '../../i18n/fr'
import { conversionRate, formatRate, type StatTotals } from './campaignTokens'

/** The shared indicator block: three counters and the two conversion rates
 * between the funnel's steps. */
export function StatCells({ scans, signups, installs }: StatTotals) {
  return (
    <dl className="grid grid-cols-3 gap-2 text-sm">
      <Cell label={fr.campaigns.stats.scans} value={scans} />
      <Cell label={fr.campaigns.stats.signups} value={signups} />
      <Cell label={fr.campaigns.stats.installs} value={installs} />
      <Cell
        label={fr.campaigns.stats.scansToSignups}
        value={formatRate(conversionRate(signups, scans))}
      />
      <Cell
        label={fr.campaigns.stats.signupsToInstalls}
        value={formatRate(conversionRate(installs, signups))}
      />
    </dl>
  )
}

function Cell({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="flex flex-col">
      <dt className="text-xs text-neutral-500">{label}</dt>
      <dd className="font-medium text-neutral-900">{value}</dd>
    </div>
  )
}
