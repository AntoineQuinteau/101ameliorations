import { fr } from '../../i18n/fr'

export function PositionStep({
  accuracyM,
  isOutOfArea,
  onContinue,
}: {
  accuracyM: number | null
  isOutOfArea: boolean
  onContinue: () => void
}) {
  return (
    <div className="flex flex-col gap-3">
      <h2 className="text-lg font-semibold text-neutral-900">{fr.newKlash.position.title}</h2>
      <p className="text-sm text-neutral-600">{fr.newKlash.position.instructions}</p>

      {accuracyM !== null && (
        <p className="text-xs text-neutral-500">
          {accuracyM <= 50
            ? fr.newKlash.position.accuracyGood(accuracyM)
            : fr.newKlash.position.accuracyPoor}
        </p>
      )}

      {isOutOfArea ? (
        <p role="alert" className="text-sm text-red-700">
          {fr.newKlash.outOfArea.body}
        </p>
      ) : (
        <button
          type="button"
          onClick={onContinue}
          className="inline-flex items-center justify-center rounded-md bg-teal-700 px-3 py-2 text-sm font-medium text-white hover:bg-teal-800"
        >
          {fr.newKlash.position.continue}
        </button>
      )}
    </div>
  )
}
