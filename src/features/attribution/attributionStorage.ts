import { attributionSchema, type Attribution } from './attribution'

const STORAGE_KEY = '101ameliorations:attribution'

/** The stored attribution, or `null` when absent, unreadable or invalid
 * (storage is client-controlled, so it is re-validated on every read). Never
 * throws: storage can be blocked (private mode), same as useInstallPrompt. */
export function readAttribution(): Attribution | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = attributionSchema.safeParse(JSON.parse(raw))
    return parsed.success ? parsed.data : null
  } catch {
    return null
  }
}

export function writeAttribution(attribution: Attribution): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(attribution))
  } catch {
    // Best-effort: without storage the visit simply goes unattributed.
  }
}
