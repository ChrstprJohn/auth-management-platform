import { z } from 'zod';
import { GoTrueHttp } from './http.js';
import { UpstreamError } from './errors.js';
import { identitySchema, type PasswordSession } from './types.js';

export interface RecoveryClient {
  sendRecovery(
    email: string,
    challenge: string,
    callback: string,
  ): Promise<void>;
  exchangeRecovery(code: string, verifier: string): Promise<PasswordSession>;
  updatePassword(
    accessToken: string,
    password: string,
    operatorId: string,
  ): Promise<void>;
}
export class GoTrueRecoveryClient implements RecoveryClient {
  private readonly http: GoTrueHttp;
  constructor(baseUrl: string, timeoutMs: number) {
    this.http = new GoTrueHttp(baseUrl, timeoutMs);
  }
  async sendRecovery(
    email: string,
    challenge: string,
    callback: string,
  ): Promise<void> {
    await this.http.request(
      'POST',
      `recover?redirect_to=${encodeURIComponent(callback)}`,
      { email, code_challenge: challenge, code_challenge_method: 's256' },
      undefined,
      true,
    );
  }
  async exchangeRecovery(
    code: string,
    verifier: string,
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
          'token?grant_type=pkce',
          { auth_code: code, code_verifier: verifier },
          undefined,
          true,
        ),
      );
    if (!result.success) throw new UpstreamError('unavailable');
    return {
      accessToken: result.data.access_token,
      user: result.data.user,
      expiresAt: Math.min(
        startedAt + result.data.expires_in * 1000,
        result.data.expires_at ? result.data.expires_at * 1000 : Infinity,
      ),
    };
  }
  async updatePassword(
    accessToken: string,
    password: string,
    operatorId: string,
  ): Promise<void> {
    const result = identitySchema.safeParse(
      await this.http.request('PUT', 'user', { password }, accessToken, true),
    );
    if (!result.success || result.data.id !== operatorId)
      throw new UpstreamError('unavailable', true);
  }
}
