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
import { AccountActionsProvider } from './account';
import { toast } from 'sonner';
import { useAccount } from './account';
import { useSession } from '@/app/session';

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
          <MemoryRouter>
            <AccountActionsProvider>{view}</AccountActionsProvider>
          </MemoryRouter>
        </TooltipProvider>
      </SessionProvider>
    </QueryClientProvider>,
  );
  return runtime;
}
describe('operator forms and account', () => {
  it('shares sign-out concurrency across controls and ignores completion after a newer sign-in', async () => {
    vi.spyOn(operatorApi, 'me').mockResolvedValue(session);
    const notify = vi.spyOn(toast, 'success');
    let complete: () => void = () => {};
    const logout = vi.spyOn(operatorApi, 'logout').mockImplementation(
      () =>
        new Promise((resolve) => {
          complete = () => resolve(undefined);
        }),
    );
    function Control({ label }: { label: string }) {
      const account = useAccount();
      return (
        <button disabled={account.pending} onClick={account.logout}>
          {label}
        </button>
      );
    }
    function NewSession() {
      const current = useSession();
      return (
        <button onClick={() => current.establish(session)}>New session</button>
      );
    }
    const runtime = mount(
      <>
        <Control label="First logout" />
        <Control label="Second logout" />
        <NewSession />
      </>,
    );
    await screen.findByRole('button', { name: 'First logout' });
    await waitFor(() =>
      expect(runtime.client.getQueryData(['session', 0])).toEqual(session),
    );
    await userEvent.dblClick(
      screen.getByRole('button', { name: 'First logout' }),
    );
    expect(
      screen.getByRole('button', { name: 'Second logout' }),
    ).toBeDisabled();
    expect(logout).toHaveBeenCalledTimes(1);
    await userEvent.click(screen.getByRole('button', { name: 'New session' }));
    const generation = runtime.generation();
    complete();
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Second logout' }),
      ).toBeEnabled(),
    );
    expect(runtime.client.getQueryData(['session', generation])).toEqual(
      session,
    );
    expect(notify).not.toHaveBeenCalled();
  });
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
    const notify = vi.spyOn(toast, 'error');
    vi.spyOn(operatorApi, 'me').mockResolvedValue(session);
    vi.spyOn(operatorApi, 'logout').mockRejectedValue(
      new ApiFailure('DEPENDENCY_UNAVAILABLE', 503, false),
    );
    const runtime = mount(<AccountPage />);
    expect(await screen.findByText('controlled@example.test')).toBeVisible();
    await userEvent.click(screen.getByRole('button', { name: 'Logout' }));
    await waitFor(() => expect(notify).toHaveBeenCalledTimes(1));
    await userEvent.click(
      screen.getAllByText('Technical details')[0] ??
        screen.getByText('Technical details'),
    );
    expect(screen.getByText(/required service is unavailable/)).toBeVisible();
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
