import { date } from '@/lib/format/display';
export function Timestamp({
  value,
  compact = false,
}: {
  value: string | null | undefined;
  compact?: boolean;
}) {
  return value ? (
    <time dateTime={value} title={value} className="tabular-nums">
      {compact
        ? new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(
            new Date(value),
          )
        : date(value)}
    </time>
  ) : (
    <span>Not reported</span>
  );
}
