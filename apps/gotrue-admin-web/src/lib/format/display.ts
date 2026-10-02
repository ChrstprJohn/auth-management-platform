import type { AuditAction } from '@auth/contracts';

export function validDate(value: string | null | undefined) {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime()) ? parsed : null;
}
export function date(
  value: string | null | undefined,
  options: { dateOnly?: boolean; timeZone?: string } = {},
) {
  const parsed = validDate(value);
  if (!parsed) return 'Not reported';
  const day = new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: options.timeZone,
  }).format(parsed);
  if (options.dateOnly) return day;
  const time = new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: options.timeZone,
  }).format(parsed);
  return `${day}, ${time}`;
}
export function actionName(action: AuditAction) {
  return {
    create: 'Create user',
    ban: 'Ban user',
    unban: 'Unban user',
    delete: 'Delete user',
    invite: 'Invite user',
    send_verification: 'Send verification',
  }[action];
}
export function banStatus(value: boolean | null) {
  return value === null
    ? 'Ban status unknown'
    : value
      ? 'Banned'
      : 'No active ban';
}
