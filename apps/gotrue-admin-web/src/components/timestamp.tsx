import { date, validDate } from '@/lib/format/display';
export function Timestamp({
  value,
  dateOnly = false,
}: {
  value: string | null | undefined;
  dateOnly?: boolean;
}) {
  return validDate(value) ? (
    <time
      dateTime={value ?? undefined}
      className="whitespace-normal tabular-nums"
    >
      {date(value, { dateOnly })}
    </time>
  ) : (
    <span>Not reported</span>
  );
}
