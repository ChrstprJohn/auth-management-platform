import type { Identity } from '@auth/gotrue-client';

export function isUsableOperator(
  user: Pick<Identity, 'id' | 'email_confirmed_at' | 'banned_until'>,
  allowlist: ReadonlySet<string>,
): boolean {
  if (
    !allowlist.has(user.id.toLowerCase()) ||
    !user.email_confirmed_at ||
    !Number.isFinite(Date.parse(user.email_confirmed_at))
  )
    return false;
  return (
    !user.banned_until ||
    (Number.isFinite(Date.parse(user.banned_until)) &&
      Date.parse(user.banned_until) <= Date.now())
  );
}
