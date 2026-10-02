import type { AuditAction, AuditOutcome } from '@auth/contracts';
import type { AuditStore } from './audit.repository.js';
import { ApiError } from '../../shared/errors/api-error.js';

export class AuditCompletionError extends ApiError {
  constructor(
    public readonly auditId: string,
    public readonly outcome: Exclude<AuditOutcome, 'pending'>,
  ) {
    super(
      503,
      'AUDIT_COMPLETION_FAILED',
      'The upstream outcome could not be fully recorded. Do not automatically repeat the action.',
      { auditId, outcome },
    );
  }
}
export class AuditService {
  constructor(private readonly store: AuditStore) {}
  intent(
    actorId: string,
    targetId: string | null,
    action: AuditAction,
    requestId: string,
  ) {
    return this.store.intent(actorId, targetId, action, requestId);
  }
  async complete(
    id: string,
    outcome: Exclude<AuditOutcome, 'pending'>,
    targetId: string | null,
  ): Promise<void> {
    try {
      await this.store.complete(id, outcome, targetId);
    } catch {
      throw new AuditCompletionError(id, outcome);
    }
  }
  async list(page: number, perPage: number) {
    const entries = await this.store.list(page, perPage);
    return {
      entries: entries.slice(0, perPage),
      page,
      perPage,
      hasNextPage: entries.length > perPage,
    };
  }
  async find(id: string) {
    const entry = await this.store.find(id);
    if (!entry)
      throw new ApiError(404, 'AUDIT_NOT_FOUND', 'Action record not found.');
    return { entry };
  }
  hasUnresolvedOperatorRemoval(ids: readonly string[]) {
    return this.store.hasUnresolvedOperatorRemoval(ids);
  }
}
