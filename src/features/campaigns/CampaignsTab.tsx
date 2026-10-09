import { useState } from 'react'
import { Spinner } from '../../components/Spinner'
import { fr } from '../../i18n/fr'
import type { AttributionTouch } from '../../types/campaign'
import { CampaignLinkForm } from './CampaignLinkForm'
import { CampaignLinkList } from './CampaignLinkList'
import { CampaignLinkResult } from './CampaignLinkResult'
import { CampaignSummary } from './CampaignSummary'
import { useCampaignStats } from './useCampaigns'

/** `/admin` "Campagnes" tab (spec §6.8): create a link, get its short URL and
 * QR code, follow the funnel per link, emitter and campaign. Reachable only by
 * campaign managers (route guard, RLS and the RPCs all check). */
export function CampaignsTab() {
  const [touch, setTouch] = useState<AttributionTouch>('first')
  const [shownSlug, setShownSlug] = useState<string | null>(null)
  const stats = useCampaignStats(touch)

  const campaigns = [
    ...new Set((stats.data ?? []).filter((row) => row.slug !== null).map((row) => row.campaign)),
  ]

  return (
    <div className="flex flex-col gap-6">
      <CampaignLinkForm
        existingCampaigns={campaigns}
        onCreated={(link) => setShownSlug(link.slug)}
      />

      {shownSlug && <CampaignLinkResult slug={shownSlug} onClose={() => setShownSlug(null)} />}

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

      {stats.isPending && <Spinner />}
      {stats.isError && (
        <p role="alert" className="text-sm text-red-700">
          {fr.campaigns.list.loadError}
        </p>
      )}
      {stats.data && (
        <>
          <CampaignSummary rows={stats.data} />
          <CampaignLinkList rows={stats.data} onShowQr={setShownSlug} />
        </>
      )}
    </div>
  )
}
