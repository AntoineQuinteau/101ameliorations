import { DisplayNameForm } from '../me/DisplayNameForm'
import { fr } from '../../i18n/fr'

export function NicknameStep({
  isSubmitting,
  onSubmit,
  onSkip,
}: {
  isSubmitting: boolean
  onSubmit: (displayName: string) => void
  onSkip: () => void
}) {
  return (
    <div className="flex flex-col gap-3">
      <div>
        <h2 className="text-lg font-semibold text-neutral-900">{fr.login.nicknameStep.title}</h2>
        <p className="mt-1 text-sm text-neutral-500">{fr.login.nicknameStep.body}</p>
      </div>
      <DisplayNameForm
        initialValue=""
        submitLabel={fr.login.nicknameStep.submit}
        isSubmitting={isSubmitting}
        onSubmit={onSubmit}
      />
      <button
        type="button"
        onClick={onSkip}
        className="text-sm font-medium text-neutral-500 hover:underline"
      >
        {fr.login.nicknameStep.skip}
      </button>
    </div>
  )
}
