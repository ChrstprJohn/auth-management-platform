import type { AuditAction, SafeUser } from '@auth/contracts';
import {
  UpstreamError,
  type AdminUser,
  type AdminUsersClient,
} from '@auth/gotrue-client';
import { ApiError, unavailable } from '../../shared/errors/api-error.js';
import type { AuditService } from '../audit/audit.service.js';
import type { OperatorAuthService } from '../operator-auth/operator-auth.service.js';
import type { MutationLock } from './mutation-lock.repository.js';

export interface ManagementContext {
  actorId: string;
  requestId: string;
}
function safeUser(user: AdminUser): SafeUser {
  return {
    id: user.id,
    email: user.email || null,
    createdAt: user.created_at ?? null,
    emailConfirmedAt: user.email_confirmed_at ?? null,
    lastSignInAt: user.last_sign_in_at ?? null,
    bannedUntil: user.banned_until ?? null,
    isBanned: user.banned_until
      ? Date.parse(user.banned_until) > Date.now()
      : false,
  };
}
export class UsersService {
  constructor(
    private readonly upstream: AdminUsersClient,
    private readonly audit: AuditService,
    private readonly lock: MutationLock,
    private readonly auth: Pick<OperatorAuthService, 'hasUsableSession'>,
    private readonly operators: ReadonlySet<string>,
    private readonly deletionAllowed: boolean,
  ) {}
  private mapError(error: unknown): ApiError {
    if (error instanceof ApiError) return error;
    if (error instanceof UpstreamError) {
      if (error.ambiguous)
        return new ApiError(
          503,
          'UPSTREAM_OUTCOME_UNKNOWN',
          'The action may have applied. Inspect its audit record before retrying.',
        );
      if (error.kind === 'not_found')
        return new ApiError(404, 'USER_NOT_FOUND', 'User not found.');
      if (error.kind === 'conflict')
        return new ApiError(409, 'USER_EXISTS', 'The account already exists.');
      if (error.kind === 'rejected')
        return new ApiError(
          400,
          'UPSTREAM_REJECTED',
          'The account operation was rejected.',
        );
    }
    return unavailable();
  }
  async list(page: number, perPage: number) {
    try {
      const users = await this.upstream.listUsers(page, perPage);
      return {
        users: users.map(safeUser),
        page,
        perPage,
        hasNextPage: users.length === perPage && page < 10000,
      };
    } catch (error) {
      throw this.mapError(error);
    }
  }
  async get(id: string) {
    try {
      return { user: safeUser(await this.upstream.getUser(id)) };
    } catch (error) {
      throw this.mapError(error);
    }
  }
  private async attempt<T>(
    context: ManagementContext,
    action: AuditAction,
    targetId: string | null,
    operation: () => Promise<{ value: T; targetId: string | null }>,
  ): Promise<T & { auditId: string }> {
    const auditId = await this.audit.intent(
      context.actorId,
      targetId,
      action,
      context.requestId,
    );
    let result: { value: T; targetId: string | null };
    try {
      result = await operation();
    } catch (error) {
      const outcome =
        error instanceof UpstreamError && error.ambiguous
          ? 'unknown'
          : 'failed';
      await this.audit.complete(auditId, outcome, targetId);
      const safe = this.mapError(error);
      throw new ApiError(safe.status, safe.code, safe.message, {
        auditId,
        outcome,
      });
    }
    await this.audit.complete(auditId, 'succeeded', result.targetId);
    return { ...result.value, auditId };
  }
  async create(
    context: ManagementContext,
    input: {
      email: string;
      password: string;
      confirmation: 'require_verification' | 'operator_confirmed';
    },
  ) {
    return this.attempt(context, 'create', null, async () => {
      const user = await this.upstream.createUser(
        input.email,
        input.password,
        input.confirmation === 'operator_confirmed',
      );
      return { value: { user: safeUser(user) }, targetId: user.id };
    });
  }
  private async protectOperator(targetId: string): Promise<void> {
    if (!this.operators.has(targetId)) return;
    const target = await this.upstream.getUser(targetId);
    // An already unusable target cannot be the last usable operator.
    if (
      target.deleted_at ||
      (target.banned_until && Date.parse(target.banned_until) > Date.now()) ||
      !target.email_confirmed_at
    )
      return;
    for (const id of this.operators) {
      if (id === targetId) continue;
      let candidate: AdminUser;
      try {
        candidate = await this.upstream.getUser(id);
      } catch (error) {
        if (error instanceof UpstreamError && error.kind === 'not_found')
          continue;
        throw error;
      }
      if (
        !candidate.email ||
        !candidate.email_confirmed_at ||
        candidate.deleted_at ||
        (candidate.banned_until &&
          Date.parse(candidate.banned_until) > Date.now())
      )
        continue;
      if (await this.auth.hasUsableSession(id)) return;
    }
    throw new ApiError(
      409,
      'LAST_USABLE_OPERATOR',
      'Another usable operator must sign in before this operator can be removed.',
    );
  }
  private async destructive<T>(
    context: ManagementContext,
    action: 'ban' | 'delete',
    id: string,
    operation: () => Promise<T>,
  ): Promise<T & { auditId: string }> {
    return this.lock.run(async (assertHeld) => {
      // Check before recording this attempt so its own intent is not mistaken
      // for an earlier uncertain removal.
      const unresolved =
        this.operators.has(id) &&
        (await this.audit.hasUnresolvedOperatorRemoval([...this.operators]));
      assertHeld();
      return this.attempt(context, action, id, async () => {
        if (unresolved)
          throw new ApiError(
            409,
            'RECONCILIATION_REQUIRED',
            'An earlier operator removal requires trusted reconciliation.',
          );
        await this.protectOperator(id);
        assertHeld();
        return { value: await operation(), targetId: id };
      });
    });
  }
  ban(context: ManagementContext, id: string, durationHours: number) {
    return this.destructive(context, 'ban', id, async () => ({
      user: safeUser(await this.upstream.setBan(id, `${durationHours}h`)),
    }));
  }
  unban(context: ManagementContext, id: string) {
    return this.attempt(context, 'unban', id, async () => ({
      value: { user: safeUser(await this.upstream.setBan(id, 'none')) },
      targetId: id,
    }));
  }
  delete(context: ManagementContext, id: string) {
    return this.destructive(context, 'delete', id, async () => {
      if (!this.deletionAllowed)
        throw new ApiError(
          403,
          'DELETION_DISABLED',
          'Permanent global user deletion is disabled in this environment.',
        );
      await this.upstream.deleteUser(id);
      return { deleted: true as const, targetId: id };
    });
  }
}
