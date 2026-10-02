import { describe, it, expect, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderApp, fixtureSession } from '@/test/providers';
import { operatorApi } from '@/lib/api/operator';
import { ApiFailure } from '@/lib/api/client';
import { newPasswordSchema } from '@/features/auth/schemas';
import { resetSchema } from './hooks';
import { ForgotPasswordPage, ResetPasswordPage } from './views';
import { useSession } from '@/app/session';
import { toast } from 'sonner';

describe('same-browser recovery UI', () => {
  it.each([false, true])(
    'preserves a newer session when a late reset failure=%s arrives',
    async (failed) => {
      vi.spyOn(operatorApi, 'me').mockResolvedValue(fixtureSession);
      const notify = vi.spyOn(toast, 'success');
      let complete: () => void = () => {};
      vi.spyOn(operatorApi, 'reset').mockImplementation(
        () =>
          new Promise((resolve, reject) => {
            complete = () =>
              failed
                ? reject(
                    new ApiFailure('PASSWORD_RESET_OUTCOME_UNKNOWN', 503, true),
                  )
                : resolve(undefined);
          }),
      );
      function NewSession() {
        const session = useSession();
        return (
          <button onClick={() => session.establish(fixtureSession)}>
            New session
          </button>
        );
      }
      const { runtime } = renderApp(
        <>
          <ResetPasswordPage />
          <NewSession />
        </>,
      );
      await userEvent.type(
        screen.getByLabelText('New password'),
        'valid-password',
      );
      await userEvent.type(
        screen.getByLabelText('Confirm password'),
        'valid-password',
      );
      await userEvent.click(
        screen.getByRole('button', { name: 'Reset password' }),
      );
      expect(screen.getByLabelText('New password')).toHaveValue('');
      await userEvent.click(
        screen.getByRole('button', { name: 'New session' }),
      );
      const generation = runtime.generation();
      complete();
      await waitFor(() =>
        expect(
          screen.queryByRole('button', { name: 'Resetting password…' }),
        ).not.toBeInTheDocument(),
      );
      expect(runtime.generation()).toBe(generation);
      expect(runtime.client.getQueryData(['session', generation])).toEqual(
        fixtureSession,
      );
      expect(notify).not.toHaveBeenCalled();
    },
  );
  it('validates UTF-8 bytes and local confirmation', () => {
    expect(newPasswordSchema.safeParse('a'.repeat(72)).success).toBe(true);
    expect(newPasswordSchema.safeParse('é'.repeat(37)).success).toBe(false);
    expect(
      resetSchema.safeParse({
        password: 'valid-password',
        confirmation: 'different',
      }).success,
    ).toBe(false);
  });
  it('shows generic acknowledgement without promising delivery', async () => {
    vi.spyOn(operatorApi, 'me').mockResolvedValue(fixtureSession);
    const forgot = vi
      .spyOn(operatorApi, 'forgot')
      .mockResolvedValue({ message: 'fixture' });
    renderApp(<ForgotPasswordPage />);
    await userEvent.type(
      screen.getByLabelText('Email'),
      'controlled@example.test',
    );
    await userEvent.click(
      screen.getByRole('button', { name: 'Request recovery email' }),
    );
    expect(await screen.findByRole('status')).toHaveTextContent(
      'does not confirm delivery',
    );
    expect(forgot).toHaveBeenCalledWith({ email: 'controlled@example.test' });
  });
  it('marks a non-operator email invalid and allows correction without automatic retry', async () => {
    vi.spyOn(operatorApi, 'me').mockResolvedValue(fixtureSession);
    const forgot = vi
      .spyOn(operatorApi, 'forgot')
      .mockRejectedValueOnce(
        new ApiFailure('OPERATOR_RECOVERY_UNAVAILABLE', 400, false),
      )
      .mockResolvedValueOnce({ message: 'fixture' });
    renderApp(<ForgotPasswordPage />);
    const email = screen.getByLabelText('Email');
    await userEvent.type(email, 'ordinary@example.test');
    await userEvent.click(
      screen.getByRole('button', { name: 'Request recovery email' }),
    );
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(
      'Password recovery is only available for operator accounts.',
    );
    expect(alert).toHaveAttribute('id', 'recovery-email-error');
    expect(email).toHaveAttribute('aria-invalid', 'true');
    await waitFor(() => expect(email).toHaveFocus());
    expect(email).toHaveValue('ordinary@example.test');
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(forgot).toHaveBeenCalledTimes(1);
    await userEvent.clear(email);
    await userEvent.type(email, 'operator@example.test');
    await userEvent.click(
      screen.getByRole('button', { name: 'Request recovery email' }),
    );
    expect(await screen.findByRole('status')).toHaveTextContent(
      'does not confirm delivery',
    );
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(forgot).toHaveBeenCalledTimes(2);
    expect(forgot).toHaveBeenLastCalledWith({ email: 'operator@example.test' });
  });
  it('shows dependency failure separately from email eligibility', async () => {
    vi.spyOn(operatorApi, 'me').mockResolvedValue(fixtureSession);
    const forgot = vi
      .spyOn(operatorApi, 'forgot')
      .mockRejectedValue(new ApiFailure('DEPENDENCY_UNAVAILABLE', 503, false));
    renderApp(<ForgotPasswordPage />);
    await userEvent.type(
      screen.getByLabelText('Email'),
      'operator@example.test',
    );
    await userEvent.click(
      screen.getByRole('button', { name: 'Request recovery email' }),
    );
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'A required service is unavailable.',
    );
    expect(screen.getByLabelText('Email')).toHaveAttribute(
      'aria-invalid',
      'false',
    );
    expect(forgot).toHaveBeenCalledTimes(1);
  });
  it('clears private caches after 204 and sends only password', async () => {
    vi.spyOn(operatorApi, 'me').mockResolvedValue(fixtureSession);
    const reset = vi.spyOn(operatorApi, 'reset').mockResolvedValue(undefined);
    const { runtime } = renderApp(<ResetPasswordPage />);
    runtime.client.setQueryData(['private', 'fixture'], ['private']);
    await userEvent.type(
      screen.getByLabelText('New password'),
      'valid-password',
    );
    await userEvent.type(
      screen.getByLabelText('Confirm password'),
      'valid-password',
    );
    await userEvent.click(
      screen.getByRole('button', { name: 'Reset password' }),
    );
    expect(await screen.findByRole('status')).toHaveTextContent(
      'Your dashboard sessions were cleared.',
    );
    expect(reset).toHaveBeenCalledWith({ password: 'valid-password' });
    expect(runtime.client.getQueryData(['private', 'fixture'])).toBeUndefined();
  });
  it.each([
    'INVALID_RECOVERY',
    'PASSWORD_RESET_SAME_PASSWORD',
    'PASSWORD_RESET_WEAK_PASSWORD',
    'PASSWORD_RESET_REJECTED',
    'PASSWORD_RESET_RATE_LIMITED',
    'PASSWORD_RESET_OUTCOME_UNKNOWN',
    'PASSWORD_RESET_COMPLETION_FAILED',
  ])('blocks repeat reset after %s and releases secrets', async (code) => {
    vi.spyOn(operatorApi, 'me').mockResolvedValue(fixtureSession);
    const reset = vi
      .spyOn(operatorApi, 'reset')
      .mockRejectedValue(
        new ApiFailure(
          code,
          code === 'PASSWORD_RESET_RATE_LIMITED'
            ? 429
            : code.endsWith('UNKNOWN') || code.endsWith('COMPLETION_FAILED')
              ? 503
              : 400,
          code.endsWith('UNKNOWN') || code.endsWith('COMPLETION_FAILED'),
        ),
      );
    renderApp(<ResetPasswordPage />);
    await userEvent.type(
      screen.getByLabelText('New password'),
      'valid-password',
    );
    await userEvent.type(
      screen.getByLabelText('Confirm password'),
      'valid-password',
    );
    await userEvent.click(
      screen.getByRole('button', { name: 'Reset password' }),
    );
    expect(await screen.findByRole('alert')).toBeVisible();
    if (code === 'PASSWORD_RESET_SAME_PASSWORD') {
      expect(screen.getByRole('alert')).toHaveTextContent(
        'different from your current password',
      );
      expect(screen.getByRole('alert')).not.toHaveTextContent(
        'missing, expired',
      );
    }
    await waitFor(() =>
      expect(screen.getByLabelText('New password')).toHaveValue(''),
    );
    expect(
      screen.getByRole('button', { name: 'Reset password' }),
    ).toBeDisabled();
    expect(reset).toHaveBeenCalledTimes(1);
  });
});
