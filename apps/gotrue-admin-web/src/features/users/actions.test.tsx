import { describe, it, expect, vi } from 'vitest';
import { screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { operatorApi } from '@/lib/api/operator';
import { ApiFailure } from '@/lib/api/client';
import { renderApp, fixtureSession } from '@/test/providers';
import { UserActions, ActionOutcome, durationSchema } from './actions';

const user = {
  id: '00000000-0000-4000-8000-000000000003',
  email: 'disposable@example.test',
  createdAt: null,
  emailConfirmedAt: null,
  lastSignInAt: null,
  bannedUntil: null,
  isBanned: false,
};
function mount() {
  vi.spyOn(operatorApi, 'me').mockResolvedValue(fixtureSession);
  return renderApp(
    <>
      <ActionOutcome />
      <UserActions user={user} />
    </>,
  );
}
describe('confirmed global mutations', () => {
  it('bounds ban duration', () => {
    for (const durationHours of [0, 8761, 1.5, NaN])
      expect(durationSchema.safeParse({ durationHours }).success).toBe(false);
    expect(durationSchema.safeParse({ durationHours: 8760 }).success).toBe(
      true,
    );
  });
  it('cancel sends no mutation', async () => {
    const remove = vi.spyOn(operatorApi, 'delete');
    mount();
    await userEvent.click(
      screen.getByRole('button', { name: 'Permanently delete user' }),
    );
    const dialog = await screen.findByRole('alertdialog');
    expect(dialog).toHaveTextContent(user.id);
    expect(dialog).toHaveTextContent('shared GoTrue identity');
    await userEvent.click(
      within(dialog).getByRole('button', { name: 'Cancel' }),
    );
    await waitFor(() =>
      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument(),
    );
    expect(remove).not.toHaveBeenCalled();
  });
  it('suppresses repeated clicks and retains pending feedback', async () => {
    let complete: (result: {
      user: typeof user;
      auditId: string;
    }) => void = () => {};
    const ban = vi.spyOn(operatorApi, 'ban').mockImplementation(
      () =>
        new Promise((resolve) => {
          complete = resolve;
        }),
    );
    mount();
    await userEvent.click(screen.getByRole('button', { name: 'Ban user' }));
    const dialog = await screen.findByRole('alertdialog');
    await userEvent.dblClick(
      within(dialog).getByRole('button', { name: 'Confirm ban' }),
    );
    expect(ban).toHaveBeenCalledTimes(1);
    expect(ban).toHaveBeenCalledWith(user.id, 24);
    expect(
      within(dialog).getByRole('button', { name: 'Cancel' }),
    ).toBeDisabled();
    expect(screen.getByText('Management action pending')).toBeVisible();
    complete({ user, auditId: user.id });
    expect(await screen.findByText('Ban confirmed')).toBeVisible();
  });
  it.each([
    'DELETION_DISABLED',
    'LAST_USABLE_OPERATOR',
    'MUTATION_IN_PROGRESS',
    'RECONCILIATION_REQUIRED',
  ])('renders %s without losing target or reporting success', async (code) => {
    const remove = vi
      .spyOn(operatorApi, 'delete')
      .mockRejectedValue(
        new ApiFailure(code, code === 'DELETION_DISABLED' ? 403 : 409, false),
      );
    mount();
    await userEvent.click(
      screen.getByRole('button', { name: 'Permanently delete user' }),
    );
    const dialog = await screen.findByRole('alertdialog');
    await userEvent.click(
      within(dialog).getByRole('button', {
        name: 'Confirm permanent deletion',
      }),
    );
    expect(await within(dialog).findByRole('alert')).toBeVisible();
    expect(dialog).toHaveTextContent(user.id);
    expect(
      screen.queryByText('Permanent deletion confirmed'),
    ).not.toBeInTheDocument();
    expect(remove).toHaveBeenCalledTimes(1);
  });
  it('retains uncertain outcome after overlay closure and blocks all ordinary repeats', async () => {
    const unban = vi
      .spyOn(operatorApi, 'unban')
      .mockRejectedValue(
        new ApiFailure(
          'AUDIT_COMPLETION_FAILED',
          503,
          true,
          user.id,
          user.id,
          'succeeded',
        ),
      );
    mount();
    await userEvent.click(screen.getByRole('button', { name: 'Unban user' }));
    const dialog = await screen.findByRole('alertdialog');
    await userEvent.click(
      within(dialog).getByRole('button', { name: 'Confirm unban' }),
    );
    expect(await within(dialog).findByRole('alert')).toHaveTextContent(
      'Known upstream outcome: succeeded',
    );
    await userEvent.click(
      within(dialog).getByRole('button', { name: 'Cancel' }),
    );
    await waitFor(() =>
      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument(),
    );
    expect(screen.getByRole('alert')).toHaveTextContent(
      'could not be fully recorded',
    );
    expect(screen.getByRole('button', { name: 'Unban user' })).toBeDisabled();
    expect(unban).toHaveBeenCalledTimes(1);
  });
});
