import { createHmac } from 'node:crypto';
import { parseEnv } from 'node:util';
import { writeEnvValue } from './env-file.js';

export class LocalSetupError extends Error {}

export function generateLocalAdminToken(
  upstreamEnvironment: string,
  backendEnvironment: string,
  now = Math.floor(Date.now() / 1000),
): string {
  const upstream = parseEnv(upstreamEnvironment);
  const backend = parseEnv(backendEnvironment);
  if (backend.NODE_ENV === 'production')
    throw new LocalSetupError('This helper is for local development only.');
  const urlText = backend.GOTRUE_URL;
  if (!urlText || !URL.canParse(urlText))
    throw new LocalSetupError('Configure a local GOTRUE_URL first.');
  const url = new URL(urlText);
  if (
    url.protocol !== 'http:' ||
    !['localhost', '127.0.0.1'].includes(url.hostname) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    url.pathname !== '/'
  )
    throw new LocalSetupError(
      'This helper requires a loopback HTTP GoTrue URL.',
    );
  const secret = upstream.GOTRUE_JWT_SECRET;
  if (
    !secret ||
    Buffer.byteLength(secret) < 32 ||
    secret.startsWith('REPLACE_')
  )
    throw new LocalSetupError(
      'Configure the existing local GOTRUE_JWT_SECRET first.',
    );
  const roles = (upstream.GOTRUE_JWT_ADMIN_ROLES ?? 'service_role')
    .split(',')
    .map((role) => role.trim());
  if (!roles.includes('service_role'))
    throw new LocalSetupError(
      'The local GoTrue configuration must allow service_role.',
    );
  const encode = (value: object) =>
    Buffer.from(JSON.stringify(value)).toString('base64url');
  const header = encode({ alg: 'HS256', typ: 'JWT' });
  const payload = encode({
    role: 'service_role',
    aud: upstream.GOTRUE_JWT_AUD ?? 'authenticated',
    iat: now,
    exp: now + 30 * 24 * 60 * 60,
  });
  const unsigned = `${header}.${payload}`;
  return `${unsigned}.${createHmac('sha256', secret).update(unsigned).digest('base64url')}`;
}

export function writeAdminToken(environment: string, token: string): string {
  return writeEnvValue(environment, 'GOTRUE_ADMIN_TOKEN', token);
}
