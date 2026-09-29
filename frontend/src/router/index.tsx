import { createBrowserRouter, RouterProvider, Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { LoginPage } from '@/pages/Login'
import { ProjectsPage } from '@/pages/Projects'
import { ProjectLayout } from '@/components/layout/project-layout'
import { OverviewPage } from '@/pages/project/Overview'
import { UsersPage } from '@/pages/project/Users'
import { UserDetailsPage } from '@/pages/project/UserDetails'
import { ApiPage } from '@/pages/project/Api'
import { SettingsPage } from '@/pages/project/Settings'

/** Redirects to /login if the user is not authenticated */
function ProtectedRoute() {
  const { isLoggedIn } = useAuth()
  if (!isLoggedIn) return <Navigate to="/login" replace />
  return <Outlet />
}

const router = createBrowserRouter([
  {
    path: '/',
    element: <Navigate to="/login" replace />,
  },
  {
    path: '/login',
    element: <LoginPage />,
  },
  {
    element: <ProtectedRoute />,
    children: [
      {
        path: '/projects',
        element: <ProjectsPage />,
      },
      {
        path: '/projects/:projectId',
        element: <ProjectLayout />,
        children: [
          { index: true, element: <Navigate to="overview" replace /> },
          { path: 'overview', element: <OverviewPage /> },
          { path: 'users', element: <UsersPage /> },
          { path: 'users/:userId', element: <UserDetailsPage /> },
          { path: 'api', element: <ApiPage /> },
          { path: 'settings', element: <SettingsPage /> },
        ],
      },
    ],
  },
])

export function RouterView() {
  return <RouterProvider router={router} />
}
