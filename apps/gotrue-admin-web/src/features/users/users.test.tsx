import { describe, it, expect, vi } from 'vitest';
import { screen, within, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  Routes,
  Route,
  Link,
  useLocation,
  useNavigate,
  type NavigateFunction,
} from 'react-router-dom';
import { useSession } from '@/app/session';
import { operatorApi } from '@/lib/api/operator';
import { ApiFailure } from '@/lib/api/client';
import { parsePagination } from '@/lib/query/pagination';
import { renderApp, fixtureSession } from '@/test/providers';
import { UsersPage, UserDetailsPage, LegacyCreateUserRoute } from './views';
import { createSchema } from './creation';
import { toast } from 'sonner';

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
    vi.spyOn(operatorApi, 'users').mockResolvedValue({
      users: [fixtureUser],
      page: 1,
      perPage: 20,
      hasNextPage: false,
    });
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
    expect(screen.getAllByRole('columnheader')).toHaveLength(5);
    await userEvent.click(
      screen.getByRole('button', {
        name: 'Actions for disposable@example.test',
      }),
    );
    expect(
      await screen.findByRole('menuitem', {
        name: `View ${fixtureUser.email}`,
      }),
    ).toHaveAttribute('href', `/users/${fixtureUser.id}`);
  });
  it('renders a missing detail without suggesting an uncertain delete succeeded', async () => {
    vi.spyOn(operatorApi, 'me').mockResolvedValue(fixtureSession);
    vi.spyOn(operatorApi, 'users').mockResolvedValue({
      users: [fixtureUser],
      page: 1,
      perPage: 20,
      hasNextPage: false,
    });
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
      vi.spyOn(operatorApi, 'users').mockResolvedValue({
        users: [fixtureUser],
        page: 1,
        perPage: 20,
        hasNextPage: false,
      });
      const create = vi
        .spyOn(operatorApi, 'create')
        .mockResolvedValue({ user: fixtureUser, auditId: fixtureUser.id });
      const notify = vi.spyOn(toast, 'success');
      renderApp(<UsersPage />, '/users');
      await userEvent.click(
        screen.getByRole('button', { name: 'Create user' }),
      );
      const user = userEvent.setup();
      await user.type(screen.getByLabelText('Email'), fixtureUser.email);
      await user.type(screen.getByLabelText('Password'), 'valid-password');
      await user.click(screen.getByRole('radio', { name: label }));
      await user.click(screen.getByRole('button', { name: 'Create user' }));
      await waitFor(() =>
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
      );
      expect(notify).toHaveBeenCalledExactlyOnceWith('User created');
      expect(create).toHaveBeenCalledWith({
        email: fixtureUser.email,
        password: 'valid-password',
        confirmation:
          label === 'Require verification'
            ? 'require_verification'
            : 'operator_confirmed',
      });
      expect(screen.queryByLabelText('Password')).not.toBeInTheDocument();
    },
  );
  it('blocks repeat after unknown creation and retains support metadata', async () => {
    vi.spyOn(operatorApi, 'me').mockResolvedValue(fixtureSession);
    vi.spyOn(operatorApi, 'users').mockResolvedValue({
      users: [fixtureUser],
      page: 1,
      perPage: 20,
      hasNextPage: false,
    });
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
    renderApp(<UsersPage />, '/users');
    await userEvent.click(screen.getByRole('button', { name: 'Create user' }));
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
  it('keeps uncertain creation blocked after leaving and returning to the form', async () => {
    vi.spyOn(operatorApi, 'me').mockResolvedValue(fixtureSession);
    vi.spyOn(operatorApi, 'users').mockResolvedValue({
      users: [fixtureUser],
      page: 1,
      perPage: 20,
      hasNextPage: false,
    });
    const create = vi
      .spyOn(operatorApi, 'create')
      .mockRejectedValue(new ApiFailure('UPSTREAM_OUTCOME_UNKNOWN', 503, true));
    renderApp(
      <>
        <Link to="/elsewhere">Leave form</Link>
        <Link to="/users/new">Return to form</Link>
        <Routes>
          <Route path="/users/new" element={<LegacyCreateUserRoute />} />
          <Route path="/users" element={<UsersPage />} />
          <Route path="/elsewhere" element={<p>Elsewhere</p>} />
        </Routes>
      </>,
      '/users/new',
    );
    await userEvent.type(screen.getByLabelText('Email'), fixtureUser.email);
    await userEvent.type(screen.getByLabelText('Password'), 'valid-password');
    await userEvent.click(
      screen.getByRole('radio', { name: 'Operator confirmed' }),
    );
    await userEvent.click(screen.getByRole('button', { name: 'Create user' }));
    await screen.findByRole('alert');
    await userEvent.click(screen.getByRole('button', { name: 'Close' }));
    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
    );
    await userEvent.click(screen.getByRole('link', { name: 'Leave form' }));
    await screen.findByText('Elsewhere');
    await userEvent.click(screen.getByRole('link', { name: 'Return to form' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'may have applied',
    );
    expect(screen.getByRole('button', { name: 'Create user' })).toBeDisabled();
    expect(create).toHaveBeenCalledTimes(1);
  });
});

describe('create-user dialog lifecycle', () => {
  function setup({ empty = false, legacy = false } = {}) {
    vi.spyOn(operatorApi, 'me').mockResolvedValue(fixtureSession);
    const users = vi.spyOn(operatorApi, 'users').mockResolvedValue({
      users: empty ? [] : [fixtureUser],
      page: 3,
      perPage: 50,
      hasNextPage: false,
    });
    const controls: { navigate?: NavigateFunction; clear?: () => void } = {};
    function Controls() {
      controls.navigate = useNavigate();
      controls.clear = useSession().clear;
      const location = useLocation();
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
        <Routes>
          <Route path="/users" element={<UsersPage />} />
          <Route path="/users/new" element={<LegacyCreateUserRoute />} />
          <Route path="/history" element={<p>Read-only history</p>} />
          <Route path="/history/:id" element={<p>Read-only history</p>} />
        </Routes>
      </>,
      `/users${legacy ? '/new' : ''}?page=3&perPage=50`,
    );
    return { ...rendered, users, controls };
  }
  async function open() {
    await userEvent.click(
      await screen.findByRole('button', { name: 'Create user' }),
    );
    return screen.findByRole('dialog', { name: 'Create user' });
  }
  async function fill(dialog: HTMLElement) {
    await userEvent.type(
      within(dialog).getByLabelText('Email'),
      fixtureUser.email,
    );
    await userEvent.type(
      within(dialog).getByLabelText('Password'),
      'valid-password',
    );
    await userEvent.click(
      within(dialog).getByRole('radio', { name: 'Operator confirmed' }),
    );
  }
  it('redirects legacy URLs to Users while retaining pagination and opening the dialog', async () => {
    const { users } = setup({ legacy: true });
    await screen.findByRole('dialog', { name: 'Create user' });
    expect(screen.getByLabelText('Current route')).toHaveTextContent(
      '/users?page=3&perPage=50',
    );
    expect(users).toHaveBeenCalledWith(3, 50, expect.any(AbortSignal));
    expect((await screen.findAllByText('Page 3'))[0]).toBeInTheDocument();
    await userEvent.keyboard('{Escape}');
    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
    );
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Create user' })).toHaveFocus(),
    );
  });
  it('opens from the empty-state trigger and returns focus on cancel without a request', async () => {
    const create = vi.spyOn(operatorApi, 'create');
    setup({ empty: true });
    await screen.findByText('No users on this page');
    const triggers = screen.getAllByRole('button', { name: 'Create user' });
    const trigger = triggers[1];
    if (!trigger) throw new Error('Empty-state create trigger missing');
    await userEvent.click(trigger);
    const dialog = await screen.findByRole('dialog');
    await fill(dialog);
    await userEvent.click(
      within(dialog).getByRole('button', { name: 'Cancel' }),
    );
    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
    );
    expect(trigger).toHaveFocus();
    await userEvent.click(trigger);
    expect(await screen.findByLabelText('Password')).toHaveValue('');
    expect(create).not.toHaveBeenCalled();
  });
  it('focuses the first invalid field and requires an explicit policy and UTF-8 byte limit', async () => {
    const create = vi.spyOn(operatorApi, 'create');
    setup();
    const dialog = await open();
    await userEvent.click(
      within(dialog).getByRole('button', { name: 'Create user' }),
    );
    await waitFor(() => expect(screen.getByLabelText('Email')).toHaveFocus());
    expect(
      await screen.findByText('Choose a confirmation policy.'),
    ).toBeVisible();
    expect(
      createSchema.safeParse({
        email: fixtureUser.email,
        password: 'é'.repeat(37),
        confirmation: 'operator_confirmed',
      }).success,
    ).toBe(false);
    expect(create).not.toHaveBeenCalled();
  });
  it('blocks pending dismissal and duplicates, then closes, notifies once and reopens a fresh form', async () => {
    const notify = vi.spyOn(toast, 'success');
    let complete:
      | ((result: { user: typeof fixtureUser; auditId: string }) => void)
      | undefined;
    const create = vi.spyOn(operatorApi, 'create').mockImplementation(
      () =>
        new Promise((resolve) => {
          complete = resolve;
        }),
    );
    const { runtime, users } = setup();
    runtime.client.setQueryData(['private', 0, 'audit', 1, 20], {
      entries: [],
    });
    runtime.client.setQueryData(['private', 0, 'dashboard-users'], {
      users: [],
    });
    const dialog = await open();
    await fill(dialog);
    await userEvent.dblClick(
      within(dialog).getByRole('button', { name: 'Create user' }),
    );
    expect(
      await screen.findByRole('button', { name: /Creating user/ }),
    ).toBeDisabled();
    expect(within(dialog).getByLabelText('Password')).toHaveValue('');
    expect(
      within(dialog).getByRole('button', { name: 'Cancel' }),
    ).toBeDisabled();
    await userEvent.keyboard('{Escape}');
    const backdrop = document.querySelector('[data-slot="dialog-overlay"]');
    if (!backdrop) throw new Error('Dialog backdrop missing');
    await userEvent.click(backdrop);
    expect(screen.getByRole('dialog')).toBeVisible();
    expect(create).toHaveBeenCalledTimes(1);
    await act(async () => {
      complete?.({ user: fixtureUser, auditId: fixtureUser.id });
    });
    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
    );
    expect(notify).toHaveBeenCalledExactlyOnceWith('User created');
    await waitFor(() => expect(users).toHaveBeenCalledTimes(2));
    expect(
      runtime.client.getQueryState(['private', 0, 'audit', 1, 20])
        ?.isInvalidated,
    ).toBe(true);
    expect(
      runtime.client.getQueryState(['private', 0, 'dashboard-users'])
        ?.isInvalidated,
    ).toBe(true);
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Create user' })).toHaveFocus(),
    );
    await open();
    expect(await screen.findByLabelText('Password')).toHaveValue('');
    expect(screen.getByLabelText('Email')).toHaveValue('');
    expect(
      screen.getByRole('radio', { name: 'Operator confirmed' }),
    ).not.toBeChecked();
    await waitFor(() => expect(screen.getByLabelText('Email')).toHaveFocus());
    expect(create).toHaveBeenCalledTimes(1);
    expect(notify).toHaveBeenCalledTimes(1);
  });
  it.each(['UPSTREAM_OUTCOME_UNKNOWN', 'AUDIT_COMPLETION_FAILED'])(
    'keeps %s blocked across close/reopen and read-only navigation',
    async (code) => {
      const create = vi
        .spyOn(operatorApi, 'create')
        .mockRejectedValue(
          new ApiFailure(
            code,
            503,
            true,
            fixtureUser.id,
            fixtureUser.id,
            code === 'AUDIT_COMPLETION_FAILED' ? 'succeeded' : 'unknown',
          ),
        );
      const { controls } = setup();
      const dialog = await open();
      await fill(dialog);
      await userEvent.click(
        within(dialog).getByRole('button', { name: 'Create user' }),
      );
      expect(await screen.findByRole('alert')).toHaveTextContent(
        fixtureUser.id,
      );
      await userEvent.click(screen.getByRole('link', { name: 'View history' }));
      await screen.findByText('Read-only history');
      await act(async () => {
        controls.navigate?.('/users?page=3&perPage=50');
      });
      await open();
      expect(
        screen.getByRole('button', { name: 'Create user' }),
      ).toBeDisabled();
      expect(screen.getByRole('alert')).toHaveTextContent(fixtureUser.id);
      expect(screen.getByLabelText('Password')).toHaveValue('');
      expect(create).toHaveBeenCalledTimes(1);
    },
  );
  it('retains the pending lock across navigation and ignores a late response after session loss', async () => {
    const notify = vi.spyOn(toast, 'success');
    let complete:
      | ((result: { user: typeof fixtureUser; auditId: string }) => void)
      | undefined;
    const create = vi.spyOn(operatorApi, 'create').mockImplementation(
      () =>
        new Promise((resolve) => {
          complete = resolve;
        }),
    );
    const { controls, runtime } = setup();
    const dialog = await open();
    await fill(dialog);
    await userEvent.click(
      within(dialog).getByRole('button', { name: 'Create user' }),
    );
    await screen.findByRole('button', { name: /Creating user/ });
    await act(async () => {
      controls.navigate?.('/history');
    });
    await screen.findByText('Read-only history');
    await act(async () => {
      controls.navigate?.('/users');
    });
    await open();
    expect(
      screen.getByRole('button', { name: /Creating user/ }),
    ).toBeDisabled();
    await act(async () => {
      controls.clear?.();
    });
    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
    );
    await act(async () => {
      complete?.({ user: fixtureUser, auditId: fixtureUser.id });
    });
    expect(
      runtime.client.getQueryCache().findAll({ queryKey: ['private', 0] }),
    ).toHaveLength(0);
    await open();
    expect(
      screen.queryByText('Account creation confirmed'),
    ).not.toBeInTheDocument();
    expect(create).toHaveBeenCalledTimes(1);
    expect(notify).not.toHaveBeenCalled();
  });
  it.each(['USER_EXISTS', 'RATE_LIMITED', 'DEPENDENCY_UNAVAILABLE'])(
    'renders safe %s failure and releases the password',
    async (code) => {
      const notify = vi.spyOn(toast, 'error');
      const create = vi
        .spyOn(operatorApi, 'create')
        .mockRejectedValue(
          new ApiFailure(
            code,
            code === 'RATE_LIMITED' ? 429 : code === 'USER_EXISTS' ? 409 : 503,
            false,
            fixtureUser.id,
          ),
        );
      setup();
      const dialog = await open();
      await fill(dialog);
      await userEvent.click(
        within(dialog).getByRole('button', { name: 'Create user' }),
      );
      await waitFor(() => expect(notify).toHaveBeenCalledTimes(1));
      const details = screen.getByText('Technical details');
      await userEvent.click(details);
      expect(screen.getByText(`Request ID: ${fixtureUser.id}`)).toBeVisible();
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
      expect(screen.getByLabelText('Password')).toHaveValue('');
      expect(screen.getByRole('button', { name: 'Create user' })).toBeEnabled();
      expect(create).toHaveBeenCalledTimes(1);
    },
  );
});
