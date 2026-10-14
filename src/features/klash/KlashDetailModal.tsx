import { useNavigate } from 'react-router-dom'
import { Modal } from '../../components/Modal'
import { fr } from '../../i18n/fr'
import { hasPreviousInAppEntry } from '../../utils/inAppHistory'
import { KlashDetail } from './KlashDetail'

/** The klash detail as a modal over the map (spec §6.3), opened by a desktop marker click.
 * The URL is `/k/:id`, same as the full page. Closing goes back to the map entry the
 * click came from when there is one — so Back, Escape and the close button all agree —
 * and otherwise (reload landing here with no history) replaces it with `/`. */
export function KlashDetailModal({ klashId }: { klashId: string }) {
  const navigate = useNavigate()

  function close() {
    if (hasPreviousInAppEntry()) navigate(-1)
    else navigate('/', { replace: true })
  }

  return (
    <Modal title={fr.detail.dialogLabel} size="lg" onClose={close}>
      <KlashDetail klashId={klashId} onDeleted={close} inOverlay />
    </Modal>
  )
}
