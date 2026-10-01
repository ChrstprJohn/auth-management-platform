import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderApp, fixtureSession } from '@/test/providers';
import { operatorApi } from '@/lib/api/operator';
import { CopyId } from './copy-id';

describe('identifier clipboard feedback', () => {
  it('announces confirmed copy', async () => {
    vi.spyOn(operatorApi, 'me').mockResolvedValue(fixtureSession);
    const user = userEvent.setup();
    const write = vi
      .spyOn(navigator.clipboard, 'writeText')
      .mockResolvedValue();
    renderApp(<CopyId value={fixtureSession.operator.id} />);
    await user.click(screen.getByRole('button', { name: 'Copy identifier' }));
    expect(await screen.findByText('Copied')).toBeVisible();
    expect(write).toHaveBeenCalledWith(fixtureSession.operator.id);
  });
  it('preserves selectable ID and manual fallback after clipboard refusal', async () => {
    vi.spyOn(operatorApi, 'me').mockResolvedValue(fixtureSession);
    const user = userEvent.setup();
    vi.spyOn(navigator.clipboard, 'writeText').mockRejectedValue(
      new Error('Denied'),
    );
    renderApp(<CopyId value={fixtureSession.operator.id} />);
    await user.click(screen.getByRole('button', { name: 'Copy identifier' }));
    expect(await screen.findByText(/Copy unavailable/)).toBeVisible();
    expect(screen.getByText(fixtureSession.operator.id)).toHaveClass(
      'select-text',
    );
    expect(screen.queryByText('Copied')).not.toBeInTheDocument();
  });
});
