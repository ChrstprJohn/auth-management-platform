import type { OperatorIdentityClient } from '@auth/gotrue-client';

export class HealthService {
  constructor(
    private readonly upstream: OperatorIdentityClient,
    private readonly checkDatabase: () => Promise<void>,
  ) {}
  async ready(): Promise<boolean> {
    const results = await Promise.allSettled([
      this.upstream.health(),
      this.checkDatabase(),
    ]);
    return results.every((result) => result.status === 'fulfilled');
  }
}
