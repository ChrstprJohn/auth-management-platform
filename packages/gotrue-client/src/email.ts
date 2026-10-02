import { z } from 'zod';
import { GoTrueHttp } from './http.js';
import { adminUserSchema, type AdminUser } from './admin-users.js';
import { identitySchema, type PasswordSession } from './types.js';
import { UpstreamError } from './errors.js';

export interface EmailClient {
  invite(email: string): Promise<AdminUser>;
  sendVerification(email: string): Promise<void>;
  verify(
    email: string,
    code: string,
    type: 'signup' | 'invite',
  ): Promise<PasswordSession>;
  discardSession(accessToken: string): Promise<void>;
}
export class GoTrueEmailClient implements EmailClient {
  private readonly http: GoTrueHttp;
  constructor(
    baseUrl: string,
    timeoutMs: number,
    private readonly adminToken: string,
  ) {
    this.http = new GoTrueHttp(baseUrl, timeoutMs);
  }
  async invite(email: string): Promise<AdminUser> {
    const result = adminUserSchema.safeParse(
      await this.http.request('POST', 'invite', { email }, this.adminToken),
    );
    if (
      !result.success ||
      result.data.email?.toLowerCase() !== email.toLowerCase()
    )
      throw new UpstreamError('unavailable', true);
    return result.data;
  }
  async sendVerification(email: string): Promise<void> {
    await this.http.request(
      'POST',
      'resend',
      { email, type: 'signup' },
      this.adminToken,
    );
  }
  async verify(
    email: string,
    code: string,
    type: 'signup' | 'invite',
  ): Promise<PasswordSession> {
    const startedAt = Date.now();
    const result = z
      .object({
        access_token: z.string().min(1),
        expires_in: z.number().int().positive(),
        expires_at: z.number().int().positive().optional(),
        user: identitySchema,
      })
      .safeParse(
        await this.http.request(
          'POST',
          'verify',
          { email, token: code, type },
          undefined,
          true,
        ),
      );
    if (
      !result.success ||
      result.data.user.email.toLowerCase() !== email.toLowerCase() ||
      !result.data.user.email_confirmed_at ||
      (type === 'invite' && !result.data.user.invited_at)
    )
      throw new UpstreamError('unavailable', true);
    return {
      accessToken: result.data.access_token,
      user: result.data.user,
      expiresAt: Math.min(
        startedAt + result.data.expires_in * 1000,
        result.data.expires_at ? result.data.expires_at * 1000 : Infinity,
      ),
    };
  }
  async discardSession(accessToken: string): Promise<void> {
    await this.http.request(
      'POST',
      'logout?scope=local',
      undefined,
      accessToken,
      true,
    );
  }
}
