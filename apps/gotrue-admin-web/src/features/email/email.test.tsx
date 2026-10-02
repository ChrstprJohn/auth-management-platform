import { describe, it, expect, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderApp, fixtureSession } from '@/test/providers';
import { operatorApi } from '@/lib/api/operator';
import { ApiFailure } from '@/lib/api/client';
import { EmailProofPage, InviteUserPage } from './views';
import { consumeEmailCallback } from './hooks';
import { useSession } from '@/app/session';

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
  it('validates invitation email and retains acceptance without silently repeating a send', async () => {
    vi.spyOn(operatorApi, 'me').mockResolvedValue(fixtureSession);
    const invite = vi.spyOn(operatorApi, 'invite').mockResolvedValue({
      user: {
        id: fixtureSession.operator.id,
        email: 'invited@example.test',
        createdAt: null,
        emailConfirmedAt: null,
        invitedAt: '2026-01-01T00:00:00Z',
        lastSignInAt: null,
        bannedUntil: null,
        isBanned: false,
      },
      auditId: fixtureSession.operator.id,
    });
    renderApp(<InviteUserPage />);
    await userEvent.click(
      screen.getByRole('button', { name: 'Send invitation' }),
    );
    expect(invite).not.toHaveBeenCalled();
    await userEvent.type(
      screen.getByLabelText('Recipient email'),
      'invited@example.test',
    );
    await userEvent.dblClick(
      screen.getByRole('button', { name: 'Send invitation' }),
    );
    expect(
      await screen.findByText('Invitation request accepted'),
    ).toBeVisible();
    await waitFor(() => expect(invite).toHaveBeenCalledTimes(1));
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
