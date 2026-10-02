import { MoreHorizontal, RefreshCw } from 'lucide-react';
import { PageHeader } from '@/components/page-header';
import {
  Card,
  CardAction,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu';
import { HealthBadge } from '@/components/health-badge';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { Skeleton } from '@/components/ui/skeleton';
import { Failure } from '@/components/feedback/states';
import { Timestamp } from '@/components/timestamp';
import { useStatusPage } from './hooks';

export function StatusPage() {
  const m = useStatusPage();
  return (
    <section className="min-w-0 space-y-6">
      <PageHeader
        title="Service status"
        description="Availability checks do not verify email delivery or sign-in."
        actions={
          <Button
            variant="outline"
            onClick={m.refreshAll}
            disabled={m.refreshing}
          >
            {m.refreshing ? <Spinner /> : <RefreshCw />}Refresh all checks
          </Button>
        }
      />
      <div className="grid grid-cols-1 items-stretch gap-4 xl:grid-cols-3">
        {m.checks.map((check) => (
          <Card
            key={check.label}
            className="min-w-0"
            role="region"
            aria-label={check.label}
          >
            <CardHeader>
              <CardTitle>
                <h2 className="text-base">{check.label}</h2>
              </CardTitle>
              <CardDescription className="min-w-0 leading-relaxed">
                {check.description}
              </CardDescription>
              <CardAction>
                <DropdownMenu>
                  <DropdownMenuTrigger
                    render={<Button variant="ghost" size="icon-sm" />}
                    aria-label={`Actions for ${check.label}`}
                  >
                    <MoreHorizontal />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem
                      disabled={check.refreshing}
                      onClick={check.refresh}
                    >
                      <RefreshCw />
                      Refresh check
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </CardAction>
            </CardHeader>
            <CardContent className="min-w-0 flex-1 space-y-4">
              <div role="status" className="flex flex-wrap items-center gap-2">
                <HealthBadge status={check.status} />
                {check.refreshing && <Spinner aria-label="Refreshing check" />}
              </div>
              {check.status === 'Checking…' ? (
                <Skeleton className="h-4 w-32" />
              ) : (
                <p className="text-sm text-muted-foreground">
                  Last check:{' '}
                  <Timestamp
                    value={
                      check.checkedAt
                        ? new Date(check.checkedAt).toISOString()
                        : null
                    }
                  />
                </p>
              )}
              {check.version && (
                <p className="break-words text-sm">
                  GoTrue version: {check.version}
                </p>
              )}
              {!!check.checkedAt && (
                <details className="min-w-0 text-sm">
                  <summary className="cursor-pointer">
                    Technical details
                  </summary>
                  <p className="mt-2 break-all font-mono text-xs">
                    Source check timestamp:{' '}
                    {new Date(check.checkedAt).toISOString()}
                  </p>
                </details>
              )}
              {check.error && (
                <Failure error={check.error} retry={check.refresh} />
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
}
