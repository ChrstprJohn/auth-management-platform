export function date(value: string | null | undefined) {
  if (!value) return 'Not reported';
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}
export function banStatus(value: boolean | null) {
  return value === null
    ? 'Ban status unknown'
    : value
      ? 'Banned'
      : 'No active ban';
}
