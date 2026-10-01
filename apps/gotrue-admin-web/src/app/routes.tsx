import { Routes, Route, Navigate } from 'react-router-dom';
import { ProtectedShell } from './shell';
import { LoginPage, AccountPage } from '@/features/auth/views';
import { Blank } from '@/components/feedback/states';
import {
  ForgotPasswordPage,
  ResetPasswordPage,
} from '@/features/recovery/views';

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route element={<ProtectedShell />}>
        <Route index element={<Navigate to="/users" replace />} />
        <Route path="/account" element={<AccountPage />} />
        <Route
          path="/users"
          element={
            <Blank
              title="Users"
              description="Account browsing is being implemented."
            />
          }
        />
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
  );
}
