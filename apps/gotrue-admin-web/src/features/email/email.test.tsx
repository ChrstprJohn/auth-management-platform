import { describe, it, expect, vi } from 'vitest';
import { screen, waitFor, within, act } from '@testing-library/react';
import {
  Routes,
  Route,
  useLocation,
  useNavigate,
  type NavigateFunction,
} from 'react-router-dom';
import { toast } from 'sonner';
import userEvent from '@testing-library/user-event';
import { renderApp, fixtureSession } from '@/test/providers';
import { operatorApi } from '@/lib/api/operator';
import { ApiFailure } from '@/lib/api/client';
import { EmailProofPage, InviteUserPage } from './views';
import { consumeEmailCallback } from './hooks';
import { useSession } from '@/app/session';
import { UsersPage } from '@/features/users/views';
import { ActionOutcome } from '@/features/users/actions';

const invited = {
  id: fixtureSession.operator.id,
  email: 'invited@example.test',
  createdAt: null,
  emailConfirmedAt: null,
  invitedAt: '2026-10-02T01:15:00Z',
  lastSignInAt: null,
  bannedUntil: null,
  isBanned: false,
};
function mountInvite(legacy = false) {
  vi.spyOn(operatorApi, 'me').mockResolvedValue(fixtureSession);
  const users = vi
    .spyOn(operatorApi, 'users')
    .mockResolvedValue({
      users: [invited],
      page: 3,
      perPage: 50,
      hasNextPage: false,
    });
  const controls: { navigate?: NavigateFunction; establish?: () => void } = {};
  function Controls() {
    const location = useLocation();
    const session = useSession();
    controls.navigate = useNavigate();
    controls.establish = () => session.establish(fixtureSession);
    return (
      <output aria-label="Current route">
        {location.pathname}
        {location.search}
      </output>
    );
  }
  const rendered = renderApp(
    <>
      <Controls />
      <ActionOutcome />
      <Routes>
        <Route path="/users" element={<UsersPage />} />
        <Route path="/users/invite" element={<InviteUserPage />} />
        <Route path="/history/:id" element={<p>Read-only history</p>} />
        <Route path="/history" element={<p>Read-only history</p>} />
      </Routes>
    </>,
    `/users${legacy ? '/invite' : ''}?page=3&perPage=50`,
  );
  return { ...rendered, users, controls };
}

function EstablishNewSession() {
  const session = useSession();
  return (
    <button onClick={() => session.establish(fixtureSession)}>
      Establish newer session
    </button>
  );
}

