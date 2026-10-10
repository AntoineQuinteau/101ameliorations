import { Outlet } from 'react-router-dom'
import { AnalyticsPageviews } from './features/pwa/AnalyticsPageviews'
import { InstallPrompt } from './features/pwa/InstallPrompt'
import { ServiceWorkerRegistration } from './features/pwa/ServiceWorkerRegistration'
import { useInstallTracking } from './features/pwa/useInstallTracking'

export function App() {
  useInstallTracking()

  return (
    <>
      <Outlet />
      <ServiceWorkerRegistration />
      <InstallPrompt />
      <AnalyticsPageviews />
    </>
  )
}
