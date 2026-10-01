import axios, { type AxiosInstance } from 'axios';
import { z } from 'zod';
import { UpstreamError } from './errors.js';
import {
  identitySchema,
  type Identity,
  type OperatorIdentityClient,
  type PasswordSession,
} from './types.js';

export { UpstreamError } from './errors.js';
export type {
  Identity,
  OperatorIdentityClient,
  PasswordSession,
} from './types.js';

export class GoTrueClient implements OperatorIdentityClient {
  private readonly http: AxiosInstance;
  constructor(baseUrl: string, timeoutMs: number) {
    this.http = axios.create({
      baseURL: baseUrl.replace(/\/$/, '') + '/',
      timeout: timeoutMs,
      maxRedirects: 0,
      maxContentLength: 1024 * 1024,
      maxBodyLength: 16384,
      proxy: false,
    });
  }

  private async request(
    method: 'GET' | 'POST',
    path: string,
    data?: unknown,
    accessToken?: string,
  ): Promise<unknown> {
    try {
      const result = await this.http.request<unknown>({
        method,
        url: path,
        data,
        headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
      });
      return result.data;
    } catch (error: unknown) {
      if (axios.isAxiosError(error)) {
        const status = error.response?.status;
        if (
          status === 400 ||
          status === 401 ||
          status === 403 ||
          status === 422
        )
          throw new UpstreamError('identity');
        if (status === 404) throw new UpstreamError('not_found');
        throw new UpstreamError('unavailable', status === undefined);
      }
      throw new UpstreamError('unavailable');
    }
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

  async health(): Promise<void> {
    const body = await this.request('GET', 'health');
    if (
      !z.object({ version: z.string(), name: z.string() }).safeParse(body)
        .success
    )
      throw new UpstreamError('unavailable');
  }
}
