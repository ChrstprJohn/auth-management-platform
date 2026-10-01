import { describe, it, expect, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { operatorApi } from '@/lib/api/operator';
import { ApiFailure } from '@/lib/api/client';
import { renderApp, fixtureSession } from '@/test/providers';
import { HistoryPage } from './views';

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
    renderApp(<HistoryPage />);
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
      await screen.findByRole('menuitem', { name: 'View details' }),
    );
    expect(await screen.findByRole('dialog')).toHaveTextContent(
      'Action details',
    );
    expect(screen.getByRole('dialog')).toHaveTextContent('Not known');
    expect(screen.getByText('Request ID')).toBeVisible();
    await userEvent.keyboard('{Escape}');
    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
    );
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

