import { createBrowserRouter } from 'react-router-dom'
import { App } from './App'
import { NotFoundPage } from './components/NotFoundPage'
import { LoginPage } from './features/auth/LoginPage'
import { RequireAuth } from './features/auth/RequireAuth'
import { KlashDetailPage } from './features/klash/KlashDetailPage'
import { MapPage } from './features/map/MapPage'
import { MePage } from './features/me/MePage'
import { NewKlashPage } from './features/newKlash/NewKlashPage'

export const router = createBrowserRouter([
  {
    path: '/',
    element: <App />,
    children: [
      { index: true, element: <MapPage /> },
      { path: 'k/:id', element: <KlashDetailPage /> },
      { path: 'new', element: <NewKlashPage /> },
      { path: 'login', element: <LoginPage /> },
      {
        path: 'me',
        element: (
          <RequireAuth>
            <MePage />
          </RequireAuth>
        ),
      },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
])
