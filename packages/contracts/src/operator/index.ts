export interface OperatorSession {
  operator: { id: string; email: string };
  expiresAt: string;
}
export interface RecoveryRequestResponse {
  message: string;
}

export interface ApiErrorResponse {
  error: { code: string; message: string };
  requestId: string;
}

export interface SafeUser {
  id: string;
  email: string | null;
  createdAt: string | null;
  emailConfirmedAt: string | null;
  invitedAt?: string | null;
  lastSignInAt: string | null;
  bannedUntil: string | null;
  isBanned: boolean | null;
}
export type AuditAction =
  | 'create'
  | 'ban'
  | 'unban'
  | 'delete'
  | 'invite'
  | 'send_verification';
export type AuditOutcome = 'pending' | 'succeeded' | 'failed' | 'unknown';
export interface AuditEntry {
  id: string;
  actorId: string;
  targetId: string | null;
  action: AuditAction;
  outcome: AuditOutcome;
  createdAt: string;
  completedAt: string | null;
  requestId: string;
}
