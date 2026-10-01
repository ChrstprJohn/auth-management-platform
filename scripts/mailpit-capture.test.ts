import { describe, it, expect, vi } from 'vitest';
import { execFileSync } from 'node:child_process';
import { assertMailpitCapture } from './mailpit-capture.js';

vi.mock('node:child_process', () => ({ execFileSync: vi.fn() }));
describe('Mailpit-only probe guard', () => {
  it('checks effective container SMTP without exposing environment output', () => {
    vi.mocked(execFileSync).mockReturnValue(Buffer.alloc(0));
    assertMailpitCapture();
    expect(execFileSync).toHaveBeenCalledWith(
      'docker',
      expect.arrayContaining(['exec', '-T', 'gotrue', 'sh', '-c']),
      { stdio: 'ignore', timeout: 10000 },
    );
  });
  it('fails closed on Resend mode, unavailable Docker or an unconfirmed container', () => {
    vi.mocked(execFileSync).mockImplementation(() => {
      throw new Error('raw provider diagnostic');
    });
    expect(assertMailpitCapture).toThrow(
      'Mailpit-only probe stopped before mutation',
    );
    expect(assertMailpitCapture).not.toThrow('raw provider diagnostic');
  });
});
