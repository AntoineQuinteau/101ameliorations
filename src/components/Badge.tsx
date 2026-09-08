import type { BadgeTone } from '../lib/klashPresentation'

const TONE_CLASSES: Record<BadgeTone, string> = {
  green: 'bg-emerald-100 text-emerald-800',
  amber: 'bg-amber-100 text-amber-800',
  red: 'bg-red-100 text-red-800',
  gray: 'bg-neutral-200 text-neutral-700',
  blue: 'bg-sky-100 text-sky-800',
  indigo: 'bg-indigo-100 text-indigo-800',
}

export function Badge({ label, tone }: { label: string; tone: BadgeTone }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${TONE_CLASSES[tone]}`}
    >
      {label}
    </span>
  )
}
