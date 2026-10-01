import { describe, it, expect } from 'vitest';
import { createSessionRuntime } from './runtime';
import { ApiFailure } from '../api/client';

describe('private session isolation', () => {
  it('drops old-session error metadata as well as successful responses', async () => {
    const runtime = createSessionRuntime();
    let reject: (value: Error) => void = () => {};
    const delayed = runtime.protectedCall(
      () =>
        new Promise<string>((_resolve, fail) => {
          reject = fail;
        }),
    );
    runtime.clear();
    reject(
      new ApiFailure(
        'UPSTREAM_OUTCOME_UNKNOWN',
        503,
        true,
        'old-request',
        'old-audit',
      ),
    );
    await expect(delayed).rejects.toMatchObject({
      code: 'SESSION_CHANGED',
      requestId: undefined,
      auditId: undefined,
    });
  });
  it('clears sensitive caches and rejects a response from an old session', async () => {
    const runtime = createSessionRuntime();
    runtime.client.setQueryData(['private', 0, 'users'], ['private fixture']);
    let resolve: (value: string) => void = () => {};
    const delayed = runtime.protectedCall(
      () =>
        new Promise<string>((done) => {
          resolve = done;
        }),
    );
    runtime.clear();
    resolve('old account data');
    await expect(delayed).rejects.toMatchObject({ code: 'SESSION_CHANGED' });
    expect(runtime.client.getQueryCache().getAll()).toHaveLength(0);
  });
  it('loses authority on protected 401 and 403, while dependency failure preserves data', async () => {
    const runtime = createSessionRuntime();
    const events: boolean[] = [];
    runtime.listen((denied) => events.push(denied));
    runtime.client.setQueryData(['private'], ['fixture']);
    await runtime
      .protectedCall(() =>
        Promise.reject(new ApiFailure('DEPENDENCY_UNAVAILABLE', 503, false)),
      )
      .catch(() => {});
    expect(runtime.client.getQueryData(['private'])).toEqual(['fixture']);
    await runtime
      .protectedCall(() =>
        Promise.reject(new ApiFailure('AUTHENTICATION_REQUIRED', 401, false)),
      )
      .catch(() => {});
    expect(events).toEqual([false]);
    expect(runtime.client.getQueryCache().getAll()).toHaveLength(0);
    await runtime
      .protectedCall(() =>
        Promise.reject(new ApiFailure('ACCESS_DENIED', 403, false)),
      )
      .catch(() => {});
    expect(events).toEqual([false, true]);
  });
});
