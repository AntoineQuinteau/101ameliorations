import { fr } from '../../i18n/fr'

export function PositionStep({
  accuracyM,
  isOutOfArea,
  onContinue,
  onCancel,
}: {
  accuracyM: number | null
  isOutOfArea: boolean
  onContinue: () => void
  onCancel: () => void
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

      {isOutOfArea && (
        <p role="alert" className="text-sm text-red-700">
          {fr.newKlash.outOfArea.body}
        </p>
      )}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 inline-flex items-center justify-center rounded-md border border-neutral-300 px-3 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
        >
          {fr.newKlash.cancel}
        </button>
        {!isOutOfArea && (
          <button
            type="button"
            onClick={onContinue}
            className="flex-1 inline-flex items-center justify-center rounded-md bg-teal-700 px-3 py-2 text-sm font-medium text-white hover:bg-teal-800"
          >
            {fr.newKlash.position.continue}
          </button>
        )}
      </div>
    </div>
  )
}
