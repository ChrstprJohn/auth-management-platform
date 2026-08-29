import { createBrowserRouter, RouterProvider } from 'react-router-dom'

const routes = [
  {
    path: '/login',
    element: null,
  },
  {
    path: '/projects',
    element: null,
  },
  {
    path: '/projects/:projectId',
    element: null,
  },
  {
    path: '/users',
    element: null,
  },
  {
    path: '/api',
    element: null,
  },
  {
    path: '/settings',
    element: null,
  },
]

export const router = createBrowserRouter(routes)

export const RouterView = () => <RouterProvider router={router} />
