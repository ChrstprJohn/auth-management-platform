import { Routes, Route, Navigate } from 'react-router-dom';
import { RouteState } from '@/components/route-state';
import { ProtectedShell } from './shell';
import { LoginPage, AccountPage } from '@/features/auth/views';
import { Blank } from '@/components/feedback/states';
import { HistoryPage } from '@/features/history/views';
import { HistoryDetailsPage } from '@/features/history/details';
import { StatusPage } from '@/features/status/views';
import { lazy, Suspense } from 'react';
import { Loading } from '@/components/feedback/states';
const DashboardPage = lazy(() =>
  import('@/features/dashboard/views').then((module) => ({
    default: module.DashboardPage,
  })),
);
import { UserActionsProvider } from '@/features/users/actions';
import { AccountActionsProvider } from '@/features/auth/account';
import { type EmailCallbackStatus } from '@/features/email/hooks';
import {
  InviteUserPage,
  EmailProofPage,
  EmailCallbackPage,
} from '@/features/email/views';
import {
  UsersPage,
  UserDetailsPage,
  LegacyCreateUserRoute,
} from '@/features/users/views';
import {
  ForgotPasswordPage,
  ResetPasswordPage,
} from '@/features/recovery/views';

export function AppRoutes({
  emailCallbackStatus = 'missing',
}: {
  emailCallbackStatus?: EmailCallbackStatus;
}) {
  return (
    <AccountActionsProvider>
      <UserActionsProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route path="/confirm-email" element={<EmailProofPage />} />
          <Route
            path="/accept-invitation"
            element={<EmailProofPage invitation />}
          />
          <Route
            path="/auth/callback"
            element={<EmailCallbackPage status={emailCallbackStatus} />}
          />
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
            <Route path="/history/:id" element={<HistoryDetailsPage />} />
            <Route path="/status" element={<StatusPage />} />
            <Route path="/users" element={<UsersPage />} />
            <Route path="/users/new" element={<LegacyCreateUserRoute />} />
            <Route path="/users/invite" element={<InviteUserPage />} />
            <Route path="/users/:id" element={<UserDetailsPage />} />
          </Route>
          <Route
            path="*"
            element={
              <RouteState>
                <Blank
                  title="Page not found"
                  description="This destination is unavailable."
                />
              </RouteState>
            }
          />
        </Routes>
      </UserActionsProvider>
    </AccountActionsProvider>
  );
}
