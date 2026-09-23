import { CATEGORY_OTHER, klashCategorySchema, type KlashImportance } from '../../types/klash'
import { fr } from '../../i18n/fr'
import type { KlashFormDraft } from './newKlashSchemas'

const CATEGORIES = klashCategorySchema.options
const IMPORTANCES: KlashImportance[] = ['low', 'medium', 'high']

/** Red asterisk marking a required field's label, with a screen-reader-only
 * text equivalent (the asterisk itself is decorative to assistive tech). */
function RequiredMark() {
  return (
    <>
      <span className="text-red-600" aria-hidden="true">
        {' '}
        *
      </span>
      <span className="sr-only"> {fr.newKlash.form.requiredMark}</span>
    </>
  )
}

/** The category/importance/title/description/proposed-solution fields shared
 * by the creation form (KlashFormStep) and the edit form (EditKlashForm) —
 * everything about a klash's content except its position and its photos,
 * which the two forms handle differently (see EditKlashForm's docblock).
 *
 * `idPrefix` keeps each form's `<label htmlFor>` pairing unambiguous when
 * both forms could in principle exist in the same document. */
export function KlashFieldset({
  value,
  onChange,
  idPrefix,
}: {
  value: KlashFormDraft
  onChange: (value: KlashFormDraft) => void
  idPrefix: string
}) {
  return (
    <>
      <div className="flex flex-col gap-1">
        <label htmlFor={`${idPrefix}-category`} className="text-sm font-medium text-neutral-700">
          {fr.newKlash.form.categoryLabel}
          <RequiredMark />
        </label>
        <select
          id={`${idPrefix}-category`}
          value={value.category}
          onChange={(event) =>
            onChange({
              ...value,
              category: event.target.value as KlashFormDraft['category'],
              // Switching away from "Autre" drops whatever precision was
              // typed, so it can't be silently resubmitted under a
              // different category.
              categoryOther: event.target.value === CATEGORY_OTHER ? value.categoryOther : '',
            })
          }
          aria-required="true"
          className="rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm focus:border-teal-700 focus:ring-1 focus:ring-teal-700 focus:outline-none"
        >
          <option value="" disabled>
            {fr.newKlash.form.categoryPlaceholder}
          </option>
          {CATEGORIES.map((option) => (
            <option key={option} value={option}>
              {fr.category[option]}
            </option>
          ))}
        </select>
      </div>

      {value.category === CATEGORY_OTHER && (
        <div className="flex flex-col gap-1">
          <label
            htmlFor={`${idPrefix}-category-other`}
            className="text-sm font-medium text-neutral-700"
          >
            {fr.newKlash.form.categoryOtherLabel}
            <RequiredMark />
          </label>
          <input
            id={`${idPrefix}-category-other`}
            type="text"
            value={value.categoryOther}
            onChange={(event) => onChange({ ...value, categoryOther: event.target.value })}
            placeholder={fr.newKlash.form.categoryOtherPlaceholder}
            maxLength={120}
            aria-required="true"
            className="rounded-md border border-neutral-300 px-3 py-2 text-sm focus:border-teal-700 focus:ring-1 focus:ring-teal-700 focus:outline-none"
          />
        </div>
      )}

      <div>
        <span className="text-sm font-medium text-neutral-700">
          {fr.newKlash.form.importanceLabel}
          <RequiredMark />
        </span>
        <div className="mt-1 grid grid-cols-3 gap-2">
          {IMPORTANCES.map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => onChange({ ...value, importance: option })}
              aria-pressed={value.importance === option}
              className={`rounded-md border px-2 py-2 text-xs font-medium ${
                value.importance === option
                  ? 'border-teal-700 bg-teal-50 text-teal-800'
                  : 'border-neutral-300 text-neutral-600 hover:bg-neutral-50'
              }`}
            >
              {fr.importance[option]}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor={`${idPrefix}-title`} className="text-sm font-medium text-neutral-700">
          {fr.newKlash.form.titleLabel}
          <RequiredMark />
        </label>
        <input
          id={`${idPrefix}-title`}
          type="text"
          value={value.title}
          onChange={(event) => onChange({ ...value, title: event.target.value })}
          placeholder={fr.newKlash.form.titlePlaceholder}
          aria-required="true"
          className="rounded-md border border-neutral-300 px-3 py-2 text-sm focus:border-teal-700 focus:ring-1 focus:ring-teal-700 focus:outline-none"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor={`${idPrefix}-description`} className="text-sm font-medium text-neutral-700">
          {fr.newKlash.form.descriptionLabel}
        </label>
        <textarea
          id={`${idPrefix}-description`}
          value={value.description}
          onChange={(event) => onChange({ ...value, description: event.target.value })}
          placeholder={fr.newKlash.form.descriptionPlaceholder}
          rows={3}
          className="rounded-md border border-neutral-300 px-3 py-2 text-sm focus:border-teal-700 focus:ring-1 focus:ring-teal-700 focus:outline-none"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label
          htmlFor={`${idPrefix}-proposed-solution`}
          className="text-sm font-medium text-neutral-700"
        >
          {fr.newKlash.form.proposedSolutionLabel}
        </label>
        <textarea
          id={`${idPrefix}-proposed-solution`}
          value={value.proposedSolution}
          onChange={(event) => onChange({ ...value, proposedSolution: event.target.value })}
          placeholder={fr.newKlash.form.proposedSolutionPlaceholder}
          rows={3}
          className="rounded-md border border-neutral-300 px-3 py-2 text-sm focus:border-teal-700 focus:ring-1 focus:ring-teal-700 focus:outline-none"
        />
      </div>
    </>
  )
}
