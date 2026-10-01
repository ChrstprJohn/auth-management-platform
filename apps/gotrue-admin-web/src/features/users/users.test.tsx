import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Routes, Route } from 'react-router-dom';
import { operatorApi } from '@/lib/api/operator';
import { ApiFailure } from '@/lib/api/client';
import { parsePagination } from '@/lib/query/pagination';
import { renderApp, fixtureSession } from '@/test/providers';
import { UsersPage, UserDetailsPage, CreateUserPage } from './views';

export const fixtureUser = {
  id: '00000000-0000-4000-8000-000000000003',
  email: 'disposable@example.test',
  createdAt: null,
  emailConfirmedAt: null,
  lastSignInAt: null,
  bannedUntil: null,
  isBanned: null,
};
describe('global account browsing and creation', () => {
  it('bounds URL pagination without accepting arbitrary values', () => {
    expect(
      parsePagination(new URLSearchParams('page=-1&perPage=1000')),
    ).toEqual({ page: 1, perPage: 20, invalid: true });
    expect(
      parsePagination(new URLSearchParams('page=10000&perPage=100')),
    ).toEqual({ page: 10000, perPage: 100, invalid: false });
  });
  it('distinguishes empty and failed reads', async () => {
    vi.spyOn(operatorApi, 'me').mockResolvedValue(fixtureSession);
    vi.spyOn(operatorApi, 'users').mockRejectedValue(
      new ApiFailure('DEPENDENCY_UNAVAILABLE', 503, false),
    );
    renderApp(<UsersPage />);
    expect(await screen.findByRole('alert')).toHaveTextContent('unavailable');
    expect(screen.queryByText('No users on this page')).not.toBeInTheDocument();
  });
  it('renders safe null fields and page boundaries', async () => {
    vi.spyOn(operatorApi, 'me').mockResolvedValue(fixtureSession);
    vi.spyOn(operatorApi, 'users').mockResolvedValue({
      users: [fixtureUser],
      page: 1,
      perPage: 20,
      hasNextPage: false,
    });
    renderApp(<UsersPage />);
    expect(await screen.findByText('disposable@example.test')).toBeVisible();
    expect(screen.getByText('Ban status unknown')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Previous' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled();
  });
  it('renders a missing detail without suggesting an uncertain delete succeeded', async () => {
    vi.spyOn(operatorApi, 'me').mockResolvedValue(fixtureSession);
    vi.spyOn(operatorApi, 'user').mockRejectedValue(
      new ApiFailure('USER_NOT_FOUND', 404, false),
    );
    renderApp(
      <Routes>
        <Route path="/users/:id" element={<UserDetailsPage />} />
      </Routes>,
      `/users/${fixtureUser.id}`,
    );
    expect(await screen.findByText('Account not found')).toBeVisible();
    expect(screen.getByText(/does not establish/)).toBeVisible();
  });
  it.each(['Require verification', 'Operator confirmed'])(
    'requires and sends explicit policy %s without claiming email delivery',
    async (label) => {
      vi.spyOn(operatorApi, 'me').mockResolvedValue(fixtureSession);
      const create = vi
        .spyOn(operatorApi, 'create')
        .mockResolvedValue({ user: fixtureUser, auditId: fixtureUser.id });
      renderApp(<CreateUserPage />);
      const user = userEvent.setup();
      await user.type(screen.getByLabelText('Email'), fixtureUser.email);
      await user.type(screen.getByLabelText('Password'), 'valid-password');
      await user.click(screen.getByRole('radio', { name: label }));
      await user.click(screen.getByRole('button', { name: 'Create user' }));
      expect(
        await screen.findByText('Account creation confirmed'),
      ).toBeVisible();
      expect(create).toHaveBeenCalledWith({
        email: fixtureUser.email,
        password: 'valid-password',
        confirmation:
          label === 'Require verification'
            ? 'require_verification'
            : 'operator_confirmed',
      });
      expect(screen.getByText(/without sending an invitation/)).toBeVisible();
      expect(screen.queryByLabelText('Password')).not.toBeInTheDocument();
    },
  );
  it('blocks repeat after unknown creation and retains support metadata', async () => {
    vi.spyOn(operatorApi, 'me').mockResolvedValue(fixtureSession);
    const create = vi
      .spyOn(operatorApi, 'create')
      .mockRejectedValue(
        new ApiFailure(
          'UPSTREAM_OUTCOME_UNKNOWN',
          503,
          true,
          fixtureUser.id,
          fixtureUser.id,
          'unknown',
        ),
      );
    renderApp(<CreateUserPage />);
    await userEvent.type(screen.getByLabelText('Email'), fixtureUser.email);
    await userEvent.type(screen.getByLabelText('Password'), 'valid-password');
    await userEvent.click(
      screen.getByRole('radio', { name: 'Operator confirmed' }),
    );
    await userEvent.click(screen.getByRole('button', { name: 'Create user' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'may have applied',
    );
    expect(screen.getByRole('button', { name: 'Create user' })).toBeDisabled();
    expect(create).toHaveBeenCalledTimes(1);
    expect(screen.getByLabelText('Password')).toHaveValue('');
  });
});
