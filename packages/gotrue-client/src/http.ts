import axios, { type AxiosInstance } from 'axios';
import { UpstreamError } from './errors.js';

export class GoTrueHttp {
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
  async request(
    method: 'GET' | 'POST' | 'PUT' | 'DELETE',
    path: string,
    data?: unknown,
    token?: string,
    identity = false,
  ): Promise<unknown> {
    try {
      return (
        await this.http.request<unknown>({
          method,
          url: path,
          data,
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        })
      ).data;
    } catch (error: unknown) {
      if (axios.isAxiosError(error)) {
        const status = error.response?.status;
        if (status === 429) throw new UpstreamError('rate_limited');
        if (status === 404) throw new UpstreamError('not_found');
        if (status === 401 || status === 403)
          throw new UpstreamError(identity ? 'identity' : 'unavailable');
        if (status && status >= 400 && status < 500 && status !== 429) {
          const body: unknown = error.response?.data;
          // Password policy failures are distinct from invalid recovery identity.
          // Keep only recognized codes, never the provider's arbitrary message.
          if (method === 'PUT' && path === 'user') {
            if (
              typeof body === 'object' &&
              body !== null &&
              'error_code' in body
            ) {
              if (body.error_code === 'same_password')
                throw new UpstreamError('same_password');
              if (body.error_code === 'weak_password')
                throw new UpstreamError('weak_password');
            }
            throw new UpstreamError('rejected');
          }
          if (identity) throw new UpstreamError('identity');
          if (
            typeof body === 'object' &&
            body !== null &&
            'code' in body &&
            body.code === 'email_exists'
          )
            throw new UpstreamError('conflict');
          if (
            typeof body === 'object' &&
            body !== null &&
            'error_code' in body &&
            body.error_code === 'email_exists'
          )
            throw new UpstreamError('conflict');
          throw new UpstreamError('rejected');
        }
        throw new UpstreamError(
          'unavailable',
          method !== 'GET' &&
            (status === undefined || status >= 500 || status < 400),
        );
      }
      throw new UpstreamError('unavailable', method !== 'GET');
    }
  }
}
