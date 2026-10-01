import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { SessionProvider } from '@/app/session';
import { TooltipProvider } from '@/components/ui/tooltip';
import { createSessionRuntime } from '@/lib/query/runtime';
import { operatorApi } from '@/lib/api/operator';
import { ApiFailure } from '@/lib/api/client';
import { LoginPage, AccountPage } from './views';
import { safeReturn, loginSchema } from './schemas';

const session = {
  operator: {
    id: '00000000-0000-4000-8000-000000000001',
    email: 'controlled@example.test',
  },
  expiresAt: new Date(Date.now() + 3600000).toISOString(),
};
function mount(view: React.ReactNode) {
  const runtime = createSessionRuntime();
  render(
    <QueryClientProvider client={runtime.client}>
      <SessionProvider runtime={runtime}>
        <TooltipProvider>
          <MemoryRouter>{view}</MemoryRouter>
        </TooltipProvider>
      </SessionProvider>
    </QueryClientProvider>,
  );
  return runtime;
}
describe('operator forms and account', () => {
  it('accepts existing short passwords and keeps return destinations internal', () => {
    expect(
      loginSchema.safeParse({ email: 'controlled@example.test', password: 'x' })
        .success,
    ).toBe(true);
    expect(safeReturn('//evil.test')).toBe('/users');
    expect(safeReturn('/users?password=secret')).toBe('/users');
    expect(safeReturn('/history')).toBe('/history');
  });
  it.each([
    ['ACCESS_DENIED', 403, 'Access was denied'],
    ['AUTHENTICATION_REQUIRED', 401, 'valid operator credentials'],
    ['RATE_LIMITED', 429, 'Wait before trying again'],
    ['DEPENDENCY_UNAVAILABLE', 503, 'unavailable'],
    ['NETWORK_ERROR', 0, 'could not be reached'],
  ] as const)(
    'shows %s and releases password state without establishing a session',
    async (code, status, message) => {
      vi.spyOn(operatorApi, 'me').mockRejectedValue(
        new ApiFailure('AUTHENTICATION_REQUIRED', 401, false),
      );
      const login = vi
        .spyOn(operatorApi, 'login')
        .mockRejectedValue(new ApiFailure(code, status, false));
      mount(<LoginPage />);
      const user = userEvent.setup();
      await user.type(
        screen.getByLabelText('Email'),
        'controlled@example.test',
      );
      await user.type(screen.getByLabelText('Password'), 'short');
      await user.click(screen.getByRole('button', { name: /^Sign in$/ }));
      expect(await screen.findByRole('alert')).toHaveTextContent(message);
      expect(login).toHaveBeenCalledTimes(1);
      expect(screen.getByLabelText('Password')).toHaveValue('');
    },
  );
  it('restores account information and leaves failed logout visible with data intact', async () => {
    vi.spyOn(operatorApi, 'me').mockResolvedValue(session);
    vi.spyOn(operatorApi, 'logout').mockRejectedValue(
      new ApiFailure('DEPENDENCY_UNAVAILABLE', 503, false),
    );
    const runtime = mount(<AccountPage />);
    expect(await screen.findByText('controlled@example.test')).toBeVisible();
    await userEvent.click(screen.getByRole('button', { name: 'Logout' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('unavailable');
    expect(runtime.client.getQueryData(['session', 0])).toEqual(session);
  });
  it('clears caches after confirmed 204 logout', async () => {
    vi.spyOn(operatorApi, 'me').mockResolvedValue(session);
    vi.spyOn(operatorApi, 'logout').mockResolvedValue(undefined);
    const runtime = mount(<AccountPage />);
    await screen.findByText('controlled@example.test');
    runtime.client.setQueryData(['private', 'users'], ['fixture']);
    await userEvent.click(screen.getByRole('button', { name: 'Logout' }));
    await waitFor(() =>
      expect(runtime.client.getQueryData(['private', 'users'])).toBeUndefined(),
    );
    expect(runtime.generation()).toBe(1);
  });
});
