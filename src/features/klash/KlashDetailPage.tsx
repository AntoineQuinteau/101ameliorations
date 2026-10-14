import { Link, useNavigate } from 'react-router-dom'
import { BackLink } from '../../components/BackLink'
import { fr } from '../../i18n/fr'
import { useAuth } from '../auth/useAuth'
import { KlashDetail } from './KlashDetail'

/** Detail page (spec §6.3): the klash content under a back link row. Reached by a direct
 * or shared link, from another page, or on mobile; on desktop the map opens the same
 * content in a modal instead (`KlashDetailModal`). */
export function KlashDetailPage({ klashId }: { klashId: string }) {
  const { user } = useAuth()
  const navigate = useNavigate()

  return (
    <KlashDetail
      klashId={klashId}
      onDeleted={() => navigate('/', { replace: true })}
      header={
        <div className="flex items-center justify-between">
          <BackLink />
          <Link
            to={user ? '/me' : '/login'}
            className="text-sm font-medium text-teal-700 hover:underline"
          >
            {user ? fr.auth.mySpace : fr.auth.signIn}
          </Link>
        </div>
      }
    />
  )
}
