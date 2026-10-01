import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

// Check the running container rather than .env: the explicit Compose override
// can supersede Resend values. Print no environment, provider key or raw errors.
export function assertMailpitCapture() {
  try {
    execFileSync(
      'docker',
      [
        'compose',
        '-f',
        fileURLToPath(
          new URL('../infrastructure/local/compose.yaml', import.meta.url),
        ),
        'exec',
        '-T',
        'gotrue',
        'sh',
        '-c',
        '[ "$GOTRUE_SMTP_HOST" = "mailpit" ] && [ "$GOTRUE_SMTP_PORT" = "1025" ] && [ -z "$GOTRUE_SMTP_USER" ] && [ -z "$GOTRUE_SMTP_PASS" ]',
      ],
      { stdio: 'ignore', timeout: 10000 },
    );
  } catch {
    throw new Error(
      'Mailpit-only probe stopped before mutation: running GoTrue capture configuration could not be confirmed. Use the documented user-operated Mailpit override. Resend live testing requires separate recipient authorization.',
    );
  }
}
