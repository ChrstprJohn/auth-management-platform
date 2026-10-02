import { ApiFailure } from './client';

const messages: Record<string, string> = {
  INVALID_EMAIL_CODE:
    'The email code is invalid or expired. Use the newest email.',
  EMAIL_RATE_LIMITED:
    'Email requests are limited. Wait before making a new request.',
  EMAIL_ACTION_UNAVAILABLE:
    'This action requires an unconfirmed account with a usable email address.',
  INVITATION_PASSWORD_FAILED:
    'Email was verified, but password setup failed and the code was consumed. Contact the inviting operator.',
  INVITATION_OUTCOME_UNKNOWN:
    'Email was verified, but the password result is unknown. Try ordinary sign-in or contact the inviting operator; do not repeat this submission.',
  AUTHENTICATION_REQUIRED: 'Sign in with valid operator credentials.',
  ACCESS_DENIED:
    'Access was denied. Check operator eligibility and use the trusted dashboard origin.',
  RATE_LIMITED: 'Too many requests. Wait before trying again.',
  DEPENDENCY_UNAVAILABLE:
    'A required service is unavailable. Try a read again when service is restored.',
  NETWORK_ERROR: 'The API could not be reached.',
  INVALID_RESPONSE: 'The API returned an unexpected response.',
  INVALID_INPUT: 'The request was rejected. Check the fields and their limits.',
  USER_EXISTS: 'An account with that email already exists.',
  USER_NOT_FOUND: 'This account is missing or has already been deleted.',
  INVALID_RECOVERY:
    'Recovery is missing, expired, already used or unavailable for this account. Request a fresh email in this browser.',
  OPERATOR_RECOVERY_UNAVAILABLE:
    'Password recovery is only available for operator accounts.',
  PASSWORD_RESET_SAME_PASSWORD:
    'Choose a password different from your current password. Request a fresh recovery email before trying again.',
  PASSWORD_RESET_WEAK_PASSWORD:
    'The password does not meet the account password policy. Request a fresh recovery email and choose a stronger password.',
  PASSWORD_RESET_REJECTED:
    'The password change was rejected. Request a fresh recovery email or contact the server administrator.',
  PASSWORD_RESET_RATE_LIMITED:
    'Password reset was rate limited. Wait before requesting a fresh recovery email.',
  DELETION_DISABLED:
    'Permanent deletion is disabled by the backend. The account remains available for inspection.',
  LAST_USABLE_OPERATOR:
    'The backend refused to remove the last usable operator. Another configured, verified and unbanned operator must sign in first.',
  MUTATION_IN_PROGRESS:
    'Another management action is active. Refresh the account and history before deciding what to do next.',
  RECONCILIATION_REQUIRED:
    'An earlier operation is unresolved. A trusted administrator must reconcile it before further removal actions.',
  UPSTREAM_OUTCOME_UNKNOWN:
    'The action may have applied. Inspect the account and durable history; do not repeat this action.',
  AUDIT_COMPLETION_FAILED:
    'The upstream result could not be fully recorded. Inspect the account and history; do not repeat this action.',
  PASSWORD_RESET_OUTCOME_UNKNOWN:
    'The password may have changed. Try ordinary sign-in or seek trusted assistance; do not repeat reset.',
  PASSWORD_RESET_COMPLETION_FAILED:
    'The password changed, but session cleanup could not be confirmed. Try sign-in or seek trusted assistance; do not repeat reset.',
  UPSTREAM_REJECTED:
    'GoTrue rejected this request. Check the account and supplied fields.',
  SESSION_CHANGED: 'The session changed. Sign in again to continue.',
};
export function failureMessage(error: unknown) {
  if (!(error instanceof ApiFailure))
    return 'The request could not be completed. Try a read again or seek trusted assistance.';
  const base =
    messages[error.code] ??
    'The request could not be completed. Use the request ID for trusted support.';
  return error.uncertain &&
    ![
      'UPSTREAM_OUTCOME_UNKNOWN',
      'AUDIT_COMPLETION_FAILED',
      'PASSWORD_RESET_OUTCOME_UNKNOWN',
      'PASSWORD_RESET_COMPLETION_FAILED',
    ].includes(error.code)
    ? `${base} The action may have applied. Inspect current state before any further attempt.`
    : base;
}
