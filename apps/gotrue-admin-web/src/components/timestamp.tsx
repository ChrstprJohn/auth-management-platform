import { date } from '@/lib/format/display';
export function Timestamp({ value }: { value: string | null | undefined }) {
  return value ? (
    <time dateTime={value} title={value} className="tabular-nums">
      {date(value)}
    </time>
  ) : (
    <span>Not reported</span>
  );
}
