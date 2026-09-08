import { createBrowserRouter } from 'react-router-dom'
import { App } from './App'
import { NotFoundPage } from './components/NotFoundPage'
import { MapPage } from './features/map/MapPage'

export const router = createBrowserRouter([
  {
    path: '/',
    element: <App />,
    children: [
      { index: true, element: <MapPage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
])
