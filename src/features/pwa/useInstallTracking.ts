import { useEffect } from 'react'
import { attributionPayload } from '../attribution/attribution'
import { readAttribution } from '../attribution/attributionStorage'
import { supabase } from '../../lib/supabase'
import { installPlatform, isRunningStandalone } from './platform'

const RECORDED_KEY = '101ameliorations:install-recorded'

function wasRecorded(): boolean {
  try {
    return window.localStorage.getItem(RECORDED_KEY) === '1'
  } catch {
    return false
  }
}

function markRecorded(): void {
  try {
    window.localStorage.setItem(RECORDED_KEY, '1')
  } catch {
    // Best-effort; worst case an install is counted twice.
  }
}

/** Counts one installation with the stored attribution (campaign counters
 * only: no account, no device identifier is sent). */
async function recordInstall(): Promise<void> {
  if (wasRecorded()) return
  markRecorded()
  const payload = attributionPayload(
    readAttribution() ?? {
      firstSeenAt: new Date().toISOString(),
      firstTouch: null,
      lastTouch: null,
    },
  )
  const { error } = await supabase.rpc('record_install', {
    p_platform: installPlatform(),
    p_first_touch: payload.first_touch,
    p_last_touch: payload.last_touch,
  })
  if (error) {
    // Allow a later retry rather than silently losing the install.
    try {
      window.localStorage.removeItem(RECORDED_KEY)
    } catch {
      // ignore
    }
  }
}

/** Installation tracking (spec §7): `appinstalled` where the browser fires it
 * (Android, desktop), and on iOS — which never does — the first launch in
 * standalone mode. */
export function useInstallTracking(): void {
  useEffect(() => {
    if (installPlatform() === 'ios' && isRunningStandalone()) void recordInstall()

    function onAppInstalled() {
      void recordInstall()
    }
    window.addEventListener('appinstalled', onAppInstalled)
    return () => window.removeEventListener('appinstalled', onAppInstalled)
  }, [])
}
