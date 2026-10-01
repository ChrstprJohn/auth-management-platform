import { describe, it, expect, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { Routes, Route } from 'react-router-dom';
import { operatorApi } from '@/lib/api/operator';
import { ApiFailure } from '@/lib/api/client';
import { renderApp, fixtureSession } from '@/test/providers';
import { ProtectedShell } from './shell';

function boundary() {
  return renderApp(
    <Routes>
      <Route path="/login" element={<h1>Sign in destination</h1>} />
      <Route element={<ProtectedShell />}>
        <Route path="/users" element={<h1>Private users fixture</h1>} />
      </Route>
    </Routes>,
    '/users',
  );
}
describe('protected session boundary', () => {
  it('does not flash private data while restoring a session', async () => {
    let finish: (value: typeof fixtureSession) => void = () => {};
    vi.spyOn(operatorApi, 'me').mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    boundary();
    expect(
      screen.getByRole('status', { name: 'Checking operator session' }),
    ).toBeVisible();
    expect(screen.queryByText('Private users fixture')).not.toBeInTheDocument();
    finish(fixtureSession);
    expect(await screen.findByText('Private users fixture')).toBeVisible();
  });
  it.each([
    [401, 'Sign in destination'],
    [403, 'Access denied'],
    [503, 'Session check unavailable'],
  ] as const)('fails closed for status %s', async (status, title) => {
    vi.spyOn(operatorApi, 'me').mockRejectedValue(
      new ApiFailure(
        status === 401
          ? 'AUTHENTICATION_REQUIRED'
          : status === 403
            ? 'ACCESS_DENIED'
            : 'DEPENDENCY_UNAVAILABLE',
        status,
        false,
      ),
    );
    boundary();
    expect(await screen.findByRole('heading', { name: title })).toBeVisible();
    expect(screen.queryByText('Private users fixture')).not.toBeInTheDocument();
  });
  it('expires local display state and clears private caches without refresh tokens', async () => {
    vi.spyOn(operatorApi, 'me').mockResolvedValue({
      ...fixtureSession,
      expiresAt: new Date(Date.now() + 500).toISOString(),
    });
    const { runtime } = boundary();
    expect(await screen.findByText('Private users fixture')).toBeVisible();
    runtime.client.setQueryData(['private', 'fixture'], ['private']);
    expect(await screen.findByText('Sign in destination')).toBeVisible();
    await waitFor(() =>
      expect(
        runtime.client.getQueryData(['private', 'fixture']),
      ).toBeUndefined(),
    );
  });
});
