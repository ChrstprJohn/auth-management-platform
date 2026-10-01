import type { Pool } from 'pg';
import { ApiError, unavailable } from '../../shared/errors/api-error.js';

export interface MutationLock {
  run<T>(operation: (assertHeld: () => void) => Promise<T>): Promise<T>;
}
export class MutationLockRepository implements MutationLock {
  constructor(private readonly pool: Pool) {}
  async run<T>(operation: (assertHeld: () => void) => Promise<T>): Promise<T> {
    const client = await this.pool.connect().catch(() => {
      throw unavailable();
    });
    let broken = false;
    const onError = () => {
      broken = true;
    };
    client.on('error', onError);
    try {
      const result = await client.query<{ locked: boolean }>(
        'SELECT pg_try_advisory_lock(1960, 1) AS locked',
      );
      if (result.rows[0]?.locked !== true)
        throw new ApiError(
          409,
          'MUTATION_IN_PROGRESS',
          'Another destructive action is in progress.',
        );
      const assertHeld = () => {
        if (broken) throw unavailable();
      };
      assertHeld();
      return await operation(assertHeld);
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw unavailable();
    } finally {
      // Destroy rather than reuse the connection: a timed-out unlock must never
      // leave a session-level lock on an idle pooled connection.
      client.removeListener('error', onError);
      client.release(true);
    }
  }
}