describe('email workflows', () => {
  it('preserves a newer session when an earlier email proof completes', async () => {
    vi.spyOn(operatorApi, 'me').mockResolvedValue(fixtureSession);
    let complete: () => void = () => {};
    vi.spyOn(operatorApi, 'confirmEmail').mockImplementation(
      () =>
        new Promise<undefined>((resolve) => {
          complete = () => resolve(undefined);
        }),
    );
    const { runtime } = renderApp(
      <>
        <EmailProofPage />
        <EstablishNewSession />
      </>,
    );
    await userEvent.type(
      screen.getByLabelText('Email', { exact: true }),
      'invited@example.test',
    );
    await userEvent.type(screen.getByLabelText('Email code'), '123456');
    await userEvent.click(screen.getByRole('button', { name: 'Verify email' }));
    await userEvent.click(
      screen.getByRole('button', { name: 'Establish newer session' }),
    );
    const generation = runtime.generation();
    complete();
    expect(await screen.findByText('Email verified')).toBeVisible();
    expect(runtime.generation()).toBe(generation);
    expect(runtime.client.getQueryData(['session', generation])).toEqual(
      fixtureSession,
    );
  });
  it.each(['EMAIL_RATE_LIMITED', 'RATE_LIMITED'])(
    'allows deliberate re-entry after definite %s rejection without automatic retry',
    async (code) => {
      vi.spyOn(operatorApi, 'me').mockResolvedValue(fixtureSession);
      const confirm = vi
        .spyOn(operatorApi, 'confirmEmail')
        .mockRejectedValue(new ApiFailure(code, 429, false));
      renderApp(<EmailProofPage />);
      await userEvent.type(
        screen.getByLabelText('Email', { exact: true }),
        'invited@example.test',
      );
      await userEvent.type(screen.getByLabelText('Email code'), '123456');
      await userEvent.click(
        screen.getByRole('button', { name: 'Verify email' }),
      );
      await userEvent.click(
        await screen.findByRole('button', {
          name: 'Enter a code after waiting',
        }),
      );
      expect(screen.getByLabelText('Email code')).toBeEnabled();
      expect(screen.getByLabelText('Email code')).toHaveValue('');
      expect(confirm).toHaveBeenCalledTimes(1);
    },
  );
  it('clears proof and passwords before awaiting invitation acceptance and suppresses duplicates', async () => {
    vi.spyOn(operatorApi, 'me').mockResolvedValue(fixtureSession);
    let complete: () => void = () => {};
    const accept = vi.spyOn(operatorApi, 'acceptInvitation').mockImplementation(
      () =>
        new Promise<undefined>((resolve) => {
          complete = () => resolve(undefined);
        }),
    );
    const { runtime } = renderApp(<EmailProofPage invitation />);
    await userEvent.type(
      screen.getByLabelText('Email', { exact: true }),
      'invited@example.test',
    );
    await userEvent.type(screen.getByLabelText('Email code'), '123456');
    await userEvent.type(
      screen.getByLabelText('New password', { exact: true }),
      'new-password',
    );
    await userEvent.type(
      screen.getByLabelText('Confirm new password'),
      'new-password',
    );
    await userEvent.dblClick(
      screen.getByRole('button', { name: 'Verify email and set password' }),
    );
    expect(accept).toHaveBeenCalledTimes(1);
    expect(accept).toHaveBeenCalledWith({
      email: 'invited@example.test',
      code: '123456',
      password: 'new-password',
    });
    expect(screen.getByLabelText('Email code')).toHaveValue('');
    expect(screen.getByLabelText('New password', { exact: true })).toHaveValue(
      '',
    );
    expect(screen.getByLabelText('Confirm new password')).toHaveValue('');
    complete();
    expect(
      await screen.findByText('Email verified and password set'),
    ).toBeVisible();
    expect(
      runtime.client.getQueriesData({ queryKey: ['private'] }),
    ).toHaveLength(0);
  });
  it('blocks an ambiguous proof submission and offers no privileged inspection link', async () => {
    vi.spyOn(operatorApi, 'me').mockResolvedValue(fixtureSession);
    const confirm = vi
      .spyOn(operatorApi, 'confirmEmail')
      .mockRejectedValue(new ApiFailure('DEPENDENCY_UNAVAILABLE', 503, true));
    renderApp(<EmailProofPage />);
    await userEvent.type(
      screen.getByLabelText('Email', { exact: true }),
      'invited@example.test',
    );
    await userEvent.type(screen.getByLabelText('Email code'), '123456');
    await userEvent.click(screen.getByRole('button', { name: 'Verify email' }));
    expect(await screen.findByRole('alert')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Verify email' })).toBeDisabled();
    expect(
      screen.queryByRole('link', { name: /history/i }),
    ).not.toBeInTheDocument();
    expect(confirm).toHaveBeenCalledTimes(1);
  });
  it('opens the legacy entry over Users, preserves pagination and returns focus on idle close', async () => {
    const invite = vi.spyOn(operatorApi, 'invite');
    const { users } = mountInvite(true);
    expect(
      await screen.findByRole('dialog', { name: 'Invite user' }),
    ).toBeVisible();
    expect(screen.getByLabelText('Current route')).toHaveTextContent(
      '/users?page=3&perPage=50',
    );
    expect(users).toHaveBeenCalledWith(3, 50, expect.any(AbortSignal));
    await userEvent.type(
      screen.getByLabelText('Recipient email'),
      invited.email,
    );
    await userEvent.keyboard('{Escape}');
    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
    );
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Invite user' })).toHaveFocus(),
    );
    await userEvent.click(screen.getByRole('button', { name: 'Invite user' }));
    expect(await screen.findByLabelText('Recipient email')).toHaveValue('');
    expect(invite).not.toHaveBeenCalled();
  });
  it('validates invitation email, suppresses duplicates and closes with exactly one acceptance toast', async () => {
    const notify = vi.spyOn(toast, 'success');
    const invite = vi
      .spyOn(operatorApi, 'invite')
      .mockResolvedValue({ user: invited, auditId: invited.id });
    const { users } = mountInvite(true);
    await screen.findByRole('dialog');
    await userEvent.click(
      screen.getByRole('button', { name: 'Send invitation' }),
    );
    expect(invite).not.toHaveBeenCalled();
    await waitFor(() =>
      expect(screen.getByLabelText('Recipient email')).toHaveFocus(),
    );
    await userEvent.type(
      screen.getByLabelText('Recipient email'),
      'invited@example.test',
    );
    await userEvent.dblClick(
      screen.getByRole('button', { name: 'Send invitation' }),
    );
    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
    );
    expect(notify).toHaveBeenCalledExactlyOnceWith('Invitation requested');
    await waitFor(() => expect(invite).toHaveBeenCalledTimes(1));
    expect(users).toHaveBeenCalledTimes(2);
    await userEvent.click(screen.getByRole('button', { name: 'Invite user' }));
    expect(await screen.findByLabelText('Recipient email')).toHaveValue('');
    expect(notify).toHaveBeenCalledTimes(1);
  });
  it('retains a pending lock across dismissal attempts and navigation, then rejects a stale response', async () => {
    const notify = vi.spyOn(toast, 'success');
    let complete: () => void = () => {};
    const invite = vi.spyOn(operatorApi, 'invite').mockImplementation(
      () =>
        new Promise((resolve) => {
          complete = () => resolve({ user: invited, auditId: invited.id });
        }),
    );
    const { controls, runtime } = mountInvite(true);
    const dialog = await screen.findByRole('dialog');
    await userEvent.type(
      screen.getByLabelText('Recipient email'),
      invited.email,
    );
    await userEvent.dblClick(
      screen.getByRole('button', { name: 'Send invitation' }),
    );
    expect(
      within(dialog).getByRole('button', { name: 'Cancel' }),
    ).toBeDisabled();
    await userEvent.keyboard('{Escape}');
    const backdrop = document.querySelector('[data-slot="dialog-overlay"]');
    if (!backdrop) throw new Error('Missing dialog backdrop');
    await userEvent.click(backdrop);
    expect(dialog).toBeVisible();
    await act(async () => controls.navigate?.('/history'));
    expect(await screen.findByText('Invitation pending')).toBeVisible();
    await act(async () => controls.navigate?.('/users'));
    await userEvent.click(
      await screen.findByRole('button', { name: 'Invite user' }),
    );
    expect(
      await screen.findByRole('button', { name: /Requesting invitation…/ }),
    ).toBeDisabled();
    await act(async () => controls.establish?.());
    const generation = runtime.generation();
    await act(async () => complete());
    expect(runtime.generation()).toBe(generation);
    expect(runtime.client.getQueryData(['session', generation])).toEqual(
      fixtureSession,
    );
    expect(notify).not.toHaveBeenCalled();
    expect(invite).toHaveBeenCalledTimes(1);
  });
  it('keeps an uncertain invitation visible and blocked after history inspection and reopening', async () => {
    const notify = vi.spyOn(toast, 'success');
    const invite = vi
      .spyOn(operatorApi, 'invite')
      .mockRejectedValue(
        new ApiFailure(
          'AUDIT_COMPLETION_FAILED',
          503,
          true,
          invited.id,
          invited.id,
          'succeeded',
        ),
      );
    const { controls } = mountInvite(true);
    await screen.findByRole('dialog');
    await userEvent.type(
      screen.getByLabelText('Recipient email'),
      invited.email,
    );
    await userEvent.click(
      screen.getByRole('button', { name: 'Send invitation' }),
    );
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'could not be fully recorded',
    );
    expect(
      screen.getByRole('button', { name: 'Send invitation' }),
    ).toBeDisabled();
    await userEvent.click(screen.getByRole('button', { name: 'Close' }));
    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
    );
    expect(screen.getByRole('alert')).toBeVisible();
    await userEvent.click(screen.getByRole('link', { name: 'View history' }));
    await screen.findByText('Read-only history');
    await act(async () => controls.navigate?.('/users'));
    await userEvent.click(
      await screen.findByRole('button', { name: 'Invite user' }),
    );
    expect(
      screen.getByRole('button', { name: 'Send invitation' }),
    ).toBeDisabled();
    expect(invite).toHaveBeenCalledTimes(1);
    expect(notify).not.toHaveBeenCalled();
  });
  it('removes legacy callback credentials before rendering', () => {
    window.history.replaceState(
      null,
      '',
      '/auth/callback?error=expired#access_token=secret&refresh_token=secret',
    );
    expect(consumeEmailCallback()).toBe('invalid');
    expect(window.location.pathname).toBe('/auth/callback');
    expect(window.location.search).toBe('');
    expect(window.location.hash).toBe('');
    window.history.replaceState(null, '', '/');
  });
});
