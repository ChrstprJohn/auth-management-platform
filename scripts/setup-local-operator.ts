import { readFileSync, writeFileSync } from 'node:fs';
import {
  localOperatorConfig,
  operatorInputSchema,
  allowVerifiedOperator,
  LocalOperatorSetup,
} from './local-operator.js';
import { LocalSetupError } from './local-admin-token.js';

try {
  const inputText = readFileSync(0, 'utf8');
  if (Buffer.byteLength(inputText) > 4096)
    throw new LocalSetupError('Invalid setup input.');
  const input = operatorInputSchema.safeParse(JSON.parse(inputText));
  if (!input.success)
    throw new LocalSetupError(
      'Use a valid email and password of 8–72 UTF-8 bytes.',
    );
  const path = new URL('../apps/gotrue-admin-api/.env', import.meta.url);
  const environment = readFileSync(path, 'utf8');
  const config = localOperatorConfig(environment);
  const setup = new LocalOperatorSetup(config.baseUrl);
  if (input.data.action === 'signup') {
    await setup.signup(input.data.email, input.data.password);
    console.log(
      JSON.stringify({
        message:
          'Signup submitted. Open your configured mailbox and verify the newest email before continuing. This does not confirm delivery.',
      }),
    );
  } else {
    const identity = await setup.verify(input.data.email, input.data.password);
    // Re-read to preserve any other .env edits made while the email was verified.
    const updated = allowVerifiedOperator(readFileSync(path, 'utf8'), identity);
    writeFileSync(path, updated, { mode: 0o600 });
    console.log(
      JSON.stringify({
        message:
          'Verified operator UUID saved to apps/gotrue-admin-api/.env. Restart the backend to use it.',
      }),
    );
  }
} catch (error: unknown) {
  console.log(
    JSON.stringify({
      message:
        error instanceof LocalSetupError
          ? error.message
          : 'Setup could not be confirmed. Check that local GoTrue is running and email is verified. A signup may already exist; do not automatically repeat it.',
    }),
  );
  process.exitCode = 1;
}
