import { describe, it, expect, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { SafeUser, AuditEntry } from '@auth/contracts';
import { operatorApi } from '@/lib/api/operator';
import { renderApp, fixtureSession } from '@/test/providers';
import { summarizeUsers, summarizeAudit, useDashboard } from './hooks';

const user: SafeUser = {
  id: fixtureSession.operator.id,
  email: 'fixture@example.test',
  createdAt: null,
  emailConfirmedAt: null,
  lastSignInAt: null,
  bannedUntil: null,
  isBanned: null,
};
const entry: AuditEntry = {
  id: user.id,
  actorId: user.id,
  targetId: null,
  action: 'ban',
  outcome: 'unknown',
  createdAt: '2026-10-01T00:00:00Z',
  completedAt: null,
  requestId: user.id,
};
function Probe() {
  const m = useDashboard();
  return (
    <>
      <button onClick={m.refresh} disabled={m.refreshing}>
        Refresh
      </button>
      <output aria-label="Users">
        {m.users.error
          ? 'Read failed'
          : m.users.loading
            ? 'Loading'
            : m.users.data?.users.length === 0
              ? 'Empty'
              : 'Loaded'}
      </output>
      <output aria-label="Audit">
        {m.audit.error
          ? 'Read failed'
          : m.audit.loading
            ? 'Loading'
            : m.audit.data?.entries.length === 0
              ? 'Empty'
              : 'Loaded'}
      </output>
      {m.users.data && <span>Snapshot retained</span>}
    </>
  );
}
function health() {
  vi.spyOn(operatorApi, 'me').mockResolvedValue(fixtureSession);
  vi.spyOn(operatorApi, 'live').mockResolvedValue({ status: 'ok' });
  vi.spyOn(operatorApi, 'ready').mockResolvedValue({ status: 'ready' });
  vi.spyOn(operatorApi, 'upstream').mockResolvedValue({
    status: 'reachable',
    version: 'fixture',
  });
}
describe('bounded dashboard snapshots', () => {
  it('keeps unknown ban state and unreported confirmation separate', () => {
    const summary = summarizeUsers([
      user,
      { ...user, isBanned: false },
      { ...user, isBanned: true, emailConfirmedAt: '2026-10-01T00:00:00Z' },
    ]);
    expect(summary.confirmation.map((row) => row.count)).toEqual([1, 2]);
    expect(summary.bans.map((row) => row.count)).toEqual([1, 1, 1]);
    expect(summary.bans[2]?.percentage).toBeCloseTo(100 / 3);
  });
  it('counts pending and unknown as unresolved attempts, not successes', () => {
    const summary = summarizeAudit([
      entry,
      { ...entry, outcome: 'pending' },
      { ...entry, outcome: 'succeeded', action: 'create' },
    ]);
    expect(summary.unresolved).toBe(2);
    expect(summary.outcomes.map((row) => row.count)).toEqual([1, 0, 1, 1]);
    expect(summary.actions.map((row) => row.count)).toEqual([1, 2, 0, 0, 0, 0]);
    expect(summary.daily).toEqual([
      { date: new Date(2026, 9, 1).toISOString(), attempts: 3, unresolved: 2 },
    ]);
  });
  it('reads only page one and retains a previous snapshot after a refresh failure', async () => {
    health();
    const users = vi
      .spyOn(operatorApi, 'users')
      .mockResolvedValueOnce({
        users: [user],
        page: 1,
        perPage: 20,
        hasNextPage: true,
      })
      .mockRejectedValue(new Error('Fixture dependency failure'));
    const audit = vi.spyOn(operatorApi, 'history').mockResolvedValue({
      entries: [entry],
      page: 1,
      perPage: 20,
      hasNextPage: true,
    });
    renderApp(<Probe />);
    await waitFor(() =>
      expect(screen.getByLabelText('Users')).toHaveTextContent('Loaded'),
    );
    expect(users).toHaveBeenCalledTimes(1);
    expect(audit).toHaveBeenCalledTimes(1);
    expect(users).toHaveBeenCalledWith(1, 20, expect.any(AbortSignal));
    expect(audit).toHaveBeenCalledWith(1, 20, expect.any(AbortSignal));
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Refresh' })).toBeEnabled(),
    );
    await userEvent.click(screen.getByRole('button', { name: 'Refresh' }));
    await waitFor(() =>
      expect(screen.getByLabelText('Users')).toHaveTextContent('Read failed'),
    );
    expect(screen.getByText('Snapshot retained')).toBeVisible();
    expect(users).toHaveBeenCalledTimes(2);
  });
  it('distinguishes an initial failed read from a successful empty page', async () => {
    health();
    vi.spyOn(operatorApi, 'users').mockRejectedValue(new Error('Fixture'));
    vi.spyOn(operatorApi, 'history').mockResolvedValue({
      entries: [],
      page: 1,
      perPage: 20,
      hasNextPage: false,
    });
    renderApp(<Probe />);
    await waitFor(() =>
      expect(screen.getByLabelText('Users')).toHaveTextContent('Read failed'),
    );
    expect(screen.getByLabelText('Audit')).toHaveTextContent('Empty');
    expect(screen.queryByText('Snapshot retained')).not.toBeInTheDocument();
  });
});
