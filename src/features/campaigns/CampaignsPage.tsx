import { useSearchParams } from 'react-router-dom'
import { BackLink } from '../../components/BackLink'
import { TabButton } from '../../components/TabButton'
import { fr } from '../../i18n/fr'
import { CampaignLinksTab } from './CampaignLinksTab'
import { CampaignResultsTab } from './CampaignResultsTab'

type CampaignsTab = 'links' | 'results'

const TAB_PARAM = 'tab'

/** `/campaigns` (spec §6.8), reserved to campaign managers (route guard, RLS
 * and the RPCs all check) and separate from `/admin`: managing campaigns and
 * moderating are two different jobs, often done by different people. Two
 * tabs: the links (create, copy, QR code) and their results.
 *
 * The active tab is derived from the URL (`?tab=results`), like `/admin`. */
export function CampaignsPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const tab: CampaignsTab = searchParams.get(TAB_PARAM) === 'results' ? 'results' : 'links'

  function changeTab(next: CampaignsTab) {
    setSearchParams(next === 'links' ? {} : { [TAB_PARAM]: next }, { replace: true })
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-4">
      <BackLink />

      <h1 className="mt-2 text-xl font-semibold text-neutral-900">{fr.campaigns.title}</h1>

      <div className="mt-4 flex gap-1 overflow-x-auto border-b border-neutral-200">
        <TabButton active={tab === 'links'} onClick={() => changeTab('links')}>
          {fr.campaigns.tabs.links}
        </TabButton>
        <TabButton active={tab === 'results'} onClick={() => changeTab('results')}>
          {fr.campaigns.tabs.results}
        </TabButton>
      </div>

      <div className="mt-4">{tab === 'links' ? <CampaignLinksTab /> : <CampaignResultsTab />}</div>
    </div>
  )
}
