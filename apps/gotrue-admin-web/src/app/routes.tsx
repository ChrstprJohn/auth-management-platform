import { Routes, Route, Navigate } from 'react-router-dom';
import { ProtectedShell } from './shell';
import { LoginPage, AccountPage } from '@/features/auth/views';
import { Blank } from '@/components/feedback/states';
import { HistoryPage } from '@/features/history/views';
import { StatusPage } from '@/features/status/views';
import { lazy, Suspense } from 'react';
import { Loading } from '@/components/feedback/states';
const DashboardPage = lazy(() =>
  import('@/features/dashboard/views').then((module) => ({
    default: module.DashboardPage,
  })),
);
import { UserActionsProvider } from '@/features/users/actions';
import {
  UsersPage,
  UserDetailsPage,
  CreateUserPage,
} from '@/features/users/views';
import {
  ForgotPasswordPage,
  ResetPasswordPage,
} from '@/features/recovery/views';

export function AppRoutes() {
  return (
    <UserActionsProvider>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route element={<ProtectedShell />}>
          <Route index element={<Navigate to="/users" replace />} />
          <Route path="/account" element={<AccountPage />} />
          <Route
            path="/dashboard"
            element={
              <Suspense fallback={<Loading label="Loading dashboard" />}>
                <DashboardPage />
              </Suspense>
            }
          />
          <Route path="/history" element={<HistoryPage />} />
          <Route path="/status" element={<StatusPage />} />
          <Route path="/users" element={<UsersPage />} />
          <Route path="/users/new" element={<CreateUserPage />} />
          <Route path="/users/:id" element={<UserDetailsPage />} />
        </Route>
        <Route
          path="*"
          element={
            <main className="public-form">
              <Blank
                title="Page not found"
                description="This destination is unavailable."
              />
            </main>
          }
        />
      </Routes>
    </UserActionsProvider>
  );
}
