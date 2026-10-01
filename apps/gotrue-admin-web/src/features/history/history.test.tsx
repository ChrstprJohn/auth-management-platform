import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
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
    expect(screen.getAllByText('Not known')).toHaveLength(4);
    expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled();
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
