import { useState } from 'react'
import { Plus } from 'lucide-react'
import { Spinner } from '../../components/Spinner'
import { fr } from '../../i18n/fr'
import { CampaignLinkForm } from './CampaignLinkForm'
import { CampaignLinkList, type OpenLinkPanel } from './CampaignLinkList'
import { CampaignLinkResult } from './CampaignLinkResult'
import { useCampaignStats } from './useCampaigns'

/** `/campaigns` "Liens" tab: the day-to-day side — find a link, copy its URL
 * or its QR code, create a new one. The numbers live in the "Résultats" tab. */
export function CampaignLinksTab() {
  // The list comes from the statistics RPC (one row per link, plus its scan
  // count, which does not depend on the touch).
  const stats = useCampaignStats('first')
  const [isCreating, setIsCreating] = useState(false)
  const [createdSlug, setCreatedSlug] = useState<string | null>(null)
  const [open, setOpen] = useState<OpenLinkPanel | null>(null)

  const links = (stats.data ?? []).filter((row) => row.slug !== null)
  const campaigns = [...new Set(links.map((row) => row.campaign))]

  function closeForm() {
    setIsCreating(false)
    setCreatedSlug(null)
  }

  return (
    <div className="flex flex-col gap-4">
      {isCreating ? (
        <CampaignLinkForm
          existingCampaigns={campaigns}
          onCancel={closeForm}
          onCreated={(link) => {
            // A single QR code on screen at a time: see OpenLinkPanel.
            setOpen(null)
            setCreatedSlug(link.slug)
          }}
        />
      ) : (
        <button
          type="button"
          onClick={() => setIsCreating(true)}
          className="inline-flex min-h-11 w-fit items-center gap-2 rounded-md bg-teal-700 px-3 py-2 text-sm font-medium text-white hover:bg-teal-800"
        >
          <Plus className="size-4" />
          {fr.campaigns.form.title}
        </button>
      )}

      {createdSlug && (
        <CampaignLinkResult
          key={createdSlug}
          slug={createdSlug}
          onClose={() => setCreatedSlug(null)}
        />
      )}

      {stats.isPending && <Spinner />}
      {stats.isError && (
        <p role="alert" className="text-sm text-red-700">
          {fr.campaigns.list.loadError}
        </p>
      )}
      {stats.data && (
        <CampaignLinkList
          links={links}
          open={open}
          onOpenChange={(next) => {
            if (next?.panel === 'qr') setCreatedSlug(null)
            setOpen(next)
          }}
        />
      )}
    </div>
  )
}
