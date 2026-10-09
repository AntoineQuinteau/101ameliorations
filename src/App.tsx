import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import { InstallPrompt } from './features/pwa/InstallPrompt'
import { ServiceWorkerRegistration } from './features/pwa/ServiceWorkerRegistration'

/** What `App` hands its routes through the `<Outlet>` context. */
export interface AppOutletContext {
  /** Hides the install banner while true (the map's welcome dialog uses it so
   * the two never stack, spec §6.1). Callers must reset it on unmount. */
  setInstallPromptSuppressed: (suppressed: boolean) => void
}

export function App() {
  const [isInstallPromptSuppressed, setInstallPromptSuppressed] = useState(false)
  const context: AppOutletContext = { setInstallPromptSuppressed }

  return (
    <>
      <Outlet context={context} />
      <ServiceWorkerRegistration />
      <InstallPrompt suppressed={isInstallPromptSuppressed} />
    </>
  )
}
