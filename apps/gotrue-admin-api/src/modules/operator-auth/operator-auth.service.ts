import type { OperatorSession } from '@auth/contracts';
import {
  UpstreamError,
  type Identity,
  type OperatorIdentityClient,
} from '@auth/gotrue-client';
import {
  forbidden,
  unauthorized,
  unavailable,
} from '../../shared/errors/api-error.js';
import type { SessionStore } from './session.repository.js';
import { SessionCrypto } from './session-crypto.js';
import { isUsableOperator } from './operator-eligibility.js';

export class OperatorAuthService {
  constructor(
    private readonly upstream: OperatorIdentityClient,
    private readonly sessions: SessionStore,
    private readonly crypto: SessionCrypto,
    private readonly allowlist: ReadonlySet<string>,
  ) {}

  private usable(user: Identity): boolean {
    return isUsableOperator(user, this.allowlist);
  }
  private translate(error: unknown): never {
    if (error instanceof UpstreamError) {
      if (error.kind === 'identity' || error.kind === 'not_found')
        throw unauthorized();
      throw unavailable();
    }
    throw error;
  }

  async login(
    email: string,
    password: string,
  ): Promise<{ cookie: string; session: OperatorSession }> {
    try {
      const result = await this.upstream.passwordLogin(email, password);
      if (!this.usable(result.user)) throw forbidden();
      const now = Date.now();
      const expiresAt = new Date(Math.min(now + 3600000, result.expiresAt));
      if (expiresAt.getTime() <= now) throw unauthorized();
      const cookie = this.crypto.generate();
      await this.sessions.create({
        hash: this.crypto.hash(cookie),
        operatorId: result.user.id,
        createdAt: new Date(now),
        expiresAt,
        token: this.crypto.encrypt(result.accessToken, result.user.id),
      });
      return {
        cookie,
        session: {
          operator: { id: result.user.id, email: result.user.email },
          expiresAt: expiresAt.toISOString(),
        },
      };
    } catch (error) {
      this.translate(error);
    }
  }

  async authenticate(cookie: unknown): Promise<OperatorSession> {
    if (typeof cookie !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(cookie))
      throw unauthorized();
    try {
      const session = await this.sessions.find(this.crypto.hash(cookie));
      if (!session || session.expiresAt.getTime() <= Date.now())
        throw unauthorized();
      if (!this.allowlist.has(session.operatorId.toLowerCase()))
        throw forbidden();
      let token: string;
      try {
        token = this.crypto.decrypt(session.token, session.operatorId);
      } catch {
        throw unauthorized();
      }
      const identity = await this.upstream.getIdentity(token);
      if (identity.id !== session.operatorId) throw unauthorized();
      if (!this.usable(identity)) throw forbidden();
      if (session.expiresAt.getTime() <= Date.now()) throw unauthorized();
      return {
        operator: { id: identity.id, email: identity.email },
        expiresAt: session.expiresAt.toISOString(),
      };
    } catch (error) {
      this.translate(error);
    }
  }

  async logout(cookie: unknown): Promise<void> {
    if (typeof cookie === 'string' && /^[A-Za-z0-9_-]{43}$/.test(cookie))
      await this.sessions.delete(this.crypto.hash(cookie));
  }
  async hasUsableSession(operatorId: string): Promise<boolean> {
    if (!this.allowlist.has(operatorId.toLowerCase())) return false;
    for (const session of await this.sessions.findForOperator(operatorId)) {
      if (session.expiresAt.getTime() <= Date.now()) continue;
      let token: string;
      try {
        token = this.crypto.decrypt(session.token, operatorId);
      } catch {
        continue;
      }
      try {
        const identity = await this.upstream.getIdentity(token);
        if (
          identity.id === operatorId &&
          this.usable(identity) &&
          session.expiresAt.getTime() > Date.now()
        )
          return true;
      } catch (error) {
        if (
          error instanceof UpstreamError &&
          (error.kind === 'identity' || error.kind === 'not_found')
        )
          continue;
        throw unavailable();
      }
    }
    return false;
  }
}
