import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { Routes, Route } from 'react-router-dom';
import { AppRoutes } from '@/app/routes';
import userEvent from '@testing-library/user-event';
import { operatorApi } from '@/lib/api/operator';
import { ApiFailure } from '@/lib/api/client';
import { renderApp, fixtureSession } from '@/test/providers';
import { HistoryPage } from './views';
import { HistoryDetailsPage } from './details';

const id = '00000000-0000-4000-8000-000000000002';
const entry = {
  id,
  actorId: fixtureSession.operator.id,
  targetId: null,
  action: 'send_verification' as const,
  outcome: 'unknown' as const,
  createdAt: '2026-10-02T01:15:00Z',
  completedAt: null,
  requestId: id,
};

describe('durable history states', () => {
  it('shows all four outcomes and nullable target/completion honestly', async () => {
    vi.spyOn(operatorApi, 'me').mockResolvedValue(fixtureSession);
    vi.spyOn(operatorApi, 'history').mockResolvedValue({
      entries: (['pending', 'succeeded', 'failed', 'unknown'] as const).map(
        (outcome, index) => ({
          id: `00000000-0000-4000-8000-00000000000${index + 2}`,
          actorId: fixtureSession.operator.id,
          targetId: null,
          action: 'create',
          outcome,
          createdAt: '2026-10-01T08:00:00Z',
          completedAt: null,
          requestId: fixtureSession.operator.id,
        }),
      ),
      page: 1,
      perPage: 20,
      hasNextPage: false,
    });
    vi.spyOn(operatorApi, 'historyEntry').mockResolvedValue({ entry });
    renderApp(
      <Routes>
        <Route path="/history" element={<HistoryPage />} />
        <Route path="/history/:id" element={<HistoryDetailsPage />} />
      </Routes>,
      '/history?page=3&perPage=50',
    );
    for (const outcome of ['pending', 'succeeded', 'failed', 'unknown'])
      expect(await screen.findByText(outcome)).toBeVisible();
    expect(screen.getAllByText('Unresolved')).toHaveLength(2);
    expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled();
    const opener = screen.getAllByRole('button', {
      name: /Actions for action/,
    })[0];
    if (!opener) throw new Error('Missing action details trigger');
    await userEvent.click(opener);
    await userEvent.click(
      await screen.findByRole('menuitem', { name: /^View Create user/ }),
    );
    expect(
      await screen.findByRole('heading', { name: 'Action details' }),
    ).toBeVisible();
    expect(
      screen.getByRole('heading', { name: 'Send verification' }),
    ).toBeVisible();
    expect(screen.getByText('No target recorded')).toBeVisible();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Back to history' }),
    ).toHaveAttribute('href', '/history?page=3&perPage=50');
    await userEvent.click(screen.getByText('Technical details'));
    expect(screen.getByText('Request ID')).toBeVisible();
    await userEvent.click(
      screen.getByRole('link', { name: 'Back to history' }),
    );
    expect(
      await screen.findByRole('heading', { name: 'Action history' }),
    ).toBeVisible();
  });
  it('loads authoritative data on a direct protected route and verifies a target before linking', async () => {
    vi.spyOn(operatorApi, 'me').mockResolvedValue(fixtureSession);
    const lookup = vi
      .spyOn(operatorApi, 'historyEntry')
      .mockResolvedValue({ entry: { ...entry, targetId: id } });
    vi.spyOn(operatorApi, 'user').mockResolvedValue({
      user: {
        id,
        email: 'target@example.test',
        createdAt: null,
        emailConfirmedAt: null,
        lastSignInAt: null,
        bannedUntil: null,
        isBanned: false,
      },
    });
    renderApp(<AppRoutes />, `/history/${id}?page=2&perPage=20`);
    expect(
      await screen.findByRole('heading', { name: 'Send verification' }),
    ).toBeVisible();
    expect(lookup).toHaveBeenCalledWith(id, expect.any(AbortSignal));
    expect(
      await screen.findByRole('link', { name: 'target@example.test' }),
    ).toHaveAttribute('href', `/users/${id}`);
    expect(screen.getByText(/result is unresolved/)).toBeVisible();
    expect(screen.getByText('Audit ID')).not.toBeVisible();
    expect(
      screen.queryByRole('button', { name: /repeat|reconcile/i }),
    ).not.toBeInTheDocument();
  });
  it.each(['missing', 'deleted'] as const)(
    'keeps a %s target honest and offers no invalid target link',
    async (state) => {
      vi.spyOn(operatorApi, 'me').mockResolvedValue(fixtureSession);
      vi.spyOn(operatorApi, 'historyEntry').mockResolvedValue({
        entry: {
          ...entry,
          targetId: id,
          action: state === 'deleted' ? 'delete' : 'ban',
          outcome: state === 'deleted' ? 'succeeded' : 'unknown',
        },
      });
      const target = vi
        .spyOn(operatorApi, 'user')
        .mockRejectedValue(new ApiFailure('USER_NOT_FOUND', 404, false));
      renderApp(<AppRoutes />, `/history/${id}`);
      expect(
        await screen.findByText(
          state === 'deleted'
            ? 'Deleted by this action'
            : 'Account is unavailable or has since been deleted.',
        ),
      ).toBeVisible();
      expect(
        screen.queryByRole('link', { name: /target account/ }),
      ).not.toBeInTheDocument();
      if (state === 'deleted') expect(target).not.toHaveBeenCalled();
    },
  );
  it.each([
    [404, 'AUDIT_NOT_FOUND', 'Action not found'],
    [403, 'ACCESS_DENIED', 'Access denied'],
    [401, 'AUTHENTICATION_REQUIRED', 'Operator sign in'],
    [503, 'DEPENDENCY_UNAVAILABLE', 'Request needs attention'],
  ] as const)(
    'renders lookup status %s without treating it as success or empty',
    async (status, code, title) => {
      vi.spyOn(operatorApi, 'me').mockResolvedValue(fixtureSession);
      vi.spyOn(operatorApi, 'historyEntry').mockRejectedValue(
        new ApiFailure(code, status, false),
      );
      renderApp(<AppRoutes />, `/history/${id}`);
      expect(await screen.findByText(title)).toBeVisible();
      expect(
        screen.queryByText('No action history on this page'),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole('heading', { name: 'Send verification' }),
      ).not.toBeInTheDocument();
    },
  );
  it('rejects invalid IDs locally without requesting a lookup', async () => {
    vi.spyOn(operatorApi, 'me').mockResolvedValue(fixtureSession);
    const lookup = vi.spyOn(operatorApi, 'historyEntry');
    renderApp(<AppRoutes />, '/history/not-an-id?page=bad&perPage=500');
    expect(await screen.findByText('Action not found')).toBeVisible();
    expect(lookup).not.toHaveBeenCalled();
    expect(
      screen.getByRole('link', { name: 'Back to history' }),
    ).toHaveAttribute('href', '/history?page=1&perPage=20');
  });
  it('read errors never render as empty history', async () => {
    vi.spyOn(operatorApi, 'me').mockResolvedValue(fixtureSession);
    vi.spyOn(operatorApi, 'history').mockRejectedValue(
      new ApiFailure('NETWORK_ERROR', 0, false),
    );
    renderApp(<HistoryPage />);
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'could not be reached',
    );
    expect(
      screen.queryByText('No action history on this page'),
    ).not.toBeInTheDocument();
  });
});
