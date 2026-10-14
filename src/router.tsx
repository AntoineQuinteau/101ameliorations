import { createBrowserRouter } from 'react-router-dom'
import { App } from './App'
import { AppErrorPage } from './components/AppErrorPage'
import { NotFoundPage } from './components/NotFoundPage'
import { AdminPage } from './features/admin/AdminPage'
import { LoginPage } from './features/auth/LoginPage'
import { RequireAuth } from './features/auth/RequireAuth'
import { RequireCampaignManager } from './features/auth/RequireCampaignManager'
import { RequireRole } from './features/auth/RequireRole'
import { CampaignsPage } from './features/campaigns/CampaignsPage'
import { ExportPage } from './features/export/ExportPage'
import { LegalNoticePage } from './features/legal/LegalNoticePage'
import { PrivacyPolicyPage } from './features/legal/PrivacyPolicyPage'
import { MapRoute } from './features/map/MapRoute'
import { MePage } from './features/me/MePage'
import { NewKlashPage } from './features/newKlash/NewKlashPage'
import { ADMIN_ROLES } from './lib/klashPermissions'

export const router = createBrowserRouter([
  {
    path: '/',
    element: <App />,
    errorElement: <AppErrorPage />,
    children: [
      { element: <MapRoute />, children: [{ index: true }, { path: 'k/:id' }] },
      { path: 'new', element: <NewKlashPage /> },
      { path: 'login', element: <LoginPage /> },
      { path: 'export', element: <ExportPage /> },
      { path: 'mentions-legales', element: <LegalNoticePage /> },
      { path: 'confidentialite', element: <PrivacyPolicyPage /> },
      {
        path: 'me',
        element: (
          <RequireAuth>
            <MePage />
          </RequireAuth>
        ),
      },
      {
        path: 'admin',
        element: (
          <RequireRole allow={ADMIN_ROLES}>
            <AdminPage />
          </RequireRole>
        ),
      },
      {
        path: 'campaigns',
        element: (
          <RequireCampaignManager>
            <CampaignsPage />
          </RequireCampaignManager>
        ),
      },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
])
