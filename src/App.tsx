import { Outlet } from 'react-router-dom'
import { InstallPrompt } from './features/pwa/InstallPrompt'
import { ServiceWorkerRegistration } from './features/pwa/ServiceWorkerRegistration'

export function App() {
  return (
    <>
      <Outlet />
      <ServiceWorkerRegistration />
      <InstallPrompt />
    </>
  )
}
