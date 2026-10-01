import { readFileSync, writeFileSync } from 'node:fs';
import { parseEnv } from 'node:util';
import {
  generateLocalAdminToken,
  LocalSetupError,
  writeAdminToken,
} from './local-admin-token.js';

try {
  const upstreamPath = new URL('../infrastructure/local/.env', import.meta.url);
  const backendPath = new URL('../apps/gotrue-admin-api/.env', import.meta.url);
  let backend: string;
  let upstream: string;
  try {
    backend = readFileSync(backendPath, 'utf8');
    upstream = readFileSync(upstreamPath, 'utf8');
  } catch {
    throw new LocalSetupError(
      'Both infrastructure/local/.env and apps/gotrue-admin-api/.env must exist.',
    );
  }
  const current = parseEnv(backend).GOTRUE_ADMIN_TOKEN;
  if (current && !current.startsWith('REPLACE_')) {
    console.log(
      'GOTRUE_ADMIN_TOKEN already has a value; no changes made. To regenerate, remove that line and rerun this helper.',
    );
  } else {
    const token = generateLocalAdminToken(upstream, backend);
    writeFileSync(backendPath, writeAdminToken(backend, token), {
      mode: 0o600,
    });
    console.log(
      'GOTRUE_ADMIN_TOKEN saved to apps/gotrue-admin-api/.env (valid for 30 days). The token was not printed.',
    );
  }
} catch (error: unknown) {
  console.error(
    error instanceof LocalSetupError
      ? error.message
      : 'Local token setup failed; no credentials were printed.',
  );
  process.exitCode = 1;
}
