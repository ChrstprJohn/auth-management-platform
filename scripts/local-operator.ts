import { parseEnv } from 'node:util';
import { z } from 'zod';
import { GoTrueClient, GoTrueHttp, type Identity } from '@auth/gotrue-client';
import { LocalSetupError } from './local-admin-token.js';
import { writeEnvValue } from './env-file.js';

export const operatorInputSchema = z.strictObject({
  action: z.enum(['signup', 'authorize']),
  email: z.email().max(254),
  password: z
    .string()
    .min(8)
    .refine((value) => Buffer.byteLength(value, 'utf8') <= 72),
});
export function localOperatorConfig(environment: string): {
  baseUrl: string;
  allowlist: string[];
} {
  const config = parseEnv(environment);
  if (
    config.NODE_ENV === 'production' ||
    !config.GOTRUE_URL ||
    !URL.canParse(config.GOTRUE_URL)
  )
    throw new LocalSetupError(
      'Configure the local backend .env before provisioning.',
    );
  const url = new URL(config.GOTRUE_URL);
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
      'Operator provisioning is restricted to loopback HTTP GoTrue.',
    );
  const ids = (config.OPERATOR_UUID_ALLOWLIST ?? '')
    .split(',')
    .map((id) => id.trim().toLowerCase())
    .filter((id) => id && id !== '00000000-0000-4000-8000-000000000001');
  if (!z.array(z.uuid()).safeParse(ids).success)
    throw new LocalSetupError(
      'Correct OPERATOR_UUID_ALLOWLIST before provisioning.',
    );
  return { baseUrl: url.origin, allowlist: ids };
}
export function allowVerifiedOperator(
  environment: string,
  identity: Pick<Identity, 'id' | 'email_confirmed_at' | 'banned_until'>,
  now = Date.now(),
): string {
  const config = localOperatorConfig(environment);
  if (
    !z.uuid().safeParse(identity.id).success ||
    !identity.email_confirmed_at ||
    !Number.isFinite(Date.parse(identity.email_confirmed_at))
  )
    throw new LocalSetupError('Verify the account email in Mailpit first.');
  if (
    identity.banned_until &&
    (!Number.isFinite(Date.parse(identity.banned_until)) ||
      Date.parse(identity.banned_until) > now)
  )
    throw new LocalSetupError(
      'A banned account cannot be provisioned as the first operator.',
    );
  return writeEnvValue(
    environment,
    'OPERATOR_UUID_ALLOWLIST',
    [...new Set([...config.allowlist, identity.id.toLowerCase()])].join(','),
  );
}
export class LocalOperatorSetup {
  private readonly auth: GoTrueClient;
  private readonly http: GoTrueHttp;
  constructor(baseUrl: string) {
    this.auth = new GoTrueClient(baseUrl, 5000);
    this.http = new GoTrueHttp(baseUrl, 5000);
  }
  async signup(email: string, password: string): Promise<void> {
    await this.http.request(
      'POST',
      'signup',
      { email, password },
      undefined,
      true,
    );
  }
  async verify(email: string, password: string) {
    const login = await this.auth.passwordLogin(email, password);
    const identity = await this.auth.getIdentity(login.accessToken);
    if (
      identity.id !== login.user.id ||
      identity.email.toLowerCase() !== email.toLowerCase()
    )
      throw new LocalSetupError(
        'The signed-in identity did not match the requested account.',
      );
    return identity;
  }
}
