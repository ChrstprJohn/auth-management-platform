import {
  UpstreamError,
  type EmailClient,
  type RecoveryClient,
} from '@auth/gotrue-client';
import { ApiError, unavailable } from '../../shared/errors/api-error.js';

export class EmailService {
  constructor(
    private readonly upstream: EmailClient,
    private readonly passwords: RecoveryClient,
  ) {}
  private translate(error: unknown): never {
    if (error instanceof UpstreamError) {
      if (error.kind === 'rate_limited')
        throw new ApiError(
          429,
          'EMAIL_RATE_LIMITED',
          'Wait before trying a new email code.',
        );
      if (
        ['identity', 'not_found', 'rejected', 'conflict'].includes(error.kind)
      )
        throw new ApiError(
          400,
          'INVALID_EMAIL_CODE',
          'The email code is invalid or expired. Use the newest email.',
        );
    }
    throw unavailable();
  }
  async confirm(email: string, code: string): Promise<void> {
    let session;
    try {
      session = await this.upstream.verify(email, code, 'signup');
    } catch (error) {
      this.translate(error);
    }
    // Verification is complete. Discard the generated session; never grant dashboard access.
    try {
      await this.upstream.discardSession(session.accessToken);
    } catch {
      /* No credentials are retained or returned. */
    }
  }
  async acceptInvitation(
    email: string,
    code: string,
    password: string,
  ): Promise<void> {
    let session;
    try {
      session = await this.upstream.verify(email, code, 'invite');
    } catch (error) {
      this.translate(error);
    }
    try {
      if (session.expiresAt <= Date.now()) throw new UpstreamError('identity');
      await this.passwords.updatePassword(
        session.accessToken,
        password,
        session.user.id,
      );
    } catch (error) {
      const unknown = error instanceof UpstreamError && error.ambiguous;
      throw new ApiError(
        unknown ? 503 : 400,
        unknown ? 'INVITATION_OUTCOME_UNKNOWN' : 'INVITATION_PASSWORD_FAILED',
        unknown
          ? 'Email verified, but password setup could not be confirmed. Try normal sign-in or contact the inviting operator; do not repeat this submission.'
          : 'Email verified, but password setup failed. The email code was consumed. Contact the inviting operator.',
      );
    } finally {
      try {
        await this.upstream.discardSession(session.accessToken);
      } catch {
        /* Discard all local access to this session. */
      }
    }
  }
}
