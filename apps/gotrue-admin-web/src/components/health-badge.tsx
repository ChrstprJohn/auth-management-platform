import { Badge } from '@/components/ui/badge';

export function HealthBadge({ status }: { status: string }) {
  return (
    <Badge
      variant={
        status === 'unavailable' || status === 'Check failed'
          ? 'destructive'
          : status === 'ok' || status === 'ready' || status === 'reachable'
            ? 'secondary'
            : 'outline'
      }
    >
      {status}
    </Badge>
  );
}
