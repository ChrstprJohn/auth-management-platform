import { GoTrueHttp } from './http.js';
import { z } from 'zod';
import { UpstreamError } from './errors.js';
import {
  identitySchema,
  type Identity,
  type OperatorIdentityClient,
  type PasswordSession,
} from './types.js';

export { UpstreamError } from './errors.js';
export { GoTrueAdminClient } from './admin-users.js';
export { GoTrueHttp } from './http.js';
export { GoTrueRecoveryClient } from './recovery.js';
export { GoTrueEmailClient } from './email.js';
export type { EmailClient } from './email.js';
export type { RecoveryClient } from './recovery.js';
export type { AdminUser, AdminUsersClient } from './admin-users.js';
export type {
  Identity,
  OperatorIdentityClient,
  PasswordSession,
} from './types.js';

export class GoTrueClient implements OperatorIdentityClient {
  private readonly http: GoTrueHttp;
  constructor(baseUrl: string, timeoutMs: number) {
    this.http = new GoTrueHttp(baseUrl, timeoutMs);
  }

  private async request(
    method: 'GET' | 'POST',
    path: string,
    data?: unknown,
    accessToken?: string,
  ): Promise<unknown> {
    return this.http.request(method, path, data, accessToken, true);
  }

  async passwordLogin(
    email: string,
    password: string,
  ): Promise<PasswordSession> {
    // Capture the start time so network latency cannot extend expires_in.
    const startedAt = Date.now();
    const body = await this.request('POST', 'token?grant_type=password', {
      email,
      password,
    });
    const result = z
      .object({
        access_token: z.string().min(1),
        expires_in: z.number().int().positive(),
        expires_at: z.number().int().positive().optional(),
        user: identitySchema,
      })
      .safeParse(body);
    if (!result.success) throw new UpstreamError('unavailable');
    const relativeExpiry = startedAt + result.data.expires_in * 1000;
    return {
      accessToken: result.data.access_token,
      expiresAt: Math.min(
        relativeExpiry,
        result.data.expires_at ? result.data.expires_at * 1000 : relativeExpiry,
      ),
      user: result.data.user,
    };
  }

  async getIdentity(accessToken: string): Promise<Identity> {
    const result = identitySchema.safeParse(
      await this.request('GET', 'user', undefined, accessToken),
    );
    if (!result.success) throw new UpstreamError('unavailable');
    return result.data;
  }

  async health(): Promise<{ version: string }> {
    const body = await this.request('GET', 'health');
    const result = z
      .object({
        version: z
          .string()
          .max(64)
          .regex(/^v?\d+\.\d+\.\d+(?:[-+][A-Za-z0-9.-]+)?$/),
        name: z.string().max(64),
      })
      .safeParse(body);
    if (!result.success) throw new UpstreamError('unavailable');
    return { version: result.data.version };
  }
}
