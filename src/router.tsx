import { createBrowserRouter } from 'react-router-dom'
import { App } from './App'
import { NotFoundPage } from './components/NotFoundPage'
import { KlashDetailPage } from './features/klash/KlashDetailPage'
import { MapPage } from './features/map/MapPage'

export const router = createBrowserRouter([
  {
    path: '/',
    element: <App />,
    children: [
      { index: true, element: <MapPage /> },
      { path: 'k/:id', element: <KlashDetailPage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
])
