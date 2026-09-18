import { createBrowserRouter } from 'react-router-dom'
import { App } from './App'
import { AppErrorPage } from './components/AppErrorPage'
import { NotFoundPage } from './components/NotFoundPage'
import { AdminPage } from './features/admin/AdminPage'
import { LoginPage } from './features/auth/LoginPage'
import { RequireAuth } from './features/auth/RequireAuth'
import { RequireRole } from './features/auth/RequireRole'
import { ExportPage } from './features/export/ExportPage'
import { KlashDetailPage } from './features/klash/KlashDetailPage'
import { LegalNoticePage } from './features/legal/LegalNoticePage'
import { PrivacyPolicyPage } from './features/legal/PrivacyPolicyPage'
import { MapPage } from './features/map/MapPage'
import { MePage } from './features/me/MePage'
import { NewKlashPage } from './features/newKlash/NewKlashPage'

export const router = createBrowserRouter([
  {
    path: '/',
    element: <App />,
    errorElement: <AppErrorPage />,
    children: [
      { index: true, element: <MapPage /> },
      { path: 'k/:id', element: <KlashDetailPage /> },
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
          <RequireRole allow={['moderator', 'authority', 'admin']}>
            <AdminPage />
          </RequireRole>
        ),
      },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
])
