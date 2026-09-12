import { useState } from 'react'
import { ErrorMessage } from '../../components/ErrorMessage'
import { fr } from '../../i18n/fr'
import type { KlashCategory, KlashUrgency } from '../../types/klash'
import { newKlashFormSchema, type NewKlashForm } from './newKlashSchemas'

const CATEGORIES: KlashCategory[] = [
  'category_1',
  'category_2',
  'category_3',
  'category_4',
  'category_5',
]
const URGENCIES: KlashUrgency[] = ['low', 'medium', 'high']

export function KlashFormStep({ onSubmit }: { onSubmit: (form: NewKlashForm) => void }) {
  const [category, setCategory] = useState<KlashCategory>('category_1')
  const [urgency, setUrgency] = useState<KlashUrgency>('medium')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [validationError, setValidationError] = useState<string | null>(null)

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    const result = newKlashFormSchema.safeParse({
      category,
      urgency,
      title,
      description: description.trim() === '' ? null : description,
    })
    if (!result.success) {
      const issue = result.error.issues[0]
      setValidationError(
        issue?.path[0] === 'description'
          ? fr.newKlash.form.invalidDescription
          : fr.newKlash.form.invalidTitle,
      )
      return
    }
    setValidationError(null)
    onSubmit(result.data)
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <h2 className="text-lg font-semibold text-neutral-900">{fr.newKlash.form.title}</h2>

      <div>
        <span className="text-sm font-medium text-neutral-700">
          {fr.newKlash.form.categoryLabel}
        </span>
        <div className="mt-1 grid grid-cols-5 gap-2">
          {CATEGORIES.map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setCategory(option)}
              aria-pressed={category === option}
              className={`rounded-md border px-2 py-2 text-xs font-medium ${
                category === option
                  ? 'border-teal-700 bg-teal-50 text-teal-800'
                  : 'border-neutral-300 text-neutral-600 hover:bg-neutral-50'
              }`}
            >
              {fr.category[option]}
            </button>
          ))}
        </div>
      </div>

      <div>
        <span className="text-sm font-medium text-neutral-700">
          {fr.newKlash.form.urgencyLabel}
        </span>
        <div className="mt-1 grid grid-cols-3 gap-2">
          {URGENCIES.map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setUrgency(option)}
              aria-pressed={urgency === option}
              className={`rounded-md border px-2 py-2 text-xs font-medium ${
                urgency === option
                  ? 'border-teal-700 bg-teal-50 text-teal-800'
                  : 'border-neutral-300 text-neutral-600 hover:bg-neutral-50'
              }`}
            >
              {fr.urgency[option]}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="new-klash-title" className="text-sm font-medium text-neutral-700">
          {fr.newKlash.form.titleLabel}
        </label>
        <input
          id="new-klash-title"
          type="text"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder={fr.newKlash.form.titlePlaceholder}
          className="rounded-md border border-neutral-300 px-3 py-2 text-sm focus:border-teal-700 focus:ring-1 focus:ring-teal-700 focus:outline-none"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="new-klash-description" className="text-sm font-medium text-neutral-700">
          {fr.newKlash.form.descriptionLabel}
        </label>
        <textarea
          id="new-klash-description"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          placeholder={fr.newKlash.form.descriptionPlaceholder}
          rows={3}
          className="rounded-md border border-neutral-300 px-3 py-2 text-sm focus:border-teal-700 focus:ring-1 focus:ring-teal-700 focus:outline-none"
        />
      </div>

      {validationError && <ErrorMessage message={validationError} />}

      <button
        type="submit"
        className="inline-flex items-center justify-center rounded-md bg-teal-700 px-3 py-2 text-sm font-medium text-white hover:bg-teal-800"
      >
        {fr.newKlash.form.submit}
      </button>
    </form>
  )
}
