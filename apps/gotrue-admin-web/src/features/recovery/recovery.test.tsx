import { describe, it, expect, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderApp, fixtureSession } from '@/test/providers';
import { operatorApi } from '@/lib/api/operator';
import { ApiFailure } from '@/lib/api/client';
import { newPasswordSchema } from '@/features/auth/schemas';
import { resetSchema } from './hooks';
import { ForgotPasswordPage, ResetPasswordPage } from './views';

describe('same-browser recovery UI', () => {
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
      'Password reset confirmed',
    );
    expect(reset).toHaveBeenCalledWith({ password: 'valid-password' });
    expect(runtime.client.getQueryData(['private', 'fixture'])).toBeUndefined();
  });
  it.each([
    'INVALID_RECOVERY',
    'PASSWORD_RESET_OUTCOME_UNKNOWN',
    'PASSWORD_RESET_COMPLETION_FAILED',
  ])('blocks repeat reset after %s and releases secrets', async (code) => {
    vi.spyOn(operatorApi, 'me').mockResolvedValue(fixtureSession);
    const reset = vi
      .spyOn(operatorApi, 'reset')
      .mockRejectedValue(
        new ApiFailure(
          code,
          code === 'INVALID_RECOVERY' ? 400 : 503,
          code !== 'INVALID_RECOVERY',
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
    await waitFor(() =>
      expect(screen.getByLabelText('New password')).toHaveValue(''),
    );
    expect(
      screen.getByRole('button', { name: 'Reset password' }),
    ).toBeDisabled();
    expect(reset).toHaveBeenCalledTimes(1);
  });
});
