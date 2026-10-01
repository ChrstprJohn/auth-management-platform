import { describe, it, expect, vi } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { operatorApi } from '@/lib/api/operator';
import { renderApp, fixtureSession } from '@/test/providers';
import { StatusPage } from './views';

describe('independent health signals', () => {
  it('distinguishes live, unavailable readiness and authenticated version and refreshes deliberately', async () => {
    vi.spyOn(operatorApi, 'me').mockResolvedValue(fixtureSession);
    const live = vi
      .spyOn(operatorApi, 'live')
      .mockResolvedValue({ status: 'ok' });
    const ready = vi
      .spyOn(operatorApi, 'ready')
      .mockResolvedValue({ status: 'unavailable' });
    const upstream = vi
      .spyOn(operatorApi, 'upstream')
      .mockResolvedValue({ status: 'reachable', version: 'v2.196.0' });
    renderApp(<StatusPage />);
    expect(
      await within(
        screen.getByRole('region', { name: 'API liveness' }),
      ).findByText('ok'),
    ).toBeVisible();
    expect(
      await within(
        screen.getByRole('region', { name: 'Dependency readiness' }),
      ).findByText('unavailable'),
    ).toBeVisible();
    expect(await screen.findByText('GoTrue version: v2.196.0')).toBeVisible();
    expect(screen.getByText(/do not prove email/)).toBeVisible();
    await userEvent.click(
      screen.getByRole('button', { name: 'Refresh all checks' }),
    );
    expect(live).toHaveBeenCalledTimes(2);
    expect(ready).toHaveBeenCalledTimes(2);
    expect(upstream).toHaveBeenCalledTimes(2);
  });
});
