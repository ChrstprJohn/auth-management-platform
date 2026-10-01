import axios, { type AxiosInstance } from 'axios';
import { z } from 'zod';
import { errorSchema } from './schemas';

export function apiOrigin(value: string): string {
  const url = new URL(value);
  if (
    !['http:', 'https:'].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    url.pathname !== '/'
  ) {
    throw new Error('VITE_API_BASE_URL must be a public HTTP(S) origin.');
  }
  return url.origin;
}

export class ApiFailure extends Error {
  constructor(
    public readonly code: string,
    public readonly status: number,
    public readonly uncertain: boolean,
    public readonly requestId?: string,
    public readonly auditId?: string,
    public readonly outcome?: 'succeeded' | 'failed' | 'unknown',
  ) {
    super(code);
    this.name = 'ApiFailure';
  }
}

export function createApiClient(
  baseURL: string,
  adapter?: AxiosInstance['defaults']['adapter'],
) {
  const http = axios.create({
    baseURL: apiOrigin(baseURL),
    withCredentials: true,
    timeout: 15000,
    validateStatus: () => true,
    ...(adapter ? { adapter } : {}),
  });
  async function request<T>(
    method: 'GET' | 'POST' | 'DELETE',
    path: string,
    schema: z.ZodType<T>,
    options: { body?: unknown; signal?: AbortSignal; health?: boolean } = {},
  ): Promise<T> {
    const mutation = method !== 'GET';
    let response;
    try {
      response = await http.request<unknown>({
        method,
        url: path,
        signal: options.signal,
        data: options.body,
        headers: mutation
          ? {
              'X-CSRF-Protection': '1',
              ...(options.body === undefined
                ? {}
                : { 'Content-Type': 'application/json' }),
            }
          : {},
      });
    } catch {
      throw new ApiFailure('NETWORK_ERROR', 0, mutation);
    }
    if (response.status < 200 || response.status >= 300) {
      if (options.health && response.status === 503) {
        const health = schema.safeParse(response.data);
        if (health.success) return health.data;
      }
      const error = errorSchema.safeParse(response.data);
      if (error.success) {
        const { error: detail, requestId, auditId, outcome } = error.data;
        const uncertain = [
          'AUDIT_COMPLETION_FAILED',
          'UPSTREAM_OUTCOME_UNKNOWN',
          'PASSWORD_RESET_OUTCOME_UNKNOWN',
          'PASSWORD_RESET_COMPLETION_FAILED',
        ].includes(detail.code);
        throw new ApiFailure(
          detail.code,
          response.status,
          uncertain || (mutation && response.status >= 500),
          requestId,
          auditId,
          outcome,
        );
      }
      throw new ApiFailure('INVALID_RESPONSE', response.status, mutation);
    }
    const parsed = schema.safeParse(
      response.status === 204 ? undefined : response.data,
    );
    if (!parsed.success)
      throw new ApiFailure('INVALID_RESPONSE', response.status, mutation);
    return parsed.data;
  }
  return { request };
}

export const api = createApiClient(
  import.meta.env.VITE_API_BASE_URL || 'http://localhost:3100',
);
