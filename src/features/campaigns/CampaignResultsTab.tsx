import { useState } from 'react'
import { Spinner } from '../../components/Spinner'
import { fr } from '../../i18n/fr'
import type { AttributionTouch } from '../../types/campaign'
import { linkDescription, useSourceLabel } from './campaignLabels'
import { CampaignLinkFilters } from './CampaignLinkFilters'
import {
  conversionRate,
  formatAverage,
  formatRate,
  groupStats,
  type StatTotals,
} from './campaignTokens'
import { matchesLinkFilters, noLinkFilters, type LinkFilters } from './linkFilters'
import { useCampaignStats } from './useCampaigns'

/** `/campaigns` "Résultats" tab, read-only: scans → sign-ups → installs → klashes and
 * the conversion rates and klashes per sign-up, per emitter, per campaign and per link. The first
 * two include the attributions that match no link (direct, referral...). */
export function CampaignResultsTab() {
  const [touch, setTouch] = useState<AttributionTouch>('first')
  const [filters, setFilters] = useState<LinkFilters>(noLinkFilters)
  const stats = useCampaignStats(touch)
  const labelOf = useSourceLabel()

  const rows = stats.data ?? []
  const links = rows.filter((row) => row.slug !== null)

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <label className="flex flex-wrap items-center gap-2 text-sm text-neutral-700">
          {fr.campaigns.touch.label}
          <select
            value={touch}
            onChange={(event) => setTouch(event.target.value as AttributionTouch)}
            className="rounded-md border border-neutral-300 px-3 py-2 text-sm"
          >
            <option value="first">{fr.campaigns.touch.first}</option>
            <option value="last">{fr.campaigns.touch.last}</option>
          </select>
        </label>
        <p className="text-xs text-neutral-500">{fr.campaigns.touch.hint}</p>
        <p className="text-xs text-neutral-500">{fr.campaigns.results.klashesHint}</p>
      </div>

      {stats.isPending && <Spinner />}
      {stats.isError && (
        <p role="alert" className="text-sm text-red-700">
          {fr.campaigns.results.loadError}
        </p>
      )}
      {stats.data && (
        <>
          <StatsTable
            title={fr.campaigns.results.bySource}
            firstColumn={fr.campaigns.filters.source}
            rows={groupStats(rows, (row) => row.source).map((group) => ({
              ...group,
              label: labelOf(group.key),
            }))}
          />
          <StatsTable
            title={fr.campaigns.results.byCampaign}
            firstColumn={fr.campaigns.filters.campaign}
            rows={groupStats(rows, (row) => row.campaign).map((group) => ({
              ...group,
              label: group.key || fr.campaigns.results.noCampaign,
            }))}
          />
          <StatsTable
            title={fr.campaigns.results.byLink}
            firstColumn={fr.campaigns.results.linkColumn}
            rows={links
              .filter((row) => matchesLinkFilters(row, filters))
              .map((row) => ({
                key: row.slug as string,
                label: `/r/${row.slug}${row.isActive ? '' : ` ${fr.campaigns.results.inactive}`}`,
                detail: linkDescription(row, labelOf),
                scans: row.scans,
                signups: row.signups,
                installs: row.installs,
                klashes: row.klashes,
              }))}
          >
            <CampaignLinkFilters links={links} value={filters} onChange={setFilters} />
          </StatsTable>
        </>
      )}
    </div>
  )
}

interface StatsRow extends StatTotals {
  key: string
  label: string
  detail?: string
}

/** One results table. Scrolls sideways on its own on a narrow screen, so the
 * page itself never does. `children` (filters) sit between title and table. */
function StatsTable({
  title,
  firstColumn,
  rows,
  children,
}: {
  title: string
  firstColumn: string
  rows: readonly StatsRow[]
  children?: React.ReactNode
}) {
  return (
    <section className="flex flex-col gap-2" aria-label={title}>
      <h2 className="text-base font-semibold text-neutral-900">{title}</h2>
      {children}
      {rows.length === 0 ? (
        <p className="text-sm text-neutral-500">{fr.campaigns.results.empty}</p>
      ) : (
        <div className="overflow-x-auto rounded-md border border-neutral-200">
          <table className="w-full min-w-3xl text-sm">
            <thead className="bg-neutral-50 text-xs text-neutral-600">
              <tr>
                <th scope="col" className="px-3 py-2 text-left font-medium">
                  {firstColumn}
                </th>
                <NumberHeader>{fr.campaigns.stats.scans}</NumberHeader>
                <NumberHeader>{fr.campaigns.stats.signups}</NumberHeader>
                <NumberHeader>{fr.campaigns.stats.installs}</NumberHeader>
                <NumberHeader>{fr.campaigns.stats.klashes}</NumberHeader>
                <NumberHeader>{fr.campaigns.stats.scansToSignups}</NumberHeader>
                <NumberHeader>{fr.campaigns.stats.signupsToInstalls}</NumberHeader>
                <NumberHeader>{fr.campaigns.stats.klashesPerSignup}</NumberHeader>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200">
              {rows.map((row) => (
                <tr key={row.key}>
                  <th scope="row" className="px-3 py-2 text-left font-medium text-neutral-900">
                    <span className="break-all">{row.label}</span>
                    {row.detail && (
                      <span className="block text-xs font-normal text-neutral-600">
                        {row.detail}
                      </span>
                    )}
                  </th>
                  <NumberCell>{row.scans}</NumberCell>
                  <NumberCell>{row.signups}</NumberCell>
                  <NumberCell>{row.installs}</NumberCell>
                  <NumberCell>{row.klashes}</NumberCell>
                  <NumberCell>{formatRate(conversionRate(row.signups, row.scans))}</NumberCell>
                  <NumberCell>{formatRate(conversionRate(row.installs, row.signups))}</NumberCell>
                  <NumberCell>{formatAverage(conversionRate(row.klashes, row.signups))}</NumberCell>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}

function NumberHeader({ children }: { children: React.ReactNode }) {
  return (
    <th scope="col" className="px-3 py-2 text-right font-medium">
      {children}
    </th>
  )
}

function NumberCell({ children }: { children: React.ReactNode }) {
  return <td className="px-3 py-2 text-right text-neutral-900 tabular-nums">{children}</td>
}
