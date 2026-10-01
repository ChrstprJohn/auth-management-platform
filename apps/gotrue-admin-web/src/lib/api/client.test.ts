import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { AxiosHeaders, type AxiosAdapter } from 'axios';
import { apiOrigin, ApiFailure, createApiClient } from './client';

const requestId = '00000000-0000-4000-8000-000000000001';
describe('credentialed safe API boundary', () => {
  it('sends exact CSRF, cookie and DELETE JSON configuration and handles 204', async () => {
    const adapter: AxiosAdapter = async (config) => {
      expect(config.withCredentials).toBe(true);
      expect(config.timeout).toBe(15000);
      expect(config.headers.get('X-CSRF-Protection')).toBe('1');
      expect(config.headers.get('Content-Type')).toBe('application/json');
      expect(config.headers.get('Authorization')).toBeUndefined();
      expect(config.data).toBe('{"targetId":"target"}');
      return {
        data: '',
        status: 204,
        statusText: '',
        headers: new AxiosHeaders(),
        config,
      };
    };
    await expect(
      createApiClient('http://localhost:3100', adapter).request(
        'DELETE',
        '/users/target',
        z.undefined(),
        { body: { targetId: 'target' } },
      ),
    ).resolves.toBeUndefined();
  });
  it('validates responses and strips extra fields', async () => {
    const adapter: AxiosAdapter = async (config) => ({
      data: { status: 'ok', secret: 'fixture' },
      status: 200,
      statusText: '',
      headers: new AxiosHeaders(),
      config,
    });
    await expect(
      createApiClient('http://localhost:3100', adapter).request(
        'GET',
        '/health/live',
        z.object({ status: z.literal('ok') }),
      ),
    ).resolves.toEqual({ status: 'ok' });
  });
  it('preserves only safe support metadata for partial results', async () => {
    const adapter: AxiosAdapter = async (config) => ({
      data: {
        error: {
          code: 'AUDIT_COMPLETION_FAILED',
          message: 'unsafe fixture text',
        },
        requestId,
        auditId: requestId,
        outcome: 'succeeded',
      },
      status: 503,
      statusText: '',
      headers: new AxiosHeaders(),
      config,
    });
    const error = await createApiClient('http://localhost:3100', adapter)
      .request('POST', '/users', z.object({}))
      .catch((error: unknown) => error);
    expect(error).toMatchObject({
      code: 'AUDIT_COMPLETION_FAILED',
      uncertain: true,
      requestId,
      auditId: requestId,
      outcome: 'succeeded',
    });
    expect(JSON.stringify(error)).not.toContain('unsafe fixture');
  });
  it('never retries unknown mutations or retains transport errors', async () => {
    let calls = 0;
    const adapter: AxiosAdapter = async () => {
      calls++;
      throw new Error('credential fixture');
    };
    const error = await createApiClient('http://localhost:3100', adapter)
      .request('POST', '/reset', z.undefined())
      .catch((error: unknown) => error);
    expect(calls).toBe(1);
    expect(error).toBeInstanceOf(ApiFailure);
    expect(error).toMatchObject({ code: 'NETWORK_ERROR', uncertain: true });
    expect(JSON.stringify(error)).not.toContain('credential fixture');
  });
  it('keeps health 503 objects distinct from common errors', async () => {
    const adapter: AxiosAdapter = async (config) => ({
      data: { status: 'unavailable' },
      status: 503,
      statusText: '',
      headers: new AxiosHeaders(),
      config,
    });
    await expect(
      createApiClient('http://localhost:3100', adapter).request(
        'GET',
        '/health/ready',
        z.object({ status: z.literal('unavailable') }),
        { health: true },
      ),
    ).resolves.toEqual({ status: 'unavailable' });
  });
  it('rejects malformed success without pretending the mutation failed definitely', async () => {
    const adapter: AxiosAdapter = async (config) => ({
      data: { bad: true },
      status: 200,
      statusText: '',
      headers: new AxiosHeaders(),
      config,
    });
    await expect(
      createApiClient('http://localhost:3100', adapter).request(
        'POST',
        '/users',
        z.object({ id: z.uuid() }),
      ),
    ).rejects.toMatchObject({ code: 'INVALID_RESPONSE', uncertain: true });
  });
  it.each([
    'https://user:pass@example.test',
    'https://example.test/path',
    'https://example.test?token=x',
    'https://example.test#x',
    'file:///tmp',
  ])('rejects non-origin configuration %s', (value) => {
    expect(() => apiOrigin(value)).toThrow();
  });
});
