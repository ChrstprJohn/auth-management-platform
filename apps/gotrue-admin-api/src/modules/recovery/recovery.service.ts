import { createHash, timingSafeEqual } from 'node:crypto';
import {
  UpstreamError,
  type OperatorIdentityClient,
  type RecoveryClient,
} from '@auth/gotrue-client';
import { SessionCrypto } from '../operator-auth/session-crypto.js';
import { isUsableOperator } from '../operator-auth/operator-eligibility.js';
import type { RecoveryStore } from './recovery.repository.js';
import { ApiError, unavailable } from '../../shared/errors/api-error.js';

export const invalidRecovery = () =>
  new ApiError(
    400,
    'INVALID_RECOVERY',
    'Start a new password recovery request.',
  );
export class RecoveryService {
  constructor(
    private readonly upstream: RecoveryClient,
    private readonly identities: OperatorIdentityClient,
    private readonly store: RecoveryStore,
    private readonly crypto: SessionCrypto,
    private readonly allowlist: ReadonlySet<string>,
    private readonly callbackUrl: string,
  ) {}
  async request(email: string): Promise<{ cookie: string; expiresAt: Date }> {
    const cookie = this.crypto.generate();
    const hash = this.crypto.hash(cookie);
    // Two random values make a 86-character RFC 7636 verifier.
    const verifier = this.crypto.generate() + this.crypto.generate();
    const expiresAt = new Date(Date.now() + 3600000);
    await this.store.create({
      hash,
      emailHash: this.crypto.hash(email.toLowerCase()),
      operatorId: null,
      createdAt: new Date(),
      expiresAt,
      secret: this.crypto.encrypt(verifier, `recovery:${hash}`),
    });
    const callback = new URL(this.callbackUrl);
    callback.searchParams.set('state', cookie);
    const challenge = createHash('sha256').update(verifier).digest('base64url');
    try {
      await this.upstream.sendRecovery(email, challenge, callback.href);
    } catch {
      /* Same response for absent accounts, mail/rate failures and outages. */
    }
    return { cookie, expiresAt };
  }
  private hash(cookie: unknown): string {
    if (typeof cookie !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(cookie))
      throw invalidRecovery();
    return this.crypto.hash(cookie);
  }
  private translate(error: unknown): never {
    if (error instanceof UpstreamError) {
      if (
        error.kind === 'identity' ||
        error.kind === 'not_found' ||
        error.kind === 'rejected' ||
        error.kind === 'conflict'
      )
        throw invalidRecovery();
      throw unavailable();
    }
    throw error;
  }
  async callback(cookie: unknown, state: string, code: string): Promise<Date> {
    const hash = this.hash(cookie);
    if (
      !timingSafeEqual(Buffer.from(hash), Buffer.from(this.crypto.hash(state)))
    )
      throw invalidRecovery();
    const context = await this.store.claimCallback(hash);
    if (!context || context.expiresAt.getTime() <= Date.now())
      throw invalidRecovery();
    try {
      let verifier: string;
      try {
        verifier = this.crypto.decrypt(context.secret, `recovery:${hash}`);
      } catch {
        throw invalidRecovery();
      }
      const recovery = await this.upstream.exchangeRecovery(code, verifier);
      const user = await this.identities.getIdentity(recovery.accessToken);
      if (
        user.id !== recovery.user.id ||
        this.crypto.hash(user.email.toLowerCase()) !== context.emailHash ||
        !isUsableOperator(user, this.allowlist)
      )
        throw invalidRecovery();
      const expiresAt = new Date(
        Math.min(
          context.expiresAt.getTime(),
          Date.now() + 600000,
          recovery.expiresAt,
        ),
      );
      if (expiresAt.getTime() <= Date.now()) throw invalidRecovery();
      await this.store.ready(
        hash,
        user.id,
        this.crypto.encrypt(recovery.accessToken, `recovery:${hash}`),
        expiresAt,
      );
      return expiresAt;
    } catch (error) {
      this.translate(error);
    }
  }
  async reset(cookie: unknown, password: string): Promise<void> {
    const hash = this.hash(cookie);
    const context = await this.store.claimReset(hash);
    if (!context?.operatorId || context.expiresAt.getTime() <= Date.now())
      throw invalidRecovery();
    let token: string;
    try {
      token = this.crypto.decrypt(context.secret, `recovery:${hash}`);
    } catch {
      throw invalidRecovery();
    }
    try {
      const user = await this.identities.getIdentity(token);
      if (
        user.id !== context.operatorId ||
        !isUsableOperator(user, this.allowlist)
      )
        throw invalidRecovery();
      await this.upstream.updatePassword(token, password, user.id);
    } catch (error) {
      if (
        error instanceof UpstreamError &&
        (error.ambiguous || error.kind === 'unavailable')
      )
        throw new ApiError(
          503,
          'PASSWORD_RESET_OUTCOME_UNKNOWN',
          'Password reset could not be confirmed. Try normal sign-in; do not repeat this reset.',
        );
      this.translate(error);
    }
    try {
      await this.store.complete(hash, context.operatorId);
    } catch {
      throw new ApiError(
        503,
        'PASSWORD_RESET_COMPLETION_FAILED',
        'Password changed, but local cleanup could not be confirmed. Contact the server administrator; do not repeat this reset.',
      );
    }
  }
}
