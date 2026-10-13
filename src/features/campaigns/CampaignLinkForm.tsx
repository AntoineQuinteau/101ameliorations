import { useState } from 'react'
import { fr } from '../../i18n/fr'
import { campaignMediumSchema, type CampaignLink, type CampaignMedium } from '../../types/campaign'
import { useSourceLabel } from './campaignLabels'
import {
  RESERVED_SOURCES,
  buildCampaignKey,
  findExistingSource,
  normalizeCampaignToken,
} from './campaignTokens'
import { useCampaignSources, useCreateCampaignLink, useCreateCampaignSource } from './useCampaigns'

const NEW_CAMPAIGN = '__new__'
const NEW_SOURCE = '__new__'
const MEDIUMS = campaignMediumSchema.options
const fieldClass =
  'rounded-md border border-neutral-300 px-3 py-2 text-sm focus:border-teal-700 focus:ring-1 focus:ring-teal-700 focus:outline-none'

function currentMonth(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

/** Link creation (spec §6.8). Nothing here is a utm: the manager picks an
 * emitter and a medium from lists, types a free-text precision (normalized
 * live, and again by the database) and picks or creates a campaign. */
export function CampaignLinkForm({
  existingCampaigns,
  onCreated,
  onCancel,
}: {
  existingCampaigns: readonly string[]
  onCreated: (link: CampaignLink) => void
  onCancel: () => void
}) {
  const sources = useCampaignSources()
  const create = useCreateCampaignLink()
  const createSource = useCreateCampaignSource()
  const labelOf = useSourceLabel()

  const [source, setSource] = useState('')
  const [medium, setMedium] = useState<CampaignMedium>('print')
  const [content, setContent] = useState('')
  const [campaignChoice, setCampaignChoice] = useState('')
  const [newName, setNewName] = useState('')
  const [newMonth, setNewMonth] = useState(currentMonth)
  const [newSourceName, setNewSourceName] = useState('')

  const sourceList = sources.data ?? []
  const effectiveSource = source || sourceList[0]?.source || ''
  const isNewSource = effectiveSource === NEW_SOURCE
  const newSourceKey = normalizeCampaignToken(newSourceName)
  const existingSource = isNewSource
    ? findExistingSource(newSourceKey, sourceList, labelOf)
    : undefined
  const sourceReserved = isNewSource && RESERVED_SOURCES.includes(newSourceKey)
  // The emitter the link will use: the picked one, an existing one found by
  // name, or null while a new one still has to be created.
  const resolvedSource = isNewSource ? (existingSource?.source ?? null) : effectiveSource
  const sourceReady = isNewSource
    ? Boolean(newSourceKey) && !sourceReserved
    : Boolean(effectiveSource)
  // '' = untouched: default to the first existing campaign once the list has
  // loaded (it arrives after the first render), else to creating one.
  const chosenCampaign = campaignChoice || existingCampaigns[0] || NEW_CAMPAIGN
  const isNew = chosenCampaign === NEW_CAMPAIGN
  const campaign = isNew ? buildCampaignKey(newName, newMonth) : chosenCampaign
  const normalizedContent = normalizeCampaignToken(content)
  const pending = create.isPending || createSource.isPending
  const canSubmit = sourceReady && Boolean(campaign) && !pending

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    if (!canSubmit) return
    function createLink(sourceKey: string) {
      create.mutate(
        { source: sourceKey, medium, campaign, content },
        {
          onSuccess: (link) => {
            setContent('')
            onCreated(link)
          },
        },
      )
    }
    if (resolvedSource !== null) {
      createLink(resolvedSource)
      return
    }
    if (!window.confirm(fr.campaigns.form.sourceNewConfirm(newSourceName.trim(), newSourceKey))) {
      return
    }
    createSource.mutate(newSourceName, {
      onSuccess: (created) => {
        setSource(created.source)
        setNewSourceName('')
        createLink(created.source)
      },
    })
  }

  const errorMessage = createSource.isError
    ? fr.campaigns.form.sourceError
    : create.isError
      ? create.error instanceof Error && create.error.message.includes('already exists')
        ? fr.campaigns.form.duplicate
        : fr.campaigns.form.error
      : null

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-3 rounded-md border border-neutral-200 p-3"
    >
      <h2 className="text-base font-semibold text-neutral-900">{fr.campaigns.form.title}</h2>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm text-neutral-700">
          {fr.campaigns.form.source}
          <select
            value={effectiveSource}
            onChange={(event) => setSource(event.target.value)}
            className={fieldClass}
          >
            {sourceList.map(({ source: value }) => (
              <option key={value} value={value}>
                {labelOf(value)}
              </option>
            ))}
            <option value={NEW_SOURCE}>{fr.campaigns.form.sourceNew}</option>
          </select>
        </label>

        <label className="flex flex-col gap-1 text-sm text-neutral-700">
          {fr.campaigns.form.medium}
          <select
            value={medium}
            onChange={(event) => setMedium(event.target.value as CampaignMedium)}
            className={fieldClass}
          >
            {MEDIUMS.map((value) => (
              <option key={value} value={value}>
                {fr.campaigns.medium[value]}
              </option>
            ))}
          </select>
        </label>
      </div>

      {isNewSource && (
        <div className="flex flex-col gap-1">
          <label className="flex flex-col gap-1 text-sm text-neutral-700">
            {fr.campaigns.form.sourceName}
            <input
              type="text"
              value={newSourceName}
              maxLength={40}
              onChange={(event) => setNewSourceName(event.target.value)}
              className={fieldClass}
            />
          </label>
          <p className="text-xs text-neutral-500">
            {fr.campaigns.form.sourceKey} <code>{newSourceKey || '—'}</code>{' '}
            {fr.campaigns.form.sourceNameHint}
          </p>
          {existingSource && (
            <p className="text-xs text-neutral-700">{fr.campaigns.form.sourceExists}</p>
          )}
          {sourceReserved && (
            <p role="alert" className="text-xs text-red-700">
              {fr.campaigns.form.sourceReserved}
            </p>
          )}
        </div>
      )}

      <label className="flex flex-col gap-1 text-sm text-neutral-700">
        {fr.campaigns.form.content}
        <input
          type="text"
          value={content}
          maxLength={80}
          onChange={(event) => setContent(event.target.value)}
          className={fieldClass}
        />
        <span className="text-xs text-neutral-500">
          {fr.campaigns.form.contentHint}{' '}
          <code>{normalizedContent || fr.campaigns.form.contentEmpty}</code>
        </span>
      </label>

      <label className="flex flex-col gap-1 text-sm text-neutral-700">
        {fr.campaigns.form.campaign}
        <select
          value={chosenCampaign}
          onChange={(event) => setCampaignChoice(event.target.value)}
          className={fieldClass}
        >
          {existingCampaigns.map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
          <option value={NEW_CAMPAIGN}>{fr.campaigns.form.campaignNew}</option>
        </select>
      </label>

      {isNew && (
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-sm text-neutral-700">
            {fr.campaigns.form.campaignName}
            <input
              type="text"
              value={newName}
              maxLength={40}
              placeholder={fr.campaigns.form.campaignNameHint}
              onChange={(event) => setNewName(event.target.value)}
              className={fieldClass}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm text-neutral-700">
            {fr.campaigns.form.campaignMonth}
            <input
              type="month"
              value={newMonth}
              onChange={(event) => setNewMonth(event.target.value)}
              className={fieldClass}
            />
          </label>
          <p className="text-xs text-neutral-500 sm:col-span-2">
            {fr.campaigns.form.campaignKey} <code>{campaign || '—'}</code>
          </p>
        </div>
      )}

      {errorMessage && (
        <p role="alert" className="text-sm text-red-700">
          {errorMessage}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        <button
          type="submit"
          disabled={!canSubmit}
          aria-busy={pending}
          className="inline-flex min-h-11 items-center justify-center rounded-md bg-teal-700 px-3 py-2 text-sm font-medium text-white hover:bg-teal-800 disabled:opacity-60"
        >
          {pending ? fr.campaigns.form.submitting : fr.campaigns.form.submit}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="inline-flex min-h-11 items-center justify-center rounded-md border border-neutral-300 px-3 py-2 text-sm font-medium text-neutral-700"
        >
          {fr.campaigns.form.close}
        </button>
      </div>
    </form>
  )
}
